import { getSetting } from '../db/repositories/goals.repo';
import { getBriefByDate, upsertBrief } from '../db/repositories/briefs.repo';
import { generateDeterministicPlan } from '../domain/planner';
import { getTodayMetrics, getSubjectStats } from '../domain/analytics';
import { validatePlan, type PlanJSON } from '../domain/types';
import { toDateStr } from '../db/utils';

export async function testOllamaConnection(): Promise<{ ok: boolean; message: string }> {
    try {
        const endpoint = await getSetting('llm.endpoint') ?? 'http://localhost:11434/v1/chat/completions';
        const base = endpoint.replace(/\/v1\/chat\/completions.*$/, '').replace(/\/api\/.*$/, '');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
            const resp = await fetch(`${base}/api/version`, { signal: controller.signal });
            clearTimeout(timer);
            if (resp.ok) {
                const data = await resp.json();
                return { ok: true, message: `Connected to Ollama ${data.version ?? ''}`.trim() };
            }
            return { ok: false, message: `Ollama returned ${resp.status}` };
        } catch {
            clearTimeout(timer);
            return { ok: false, message: 'Not reachable (is Ollama running?)' };
        }
    } catch {
        return { ok: false, message: 'Connection test failed' };
    }
}

export interface StreamCallbacks {
    /** Called with accumulated thinking content (inside <think>…</think>) */
    onThinking?: (text: string) => void;
    /** Called with accumulated non-thinking content so far */
    onContent?: (text: string) => void;
}

/**
 * Get today's plan — from cache or generate fresh.
 * When streaming is requested, callbacks receive live updates.
 */
export async function getTodayPlan(
    forceRegenerate = false,
    callbacks?: StreamCallbacks
): Promise<{ plan: PlanJSON; source: 'deterministic' | 'llm' }> {
    const today = toDateStr();

    if (!forceRegenerate) {
        const cached = await getBriefByDate(today);
        if (cached) {
            try {
                const plan = JSON.parse(cached.json) as PlanJSON;
                if (validatePlan(plan)) return { plan, source: cached.source };
            } catch { /* corrupt cache — regenerate */ }
        }
    }

    const llmEnabled = (await getSetting('llm.enabled')) === 'true';
    if (llmEnabled) {
        const llmResult = await tryLlmPlanStreaming(callbacks);
        if (llmResult) {
            await upsertBrief(today, 'llm', JSON.stringify(llmResult));
            return { plan: llmResult, source: 'llm' };
        }
    }

    // Deterministic fallback
    const plan = await generateDeterministicPlan();
    await upsertBrief(today, 'deterministic', JSON.stringify(plan));
    return { plan, source: 'deterministic' };
}

