import { writable } from 'svelte/store';

export const showQuickLogModal = writable(false);
export const quickLogPreFill = writable<{
    id?: string;
    subjectName?: string;
    topicNames?: string[];
    durationMin?: number;
    startTs?: number;
    endTs?: number;
    outcome?: 'done' | 'partial' | 'stuck';
    focus?: number | null;
    note?: string | null;
} | null>(null);

export const toastMessage = writable<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'success', durationMs = 3000) {
    toastMessage.set({ text, type });
    setTimeout(() => toastMessage.set(null), durationMs);
}

// Global trigger to reload data (e.g. after logging a session)
export const refreshAppTrigger = writable(0);
export function triggerAppRefresh() {
    refreshAppTrigger.update(n => n + 1);
}
