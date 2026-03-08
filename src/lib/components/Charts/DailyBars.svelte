<script lang="ts">
    import type { HeatmapDay } from "../../domain/types";

    export let days: HeatmapDay[] = [];
    export let year: number;
    export let month: number;

    // Build a full array for every day of the month (fill zeros for missing days)
    $: allDays = (() => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const map = Object.fromEntries(days.map((d) => [d.date, d]));
        const result: {
            date: string;
            day: number;
            minutes: number;
            sessions: number;
            topSubjects: string[];
        }[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const mm = String(month).padStart(2, "0");
            const dd = String(d).padStart(2, "0");
            const key = `${year}-${mm}-${dd}`;
            const entry = map[key];
            result.push({
                date: key,
                day: d,
                minutes: entry?.minutes ?? 0,
                sessions: entry?.sessions ?? 0,
                topSubjects: entry?.topSubjects ?? [],
            });
        }
        return result;
    })();

    $: maxMinutes = Math.max(...allDays.map((d) => d.minutes), 1);

    // Labels: only show day 1, 15, last
    $: labelDays = new Set([1, 15, allDays.length]);

    let hoveredDay: number | null = null; // day number (1-based)

    $: today = new Date().toISOString().slice(0, 10);

    function fmt(date: string) {
        return new Date(date + "T12:00:00")
            .toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
            })
            .toUpperCase()
            .replace(" ", " ");
    }
</script>

<!-- Daily Volume chart matching Stitch design -->
<div class="relative select-none">
    <!-- Chart title -->
    <p
        class="text-[10px] font-bold uppercase tracking-widest mb-4"
        style="color:#4a7a76;"
    >
        Daily Volume (Minutes)
    </p>

    <!-- Bars -->
    <div class="flex items-end gap-px" style="height:120px;">
        {#each allDays as d}
            {@const pct =
                d.minutes > 0 ? Math.max((d.minutes / maxMinutes) * 100, 4) : 0}
            {@const isToday = d.date === today}
            {@const isHovered = hoveredDay === d.day}
            <div
                class="flex-1 relative flex items-end cursor-default"
                style="height:100%;"
                on:mouseenter={() => (hoveredDay = d.day)}
                on:mouseleave={() => (hoveredDay = null)}
                role="presentation"
            >
                <!-- Tooltip -->
                {#if isHovered && d.minutes > 0}
                    <div
                        class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                        style="min-width:100px;"
                    >
                        <div
                            class="rounded-lg px-2.5 py-2 text-[10px] text-white shadow-xl whitespace-nowrap"
                            style="background:#162220; border:1px solid rgba(13,150,139,0.3);"
                        >
                            <p class="font-bold mb-0.5" style="color:#0d968b;">
                                {fmt(d.date)}
                            </p>
                            <p class="font-bold">
                                {d.minutes}m · {d.sessions} session{d.sessions !==
                                1
                                    ? "s"
                                    : ""}
                            </p>
                            {#if d.topSubjects.length}
                                <p style="color:#64748b;" class="mt-0.5">
                                    {d.topSubjects.slice(0, 2).join(", ")}
                                </p>
                            {/if}
                        </div>
                        <!-- Arrow -->
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
              border-radius: 3px 3px 1px 1px;
              background: {isHovered
                            ? '#0d968b'
                            : isToday
                              ? 'rgba(13,150,139,0.8)'
                              : 'rgba(13,150,139,0.35)'};
              box-shadow: {isHovered ? '0 0 8px rgba(13,150,139,0.4)' : 'none'};
            "
                    ></div>
                {:else}
                    <!-- Empty day - tiny dot -->
                    <div
                        class="w-full"
                        style="height:2px; background:rgba(255,255,255,0.03); border-radius:1px;"
                    ></div>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Day labels (only day 1, 15, last) -->
    <div class="flex mt-2" style="padding: 0;">
        {#each allDays as d}
            <div
                class="flex-1 text-center"
                style="font-size:9px; color:#334155; position:relative;"
            >
                {#if labelDays.has(d.day)}
                    <span
                        class="absolute left-1/2 -translate-x-1/2 font-bold whitespace-nowrap"
                        style="color:#475569; font-size:9px;"
                    >
                        {new Date(d.date + "T12:00:00")
                            .toLocaleDateString("en-US", {
                                month: "short",
                                day: "2-digit",
                            })
                            .toUpperCase()}
                    </span>
                {/if}
            </div>
        {/each}
    </div>
    <!-- Spacer for labels -->
    <div style="height:16px;"></div>
</div>
