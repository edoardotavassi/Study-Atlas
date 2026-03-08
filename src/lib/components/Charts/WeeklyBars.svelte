<script lang="ts">
  export let weeks: { label: string; minutes: number }[] = [];

  $: max = Math.max(...weeks.map((w) => w.minutes), 1);

  let hoveredIdx: number | null = null;

  $: labelSet = (() => {
    // Show first, middle, last label
    if (weeks.length <= 3) return new Set(weeks.map((_, i) => i));
    return new Set([0, Math.floor(weeks.length / 2), weeks.length - 1]);
  })();
</script>

<div class="relative select-none">
  <p
    class="text-[10px] font-bold uppercase tracking-widest mb-4"
    style="color:#4a7a76;"
  >
    Study Volume — Last {weeks.length} Weeks
  </p>

  <!-- Bars -->
  <div class="flex items-end gap-1" style="height:120px;">
    {#each weeks as week, i}
      {@const pct =
        week.minutes > 0 ? Math.max((week.minutes / max) * 100, 4) : 0}
      {@const isHovered = hoveredIdx === i}
      <div
        class="flex-1 relative flex items-end cursor-default"
        style="height:100%;"
        on:mouseenter={() => (hoveredIdx = i)}
        on:mouseleave={() => (hoveredIdx = null)}
        role="presentation"
      >
        <!-- Tooltip -->
        {#if isHovered && week.minutes > 0}
          <div
            class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap"
          >
            <div
              class="rounded-lg px-2.5 py-2 text-[10px] text-white shadow-xl"
              style="background:#162220; border:1px solid rgba(13,150,139,0.3);"
            >
              <p class="font-bold mb-0.5" style="color:#0d968b;">
                {week.label}
              </p>
              <p class="font-bold">
                {week.minutes}m · {Math.floor(week.minutes / 60)}h {week.minutes %
                  60}m
              </p>
            </div>
            <div
              class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
              style="border-left:4px solid transparent; border-right:4px solid transparent; border-top:4px solid rgba(13,150,139,0.3);"
            ></div>
          </div>
        {/if}

        <!-- Bar -->
        {#if pct > 0}
          <div
            class="w-full transition-all duration-150"
            style="
              height: {pct}%;
              border-radius: 4px 4px 2px 2px;
              background: {isHovered ? '#0d968b' : 'rgba(13,150,139,0.35)'};
              box-shadow: {isHovered
              ? '0 0 10px rgba(13,150,139,0.4)'
              : 'none'};
            "
          ></div>
        {:else}
          <div
            class="w-full"
            style="height:2px; background:rgba(255,255,255,0.03); border-radius:1px;"
          ></div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Labels -->
  <div class="flex mt-2 relative" style="height:16px;">
    {#each weeks as week, i}
      <div class="flex-1 relative">
        {#if labelSet.has(i)}
          <span
            class="absolute left-1/2 -translate-x-1/2 font-bold whitespace-nowrap"
            style="font-size:9px; color:#475569; top:0;"
          >
            {week.label}
          </span>
        {/if}
      </div>
    {/each}
  </div>
</div>
