<script lang="ts">
  import { onMount } from "svelte";
  import TopHeader from "$lib/components/TopHeader.svelte";
  import MetricCard from "$lib/components/MetricCard.svelte";
  import SessionRow from "$lib/components/SessionRow.svelte";
  import WeeklyGoalRing from "$lib/components/WeeklyGoalRing.svelte";
  import PlanBlockEditor from "$lib/components/PlanBlockEditor.svelte";
  import { refreshBrief } from "$lib/stores/brief.store";
  import { showQuickLogModal, refreshAppTrigger } from "$lib/stores/ui.store";
  import { getTodayMetrics } from "$lib/domain/analytics";
  import { getSessionsInRange } from "$lib/db/repositories/sessions.repo";
  import { dayStart, dayEnd, formatMinutes } from "$lib/db/utils";
  import type { TodayMetrics, Session } from "$lib/domain/types";

  let metrics: TodayMetrics | null = null;
  let sessions: Session[] = [];

  $: if ($refreshAppTrigger) load();

  async function load() {
    metrics = await getTodayMetrics();
    sessions = await getSessionsInRange(dayStart(), dayEnd());
    await refreshBrief();
  }

  onMount(load);

  const dateStr = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  function riskSentiment(text: string): "positive" | "warning" | "danger" {
    const t = text.toLowerCase();
    const positive = [
      "on track",
      "great",
      "well done",
      "excellent",
      "good job",
      "keep",
      "consistent",
      "ahead",
      "strong",
      "nice",
      "solid",
    ];
    const danger = [
      "behind",
      "neglect",
      "missed",
      "drop",
      "fail",
      "not study",
      "no session",
      "zero",
      "critical",
      "urgent",
      "at risk",
    ];
    if (positive.some((w) => t.includes(w))) return "positive";
    if (danger.some((w) => t.includes(w))) return "danger";
    return "warning";
  }

  const riskStyles = {
    positive: {
      bg: "rgba(16,185,129,0.06)",
      border: "rgba(16,185,129,0.25)",
      icon: "check_circle",
      iconColor: "#34d399",
    },
    warning: {
      bg: "rgba(245,158,11,0.06)",
      border: "rgba(245,158,11,0.25)",
      icon: "info",
      iconColor: "#fbbf24",
    },
    danger: {
      bg: "rgba(239,68,68,0.06)",
      border: "rgba(239,68,68,0.25)",
      icon: "warning",
      iconColor: "#f87171",
    },
  };
</script>

<TopHeader title="Today" subtitle={dateStr} />

<main class="flex-1 overflow-y-auto custom-scrollbar p-8">
  <div class="max-w-5xl mx-auto space-y-8">
    <!-- Metric Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard label="Minutes Logged" value={metrics?.minutesLogged ?? 0} />
      <MetricCard label="Sessions" value={metrics?.sessionsCount ?? 0} />
      <MetricCard
        label="Focus Avg"
        value={metrics?.focusAvg != null ? `${metrics.focusAvg}%` : "—"}
      />
      <MetricCard
        label="Weekly Progress"
        value={`${metrics?.weeklyProgressPercent ?? 0}%`}
        delta={metrics?.weeklyProgressPercent != null
          ? metrics.weeklyProgressPercent >= 50
            ? "+on track"
            : "keep going"
          : null}
        deltaPositive={metrics?.weeklyProgressPercent != null
          ? metrics.weeklyProgressPercent >= 50
          : null}
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left: Today Plan + Sessions -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Today's Plan card -->
        <div
          class="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 relative overflow-hidden"
        >
          <PlanBlockEditor />
        </div>

        <!-- Session Timeline -->
        <div>
          <h3 class="text-lg font-bold mb-4 px-1 text-white">
            Session Timeline
          </h3>
          {#if sessions.length === 0}
            <div
              class="p-8 rounded-xl border border-dashed border-border-dark text-center text-slate-500"
            >
              <span
                class="material-symbols-outlined text-4xl text-slate-700 block mb-2"
                >history</span
              >
              <p class="text-sm">No sessions logged today.</p>
              <button
                class="mt-3 text-xs text-primary hover:underline"
                on:click={() => showQuickLogModal.set(true)}
                >Log your first session →</button
              >
            </div>
          {:else}
            <div class="space-y-3">
              {#each sessions as session}
                <SessionRow {session} />
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Right Panel -->
      <div class="space-y-6">
        <!-- Weekly Goal Ring -->
        {#if metrics}
          <WeeklyGoalRing
            percent={metrics.weeklyProgressPercent}
            hoursLogged={metrics.weeklyMinutes}
            hoursGoal={metrics.weeklyGoalMinutes}
          />
        {/if}

        <!-- Streak card -->
        {#if metrics}
          <div class="p-6 rounded-2xl bg-card-dark border border-border-dark">
            <div class="flex items-center justify-between mb-4">
              <div>
                <p
                  class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  Current Streak
                </p>
                <p class="text-2xl font-black text-amber-500 mt-0.5">
                  {metrics.streak} Day{metrics.streak !== 1 ? "s" : ""}
                </p>
              </div>
              <span class="material-symbols-outlined text-amber-500 text-4xl"
                >local_fire_department</span
              >
            </div>
            <div
              class="h-1.5 w-full bg-border-dark rounded-full overflow-hidden"
            >
              <div
                class="h-full bg-amber-500 rounded-full transition-all"
                style="width: {Math.min(100, (metrics.streak / 30) * 100)}%"
              ></div>
            </div>
            <p
              class="text-[10px] text-slate-500 mt-2 text-right font-bold uppercase tracking-wider"
            >
              {30 - metrics.streak > 0
                ? `${30 - metrics.streak} days to 30-day goal`
                : "30-day goal reached!"}
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</main>
