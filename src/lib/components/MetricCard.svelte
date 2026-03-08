<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let delta: string | null = null;
  export let deltaPositive: boolean | null = null; // null = neutral
</script>

<div class="p-6 rounded-xl bg-card-dark border border-border-dark shadow-sm">
  <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
  <div class="flex items-baseline gap-2">
    <span class="text-3xl font-bold text-white">{value}</span>
    {#if delta}
      <span class="text-xs font-bold
        {deltaPositive === true ? 'text-emerald-500' : deltaPositive === false ? 'text-rose-500' : 'text-slate-400'}">
        {delta}
      </span>
    {/if}
  </div>
</div>
