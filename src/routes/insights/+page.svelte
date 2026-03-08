<script lang="ts">
  import { onMount } from "svelte";
  import TopHeader from "$lib/components/TopHeader.svelte";
  import DonutChart from "$lib/components/Charts/DonutChart.svelte";
  import TutorChat from "$lib/components/TutorChat.svelte";
  import { getInsightsData } from "$lib/domain/analytics";
  import { refreshAppTrigger } from "$lib/stores/ui.store";
  import type { InsightsData } from "$lib/domain/types";
  import { formatMinutes } from "$lib/db/utils";

  let insights: InsightsData | null = null;

  $: if ($refreshAppTrigger) load();

  async function load() {
    insights = await getInsightsData();
  }

  onMount(load);

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
      label: "All Good",
    },
    warning: {
      bg: "rgba(245,158,11,0.06)",
      border: "rgba(245,158,11,0.25)",
      icon: "info",
      iconColor: "#fbbf24",
      label: "Note",
    },
    danger: {
      bg: "rgba(239,68,68,0.06)",
      border: "rgba(239,68,68,0.25)",
      icon: "warning",
      iconColor: "#f87171",
      label: "Risk",
    },
  };
</script>

<TopHeader title="Insights" />

<main class="flex-1 overflow-y-auto custom-scrollbar p-8">
  <div class="max-w-5xl mx-auto space-y-8">
    <header>
      <h1 class="text-3xl font-black text-white mb-1">Insights</h1>
      <p class="text-slate-400">Analytical overview of your study patterns.</p>
    </header>

    <!-- Study Tutor Chat -->
    <TutorChat />

    <!-- Secondary Insight Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Balance Donut -->
      <div class="bg-card-dark border border-border-dark rounded-xl p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-bold text-white">Balance</h3>
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >Last 7d</span
          >
        </div>
        {#if insights?.subjectBalance.length}
          <DonutChart
            segments={insights.subjectBalance.map((s) => ({
              label: s.name,
              value: s.minutes,
              color: s.color,
            }))}
          />
        {:else}
          <p class="text-slate-500 text-sm text-center py-8">No data yet</p>
        {/if}
      </div>

      <!-- Friction / Stuck Topics -->
      <div class="bg-card-dark border border-border-dark rounded-xl p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-bold text-white">Friction</h3>
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-rose-400"
            >Top Stuck</span
          >
        </div>
        {#if insights?.stuckTopics.length}
          <div class="space-y-3">
            {#each insights.stuckTopics as t}
              <div class="p-3 rounded-lg border border-border-dark bg-white/2">
                <p class="text-xs font-bold text-slate-400 mb-2 uppercase">
                  {t.topic}
                </p>
                <div class="flex gap-2">
                  <span
                    class="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-full"
                    >{t.subject}</span
                  >
                  <span
                    class="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-full"
                    >{t.count}× stuck</span
                  >
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-slate-500 text-sm italic py-4">No stuck patterns ✓</p>
        {/if}
      </div>

      <!-- Consistency -->
      <div class="bg-card-dark border border-border-dark rounded-xl p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-bold text-white">Consistency</h3>
          <div class="flex items-center gap-1">
            <span class="text-lg font-black text-primary"
              >{insights?.studyDaysLast30 ?? 0}</span
            >
            <span class="text-[10px] font-bold text-slate-400 uppercase"
              >/ 30 days</span
            >
          </div>
        </div>

        {#if insights}
          <!-- Mini calendar grid (5×6) -->
          <div class="grid grid-cols-7 gap-1.5 mb-6">
            {#each Array(30).fill(0) as _, i}
              <div
                class="aspect-square rounded-sm {i < insights.studyDaysLast30
                  ? 'bg-primary'
                  : 'bg-border-dark/80'}"
              ></div>
            {/each}
          </div>

          <div
            class="pt-4 border-t border-border-dark flex justify-between items-end"
          >
            <div>
              <p
                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"
              >
                Current Streak
              </p>
              <p class="text-xl font-black text-white">
                {insights.streak} Day{insights.streak !== 1 ? "s" : ""}
              </p>
            </div>
            <div class="text-right">
              <p
                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"
              >
                Total 7d
              </p>
              <p class="text-sm font-bold text-primary">
                {formatMinutes(insights.totalLast7d)}
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</main>
