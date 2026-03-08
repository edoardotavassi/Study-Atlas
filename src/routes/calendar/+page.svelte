<script lang="ts">
  import { onMount } from "svelte";
  import TopHeader from "$lib/components/TopHeader.svelte";
  import HeatmapCalendar from "$lib/components/HeatmapCalendar.svelte";
  import DailyBars from "$lib/components/Charts/DailyBars.svelte";
  import OutcomePill from "$lib/components/OutcomePill.svelte";
  import { getHeatmapData } from "$lib/domain/analytics";
  import {
    getDailyTotals,
    getSessionsInRange,
  } from "$lib/db/repositories/sessions.repo";
  import { listSubjects } from "$lib/db/repositories/subjects.repo";
  import type { HeatmapDay, Session, Subject } from "$lib/domain/types";
  import { weekStart, weekEnd, daysAgo } from "$lib/db/utils";
  import { refreshAppTrigger } from "$lib/stores/ui.store";

  let now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  let heatmapDays: HeatmapDay[] = [];
  let subjects: Subject[] = [];
  let selectedSubject: string = "All";
  let sessions: Session[] = [];
  let filteredSessions: Session[] = [];

  $: if ($refreshAppTrigger) load();

  async function load() {
    heatmapDays = await getHeatmapData(year, month);
    subjects = await listSubjects();

    sessions = await getSessionsInRange(daysAgo(31), Date.now());
    applyFilter();
  }

  function applyFilter() {
    filteredSessions =
      selectedSubject === "All"
        ? sessions
        : sessions.filter((s) => s.subject_name === selectedSubject);
  }

  $: selectedSubject, applyFilter();

  function prevMonth() {
    if (month === 1) {
      month = 12;
      year--;
    } else month--;
    load();
  }
  function nextMonth() {
    if (month === 12) {
      month = 1;
      year++;
    } else month--;
    month = month + 1 > 12 ? 1 : month + 1;
    // simpler:
    const d = new Date(year, month, 1);
    year = d.getFullYear();
    month = d.getMonth() + 1;
    load();
  }

  onMount(load);

  $: monthName = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
  });

  function goToToday() {
    const d = new Date();
    year = d.getFullYear();
    month = d.getMonth() + 1;
    load();
  }
</script>

<TopHeader title="Calendar" subtitle="{monthName} {year}" />

<div class="flex flex-1 overflow-hidden">
  <!-- Main -->
  <main
    class="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10 max-w-4xl"
  >
    <!-- Month nav -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-1">
        <button
          on:click={prevMonth}
          class="p-1.5 rounded-lg hover:bg-card-dark text-slate-400 hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 class="text-base font-bold text-white min-w-[120px] text-center">
          {monthName}
          {year}
        </h2>
        <button
          on:click={nextMonth}
          class="p-1.5 rounded-lg hover:bg-card-dark text-slate-400 hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      <button
        on:click={goToToday}
        class="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest uppercase transition-colors text-slate-400 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20"
      >
        Today
      </button>
    </div>

    <!-- Heatmap -->
    <section class="p-6 rounded-2xl bg-card-dark border border-border-dark">
      <HeatmapCalendar {year} {month} days={heatmapDays} />
    </section>

    <section
      class="p-6 rounded-2xl border"
      style="background:#121414; border-color:#1f2222;"
    >
      <DailyBars days={heatmapDays} {year} {month} />
    </section>

    <!-- Recent Sessions list -->
    <section>
      <h3
        class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4"
      >
        Recent Sessions
      </h3>
      {#if filteredSessions.length === 0}
        <p class="text-slate-500 text-sm">No sessions found.</p>
      {:else}
        <div class="space-y-2">
          {#each filteredSessions.slice(0, 30) as session}
            <div
              class="p-3 rounded-xl bg-card-dark border border-border-dark flex items-center gap-4"
            >
              <div class="flex-1">
                <p class="text-sm font-bold text-white">
                  {session.subject_name}
                </p>
                <p class="text-xs text-slate-500">
                  {new Date(session.start_ts).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })} · {session.duration_min}m
                </p>
              </div>
              <OutcomePill outcome={session.outcome} />
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </main>

  <!-- Right Filter Panel -->
  <aside
    class="w-64 border-l border-border-dark flex flex-col overflow-y-auto no-scrollbar p-6 space-y-6"
  >
    <div>
      <p
        class="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider"
      >
        Subjects
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          class="px-3 py-1 rounded-full text-xs font-medium transition-colors
            {selectedSubject === 'All'
            ? 'bg-primary text-white'
            : 'border border-border-dark text-slate-400 hover:bg-primary/10'}"
          on:click={() => (selectedSubject = "All")}>All</button
        >
        {#each subjects as s}
          <button
            class="px-3 py-1 rounded-full text-xs font-medium transition-colors
              {selectedSubject === s.name
              ? 'bg-primary text-white'
              : 'border border-border-dark text-slate-400 hover:bg-primary/10'}"
            on:click={() => (selectedSubject = s.name)}>{s.name}</button
          >
        {/each}
      </div>
    </div>

    <!-- Monthly stats -->
    <div class="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase">
          Total Study Time
        </p>
        <p class="text-2xl font-bold text-white">
          {Math.floor(heatmapDays.reduce((s, d) => s + d.minutes, 0) / 60)}h {heatmapDays.reduce(
            (s, d) => s + d.minutes,
            0,
          ) % 60}m
        </p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase">Sessions</p>
        <p class="text-lg font-bold text-white">
          {heatmapDays.reduce((s, d) => s + d.sessions, 0)}
        </p>
      </div>
    </div>
  </aside>
</div>
