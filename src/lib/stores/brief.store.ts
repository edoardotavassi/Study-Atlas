import { writable } from 'svelte/store';
import type { PlanBlock, PlanJSON } from '../domain/types';
import { getTodayPlan, commentOnPlan } from '../services/llm';
import { upsertBrief } from '../db/repositories/briefs.repo';
import { toDateStr } from '../db/utils';

export const todayBrief = writable<PlanJSON | null>(null);
export const briefSource = writable<'deterministic' | 'llm' | null>(null);
export const briefLoading = writable(false);

// Streaming state
export const thinkingText = writable<string>('');
export const streamingContent = writable<string>('');
export const isStreaming = writable(false);

// Plan editing state
export const planEditing = writable(false);
export const planCommentLoading = writable(false);

/**
 * Timestamp (ms) of when the plan was last loaded or regenerated.
 * Only sessions after this timestamp count as "done" for the current plan.
 */
export const planStartedAt = writable<number>(Date.now());

let _loadedDate: string | null = null;

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function refreshBrief(force = false) {
    const today = todayStr();
    if (!force && _loadedDate === today) return;

    briefLoading.set(true);
    thinkingText.set('');
    streamingContent.set('');
    isStreaming.set(false);

    try {
        const result = await getTodayPlan(force, {
            onThinking: (text) => {
                isStreaming.set(true);
                thinkingText.set(text);
            },
            onContent: (text) => {
                isStreaming.set(true);
                streamingContent.set(text);
            },
        });
        todayBrief.set(result.plan);
        briefSource.set(result.source);
        planStartedAt.set(Date.now()); // reset completion tracking
        _loadedDate = today;
    } catch (e) {
        console.error('Failed to load brief', e);
    } finally {
        briefLoading.set(false);
        isStreaming.set(false);
        thinkingText.set('');
        streamingContent.set('');
    }
}

/**
 * Save the user's custom-edited plan blocks, persist to DB, and fetch an AI comment.
 */
export async function editPlan(newBlocks: PlanBlock[], currentPlan: PlanJSON) {
    planEditing.set(false);
    planCommentLoading.set(true);

    // Update store immediately with the new blocks so the UI reflects changes
    const updated: PlanJSON = { ...currentPlan, blocks: newBlocks, reasoning: '' };
    todayBrief.set(updated);
    planStartedAt.set(Date.now()); // reset completion tracking on plan edit

    // Persist the edited plan as 'deterministic' source (user override)
    const today = toDateStr();
    await upsertBrief(today, 'deterministic', JSON.stringify(updated));
    _loadedDate = today; // prevent auto-reload from overwriting

    // Ask LLM for a comment
    try {
        const comment = await commentOnPlan(newBlocks);
        if (comment) {
            todayBrief.update(b => b ? { ...b, reasoning: comment } : b);
            // Also persist the comment
            const withComment: PlanJSON = { ...updated, reasoning: comment };
            await upsertBrief(today, 'deterministic', JSON.stringify(withComment));
        }
    } catch (e) {
        console.error('Failed to get AI comment', e);
    } finally {
        planCommentLoading.set(false);
    }
}
