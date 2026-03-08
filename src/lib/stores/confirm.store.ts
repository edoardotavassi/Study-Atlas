import { writable } from 'svelte/store';

interface ConfirmState {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    resolve: ((confirmed: boolean) => void) | null;
}

export const confirmState = writable<ConfirmState>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Delete',
    danger: true,
    resolve: null,
});

/** Drop-in replacement for window.confirm() that works in Tauri. Returns a Promise<boolean>. */
export function showConfirm(
    message: string,
    options?: { title?: string; confirmLabel?: string; danger?: boolean }
): Promise<boolean> {
    return new Promise(resolve => {
        confirmState.set({
            open: true,
            title: options?.title ?? 'Are you sure?',
            message,
            confirmLabel: options?.confirmLabel ?? 'Delete',
            danger: options?.danger ?? true,
            resolve,
        });
    });
}