async function tryLlmPlanStreaming(callbacks?: StreamCallbacks): Promise<PlanJSON | null> {
    try {
        const endpoint = await getSetting('llm.endpoint') ?? 'http://localhost:11434/v1/chat/completions';
        const model = await getSetting('llm.model') ?? 'qwen3:4b';
        const temperature = parseFloat(await getSetting('llm.temperature') ?? '0.2');
        const maxTokens = parseInt(await getSetting('llm.maxTokens') ?? '600', 10);
        const timeoutMs = parseInt(await getSetting('llm.timeoutMs') ?? '30000', 10);

        const metrics = await getTodayMetrics();
        const subjectStats = await getSubjectStats();
        const summary = {
            date: toDateStr(),
            weeklyGoalMinutes: metrics.weeklyGoalMinutes,
            minutesToday: metrics.minutesLogged,
            minutesThisWeek: metrics.weeklyMinutes,
            subjects: subjectStats.slice(0, 6).map(s => ({
                name: s.subject.name,
                minutesLast7: s.minutesThisWeek,
                neglectDays: s.lastStudiedDate
                    ? Math.round((Date.now() - new Date(s.lastStudiedDate).getTime()) / 86400000)
                    : 999,
                stuckRate: s.stuckRateLast14 / 100,
                topTopics: s.topTopics,
            })),
        };

        const systemMessage = `You are a study planner. Based on the user's study data, produce a daily plan.
Think step by step about which subjects need the most attention.
Return ONLY valid JSON after your thinking. No markdown. No extra keys.
The JSON must exactly match this schema:
{"blocks":[{"minutes":<int>,"subject":"<string>","topics":["<string>"],"task":"<string>"},...],"risk":"<string>","reasoning":"<string: explain why you chose these blocks in 2-3 sentences based on neglect/stuck data>","startNow":"<string>"}
Rules: exactly 3 blocks, minutes must be 25, 50, or 90 only.`;

        const userMessage = `Study data: ${JSON.stringify(summary)}
Create a personalized 3-block plan. Prioritize neglected and stuck subjects.`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userMessage },
                ],
                temperature,
                max_tokens: maxTokens,
                stream: true, // Enable streaming
            }),
        });

        clearTimeout(timer);
        if (!response.ok || !response.body) return null;

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let thinkingContent = '';
        let inThinking = false;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed?.choices?.[0]?.delta?.content ?? '';
                        if (!delta) continue;

                        fullContent += delta;

                        // Track thinking vs content sections
                        // Thinking is inside <think>...</think>
                        let remaining = delta;
                        while (remaining.length > 0) {
                            if (!inThinking) {
                                const thinkStart = remaining.indexOf('<think>');
                                if (thinkStart >= 0) {
                                    inThinking = true;
                                    remaining = remaining.slice(thinkStart + 7);
                                } else {
                                    // Non-thinking content chunk
                                    callbacks?.onContent?.(fullContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim());
                                    break;
                                }
                            } else {
                                const thinkEnd = remaining.indexOf('</think>');
                                if (thinkEnd >= 0) {
                                    thinkingContent += remaining.slice(0, thinkEnd);
                                    callbacks?.onThinking?.(thinkingContent);
                                    inThinking = false;
                                    remaining = remaining.slice(thinkEnd + 8);
                                } else {
                                    thinkingContent += remaining;
                                    callbacks?.onThinking?.(thinkingContent);
                                    break;
                                }
                            }
                        }
                    } catch { /* skip malformed SSE lines */ }
                }
            }
        } finally {
            reader.releaseLock();
        }

        // Strip thinking tags from final content
        let jsonContent = fullContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (!jsonContent) return null;

        // Try direct parse, then JSON extraction
        let parsed: unknown = null;
        try {
            parsed = JSON.parse(jsonContent);
        } catch {
            const firstBrace = jsonContent.indexOf('{');
            const lastBrace = jsonContent.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                try { parsed = JSON.parse(jsonContent.slice(firstBrace, lastBrace + 1)); }
                catch { return null; }
            } else return null;
        }

        const validated = validatePlan(parsed);
        if (!validated) return null;
        return { ...validated, meta: { source: 'llm', model } };

    } catch {
        return null;
    }
}

import type { PlanBlock } from '../domain/types';

/**
 * Ask the LLM to comment on a user-edited plan.
 * Returns a short 2-3 sentence commentary, or null on failure.
 */
export async function commentOnPlan(blocks: PlanBlock[]): Promise<string | null> {
    try {
        const llmEnabled = (await getSetting('llm.enabled')) === 'true';
        if (!llmEnabled) return null;

        const endpoint = await getSetting('llm.endpoint') ?? 'http://localhost:11434/v1/chat/completions';
        const model = await getSetting('llm.model') ?? 'qwen3:4b';
        const temperature = parseFloat(await getSetting('llm.temperature') ?? '0.6');
        const timeoutMs = parseInt(await getSetting('llm.timeoutMs') ?? '20000', 10);

        const planSummary = blocks.map(b => `${b.subject} – ${b.minutes}m: ${b.task}`).join('\n');

        const systemMessage = `You are an encouraging study coach. The user has just custom-edited their study plan.
Comment on their plan in 2-3 engaging sentences. Be direct, specific, honest (if something looks off, say so gently), and motivating.
Do NOT use bullet points or headers. Just plain conversational text. Do not start with "I" or compliments— start with an observation.`;

        const userMessage = `Here is the user's custom study plan for today:\n${planSummary}\n\nGive a brief, helpful comment on this plan.`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userMessage },
                ],
                temperature,
                max_tokens: 200,
                stream: false,
            }),
        });

        clearTimeout(timer);
        if (!response.ok) return null;

        const data = await response.json();
        let text: string = data?.choices?.[0]?.message?.content ?? '';
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return text || null;

    } catch {
        return null;
    }
}


