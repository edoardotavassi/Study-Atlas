import { writable, derived } from 'svelte/store';

export const timerRunning = writable(false);
export const timerStartTs = writable<number | null>(null);
export const timerElapsedSeconds = writable(0);

let _interval: ReturnType<typeof setInterval> | null = null;

export function startTimer() {
    const now = Date.now();
    timerStartTs.set(now);
    timerRunning.set(true);
    timerElapsedSeconds.set(0);
    _interval = setInterval(() => {
        timerElapsedSeconds.update(s => s + 1);
    }, 1000);
}

export function stopTimer(): { startTs: number; endTs: number; durationMin: number } | null {
    if (_interval) clearInterval(_interval);
    _interval = null;
    timerRunning.set(false);

    let startTs: number | null = null;
    let elapsed = 0;
    timerStartTs.subscribe(v => { startTs = v; })();
    timerElapsedSeconds.subscribe(v => { elapsed = v; })();

    if (startTs === null) return null;

    const endTs = startTs + elapsed * 1000;
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    timerStartTs.set(null);
    timerElapsedSeconds.set(0);
    return { startTs, endTs, durationMin };
}

export function cancelTimer() {
    if (_interval) clearInterval(_interval);
    _interval = null;
    timerRunning.set(false);
    timerStartTs.set(null);
    timerElapsedSeconds.set(0);
}

export const timerDisplay = derived(timerElapsedSeconds, (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
});
