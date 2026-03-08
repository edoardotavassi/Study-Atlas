<script lang="ts">
    import { confirmState } from "../stores/confirm.store";

    function answer(confirmed: boolean) {
        confirmState.update((s) => {
            s.resolve?.(confirmed);
            return { ...s, open: false, resolve: null };
        });
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!$confirmState.open) return;
        if (e.key === "Enter") answer(true);
        if (e.key === "Escape") answer(false);
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $confirmState.open}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style="background:rgba(0,0,0,0.6); backdrop-filter:blur(6px);"
        on:click|self={() => answer(false)}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div
            class="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style="background:#161a1a; border:1px solid rgba(255,255,255,0.08); box-shadow: 0 24px 64px rgba(0,0,0,0.7);"
        >
            <!-- Icon -->
            <div class="flex items-center gap-3 mb-4">
                <div
                    class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style="background:{$confirmState.danger
                        ? 'rgba(239,68,68,0.1)'
                        : 'rgba(245,158,11,0.1)'};"
                >
                    <span
                        class="material-symbols-outlined text-xl"
                        style="color:{$confirmState.danger
                            ? '#f87171'
                            : '#fbbf24'};"
                    >
                        {$confirmState.danger ? "delete_forever" : "warning"}
                    </span>
                </div>
                <h3 class="text-base font-bold text-white">
                    {$confirmState.title}
                </h3>
            </div>

            <p class="text-sm text-slate-400 leading-relaxed mb-6">
                {$confirmState.message}
            </p>

            <div class="flex gap-3">
                <button
                    class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                    style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);"
                    on:click={() => answer(false)}
                >
                    Cancel
                </button>
                <button
                    class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                    style="background:{$confirmState.danger
                        ? '#ef4444'
                        : '#f59e0b'};
            box-shadow:0 4px 14px {$confirmState.danger
                        ? 'rgba(239,68,68,0.3)'
                        : 'rgba(245,158,11,0.3)'};"
                    on:click={() => answer(true)}
                >
                    {$confirmState.confirmLabel}
                </button>
            </div>
        </div>
    </div>
{/if}
