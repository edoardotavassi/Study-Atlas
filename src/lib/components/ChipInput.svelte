<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let chips: string[] = [];
  export let suggestions: string[] = [];
  export let placeholder = 'Type and press Enter or comma...';
  export let maxChips = 10;

  let inputVal = '';
  let inputEl: HTMLInputElement;

  $: filteredSuggestions = inputVal.trim().length > 0
    ? suggestions.filter(s =>
        s.toLowerCase().includes(inputVal.toLowerCase()) &&
        !chips.includes(s)
      ).slice(0, 6)
    : [];

  function addChip(val: string) {
    const trimmed = val.trim();
    if (!trimmed || chips.includes(trimmed) || chips.length >= maxChips) {
      inputVal = '';
      return;
    }
    chips = [...chips, trimmed];
    inputVal = '';
    dispatch('change', chips);
  }

  function removeChip(chip: string) {
    chips = chips.filter(c => c !== chip);
    dispatch('change', chips);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputVal);
    } else if (e.key === 'Backspace' && inputVal === '' && chips.length > 0) {
      removeChip(chips[chips.length - 1]);
    }
  }
</script>

<div class="relative">
  <div
    class="flex flex-wrap gap-1.5 p-2 min-h-[42px] bg-white/5 rounded-lg border border-white/5
      focus-within:ring-1 focus-within:ring-primary transition-all cursor-text"
    on:click={() => inputEl.focus()}
    role="presentation"
  >
    {#each chips as chip}
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/30">
        {chip}
        <button type="button" on:click|stopPropagation={() => removeChip(chip)}
          class="hover:text-white transition-colors">
          <span class="material-symbols-outlined text-[12px]">close</span>
        </button>
      </span>
    {/each}
    <input
      bind:this={inputEl}
      bind:value={inputVal}
      on:keydown={onKeydown}
      {placeholder}
      class="flex-1 min-w-[80px] bg-transparent border-none p-0 text-sm focus:ring-0 text-slate-200 placeholder:text-slate-600 outline-none"
    />
  </div>

  <!-- Autocomplete dropdown -->
  {#if filteredSuggestions.length > 0}
    <div class="absolute top-full mt-1 left-0 right-0 z-50 bg-slate-900 border border-border-dark rounded-lg shadow-xl overflow-hidden">
      {#each filteredSuggestions as s}
        <button
          type="button"
          class="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors"
          on:click={() => addChip(s)}
        >
          {s}
        </button>
      {/each}
    </div>
  {/if}
</div>