export interface TutorCallbacks {
    onToken: (token: string) => void;
}

export interface TutorChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

/**
 * Chat with the study tutor.
 * History is the conversation so far. Streams tokens via callbacks.onToken.
 * Builds a rich system prompt with real study stats as context.
 * The AI can append [PLAN_UPDATE:[...]] to signal a plan change.
 */
export async function chatWithTutor(
    history: TutorChatMessage[],
    callbacks: TutorCallbacks
): Promise<void> {
    const { getSetting: _gs } = await import('../db/repositories/goals.repo');
    const { getTodayMetrics: _gm, getSubjectStats: _gss } = await import('../domain/analytics');
    const { toDateStr: _td } = await import('../db/utils');

    const llmEnabled = (await _gs('llm.enabled')) === 'true';
    if (!llmEnabled) {
        callbacks.onToken('⚠️ LLM is not enabled. Configure a model in Settings to chat with your tutor.');
        return;
    }

    const endpoint = (await _gs('llm.endpoint')) ?? 'http://localhost:11434/v1/chat/completions';
    const model = (await _gs('llm.model')) ?? 'qwen3:4b';
    const temperature = parseFloat((await _gs('llm.temperature')) ?? '0.7');
    const timeoutMs = parseInt((await _gs('llm.timeoutMs')) ?? '60000', 10);

    const metrics = await _gm();
    const subjectStats = await _gss();
    const today = _td();

    const subjectSummary = subjectStats.slice(0, 8).map(s => {
        const neglect = s.lastStudiedDate
            ? Math.round((Date.now() - new Date(s.lastStudiedDate).getTime()) / 86400000)
            : 999;
        return `- ${s.subject.name}: ${s.minutesThisWeek}m this week, last studied ${neglect === 0 ? 'today' : neglect + 'd ago'}, stuck rate ${s.stuckRateLast14}%`;
    }).join('\n');

    const systemPrompt = `You are a friendly, expert study tutor embedded in the user's Study Atlas app.
You have full context of their study data. Your role is to help them understand their performance, plan smarter, and stay motivated.

Today is ${today}.
Weekly goal: ${metrics.weeklyGoalMinutes}m — logged ${metrics.weeklyMinutes}m so far (${metrics.weeklyProgressPercent}%).
Today so far: ${metrics.minutesLogged}m across ${metrics.sessionsCount} sessions.

Subjects (last 7 days):
${subjectSummary || 'No sessions recorded yet.'}

STYLE:
- Warm, direct, specific. Reference real subject names and numbers.
- Keep responses concise (3-5 sentences) unless the user asks for detail.
- Do not use bullet points unless the user asks for a list.

PLAN UPDATES:
If the user asks you to change today's plan (e.g. "make it lighter", "give me more Physics", "I only have 1 hour"), modify the plan accordingly.
After your text response, silently append on a new line:
[PLAN_UPDATE:[{"subject":"ExactSubjectName","minutes":25,"topics":[],"task":"What to work on"},{"subject":"AnotherSubject","minutes":50,"topics":[],"task":"What to work on"}]]
Rules: minutes must be 25, 50, or 90. 2-4 blocks. Use EXACT subject names from the list above. Do NOT mention [PLAN_UPDATE] in your spoken reply.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.text })),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model, messages, temperature, max_tokens: 600, stream: true }),
    });

    clearTimeout(timer);
    if (!response.ok || !response.body) {
        callbacks.onToken('Could not reach the AI model. Is Ollama running?');
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let inThinking = false;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') break;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed?.choices?.[0]?.delta?.content ?? '';
                    if (!delta) continue;
                    let remaining = delta;
                    while (remaining.length > 0) {
                        if (!inThinking) {
                            const ts = remaining.indexOf('<think>');
                            if (ts >= 0) {
                                if (ts > 0) callbacks.onToken(remaining.slice(0, ts));
                                inThinking = true;
                                remaining = remaining.slice(ts + 7);
                            } else {
                                callbacks.onToken(remaining);
                                break;
                            }
                        } else {
                            const te = remaining.indexOf('</think>');
                            if (te >= 0) { inThinking = false; remaining = remaining.slice(te + 8); }
                            else break;
                        }
                    }
                } catch { /* skip malformed SSE */ }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
