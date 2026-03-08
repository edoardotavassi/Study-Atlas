<script lang="ts">
  import type { HeatmapDay } from "../domain/types";

  export let year: number;
  export let month: number; // 1-12
  export let days: HeatmapDay[] = [];

  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // These reactive declarations are tracked by Svelte
  $: dayMap = Object.fromEntries(days.map((d) => [d.date, d]));
  $: maxMinutes = Math.max(...days.map((d) => d.minutes), 1);

  $: calendarDays = (() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
    const cells: (string | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const mm = String(month).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      cells.push(`${year}-${mm}-${dd}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  })();

  let hoveredDate: string | null = null;
  $: today = new Date().toISOString().slice(0, 10);
  $: monthName = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
  });
</script>

<div>
  <!-- Header + legend -->
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">
      Activity — {monthName}
      {year}
    </h3>
    <div
      class="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold"
    >
      <span>Less</span>
      <div class="flex gap-1">
        <div
          class="size-3 rounded-sm"
          style="background:rgba(13,150,139,0.15)"
        ></div>
        <div
          class="size-3 rounded-sm"
          style="background:rgba(13,150,139,0.40)"
        ></div>
        <div
          class="size-3 rounded-sm"
          style="background:rgba(13,150,139,0.70)"
        ></div>
        <div
          class="size-3 rounded-sm"
          style="background:rgba(13,150,139,1.00)"
        ></div>
      </div>
      <span>More</span>
    </div>
  </div>

  <!-- Day-of-week labels -->
  <div class="grid grid-cols-7 gap-1.5 mb-1">
    {#each WEEKDAYS as day}
      <div class="text-center text-[9px] font-bold text-slate-500 uppercase">
        {day}
      </div>
    {/each}
  </div>

  <!-- Calendar grid — styles computed INLINE so Svelte tracks dayMap/maxMinutes reactively -->
  <div class="grid grid-cols-7 gap-1.5">
    {#each calendarDays as date}
      {@const data = date ? (dayMap[date] ?? null) : null}
      {@const minutes = data?.minutes ?? 0}
      {@const ratio = minutes > 0 ? minutes / maxMinutes : 0}
      {@const bg =
        date === null
          ? "transparent"
          : minutes > 0
            ? `rgba(13,150,139,${(0.15 + ratio * 0.85).toFixed(2)})`
            : "#1f2222"}
      {@const ring =
        date === today ? "outline:2px solid #0d968b; outline-offset:2px;" : ""}
      <div
        class="aspect-square rounded-md cursor-default relative group"
        style="background:{bg};{ring}{date === null
          ? 'visibility:hidden;'
          : ''}"
        on:mouseenter={() => {
          if (date && data) hoveredDate = date;
        }}
        on:mouseleave={() => (hoveredDate = null)}
        role="presentation"
      >
        {#if data && hoveredDate === date}
          <div
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-44
            bg-slate-900 border border-[#1f2222] text-white p-2.5 rounded-xl shadow-2xl pointer-events-none"
          >
            <p class="text-[10px] font-bold mb-1" style="color:#0d968b;">
              {new Date(date + "T12:00:00")
                .toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
                .toUpperCase()}
            </p>
            <p class="text-xs font-bold">
              {data.minutes}m · {data.sessions} session{data.sessions !== 1
                ? "s"
                : ""}
            </p>
            {#if data.topSubjects.length}
              <p class="text-[10px] text-slate-400 mt-1">
                {data.topSubjects.join(", ")}
              </p>
            {/if}
            <div
              class="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"
            ></div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
