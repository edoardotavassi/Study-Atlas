<script lang="ts">
  // values: array of numbers (last N weeks)
  export let values: number[] = [];
  export let color = '#0d968b';

  $: max = Math.max(...values, 1);
  $: bars = values.map(v => ({ height: Math.round((v / max) * 100), value: v }));
</script>

<div class="flex items-end gap-0.5 h-8">
  {#each bars as bar}
    <div
      class="flex-1 rounded-sm min-h-[2px] transition-all"
      style="height: {bar.height}%; background: {color}; opacity: {0.3 + (bar.height / 100) * 0.7}"
      title="{bar.value}m"
    ></div>
  {/each}
</div>
