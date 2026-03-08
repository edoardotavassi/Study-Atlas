<script lang="ts">
  import type { Outcome } from '../domain/types';
  export let outcome: Outcome;
  export let showLabel = true;
</script>

{#if outcome === 'done'}
  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
    <span class="material-symbols-outlined text-[14px]">check_circle</span>
    {#if showLabel}Done{/if}
  </span>
{:else if outcome === 'partial'}
  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
    <span class="material-symbols-outlined text-[14px]">remove_circle</span>
    {#if showLabel}Partial{/if}
  </span>
{:else}
  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
    <span class="material-symbols-outlined text-[14px]">cancel</span>
    {#if showLabel}Stuck{/if}
  </span>
{/if}
