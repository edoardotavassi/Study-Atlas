import { writable, get } from 'svelte/store';
import type { PlanBlock } from '../domain/types';
import { chatWithTutor } from '../services/llm';
import { todayBrief, editPlan, planStartedAt } from './brief.store';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    planUpdate?: PlanBlock[]; // non-null if AI emitted a plan update
}

export const chatMessages = writable<ChatMessage[]>([]);
export const chatLoading = writable(false);
export const chatExpanded = writable(false);

/**
 * Send a user message to the tutor and stream the reply.
 * If the AI returns a [PLAN_UPDATE:...] directive, apply it automatically.
 */
export async function sendMessage(userText: string): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed) return;

    chatExpanded.set(true);

    // Append user bubble
    chatMessages.update(msgs => [...msgs, { role: 'user', text: trimmed }]);
    chatLoading.set(true);

    // Placeholder for the streaming assistant bubble
    const assistantIndex = get(chatMessages).length;
    chatMessages.update(msgs => [...msgs, { role: 'assistant', text: '' }]);

    // Build message history for the LLM (exclude the empty placeholder)
    const history = get(chatMessages).slice(0, assistantIndex);

    let fullText = '';
    let appliedPlan: PlanBlock[] | undefined;
    // Once the plan marker starts appearing, we freeze the display text at that point
    let frozenDisplayText: string | null = null;

    try {
        await chatWithTutor(
            history,
            {
                onToken: (token: string) => {
                    fullText += token;

                    // If we haven't hit the marker yet, update display normally
                    if (frozenDisplayText === null) {
                        const markerStart = fullText.indexOf('[PLAN_UPDATE:');
                        if (markerStart >= 0) {
                            // Freeze display at the clean text before the marker
                            frozenDisplayText = fullText.slice(0, markerStart).trim();
                        }
                    }

                    const displayText = frozenDisplayText !== null ? frozenDisplayText : fullText.trim();
                    chatMessages.update(msgs => {
                        const updated = [...msgs];
                        updated[assistantIndex] = { role: 'assistant', text: displayText };
                        return updated;
                    });
                },
            }
        );

        // After streaming completes, check for plan update marker
        const planMatch = fullText.match(/\[PLAN_UPDATE:([\s\S]*?)\]/);
        if (planMatch) {
            try {
                const newBlocks: PlanBlock[] = JSON.parse(planMatch[1]);
                const currentBrief = get(todayBrief);
                if (currentBrief && Array.isArray(newBlocks) && newBlocks.length > 0) {
                    await editPlan(newBlocks, currentBrief);
                    appliedPlan = newBlocks;
                }
            } catch {
                // Malformed plan — ignore
            }
        }

        // Final message: clean text + planUpdate flag
        const displayText = fullText.replace(/\[PLAN_UPDATE:[\s\S]*?\]/g, '').trim();
        chatMessages.update(msgs => {
            const updated = [...msgs];
            updated[assistantIndex] = { role: 'assistant', text: displayText, planUpdate: appliedPlan };
            return updated;
        });

    } catch (e) {
        chatMessages.update(msgs => {
            const updated = [...msgs];
            updated[assistantIndex] = {
                role: 'assistant',
                text: 'Sorry, I couldn\'t reach the AI model. Make sure Ollama is running and a model is configured in Settings.',
            };
            return updated;
        });
    } finally {
        chatLoading.set(false);
    }
}
