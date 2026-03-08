<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import TopHeader from "$lib/components/TopHeader.svelte";
  import SessionRow from "$lib/components/SessionRow.svelte";
  import WeeklyBars from "$lib/components/Charts/WeeklyBars.svelte";
  import { getDb } from "$lib/db/client";
  import {
    getSubject,
    archiveSubject,
    unarchiveSubject,
    renameSubject,
    deleteSubject,
  } from "$lib/db/repositories/subjects.repo";
  import { getSessionsBySubject } from "$lib/db/repositories/sessions.repo";
  import {
    listTopicsBySubject,
    renameTopic,
    deleteTopic,
  } from "$lib/db/repositories/topics.repo";
  import { weekStart, daysAgo, formatMinutes } from "$lib/db/utils";
  import { showToast, refreshAppTrigger } from "$lib/stores/ui.store";
  import { showConfirm } from "$lib/stores/confirm.store";
  import { goto } from "$app/navigation";

  import type { Subject, Session, Topic } from "$lib/domain/types";

  let subject: Subject | null = null;
  let sessions: Session[] = [];
  let topics: Topic[] = [];

  $: if ($refreshAppTrigger) load();

  let weeklyBars: { label: string; minutes: number }[] = [];
  let topTopics: { name: string; minutes: number }[] = [];
  let neglectedTopics: string[] = [];
  let stuckTopics: { name: string; count: number }[] = [];
  let filter: "all" | "done" | "partial" | "stuck" = "all";

  // Topic editing state
  let renamingTopic: string | null = null;
  let renameTopicVal = "";
  // Subject editing state
  let renamingSubject = false;
  let renameSubjectVal = "";

  $: subjectId = $page.params.id!;
  $: filteredSessions =
    filter === "all" ? sessions : sessions.filter((s) => s.outcome === filter);

  async function load() {
    const db = await getDb();
    subject = await getSubject(subjectId);
    sessions = await getSessionsBySubject(subjectId);
    topics = await listTopicsBySubject(subjectId);

    // Weekly bars: last 8 weeks
    const now = new Date();
    const bars: { label: string; minutes: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const wS = weekStart(now) - i * 7 * 24 * 60 * 60 * 1000;
      const wE = wS + 7 * 24 * 60 * 60 * 1000 - 1;
      const r = await db.select<{ m: number }[]>(
        `SELECT SUM(duration_min) as m FROM sessions WHERE subject_id = $1 AND start_ts >= $2 AND start_ts <= $3`,
        [subjectId, wS, wE],
      );
      const weekLabel = new Date(wS).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      bars.push({ label: weekLabel, minutes: r[0]?.m ?? 0 });
    }
    weeklyBars = bars;

    const thirtyDaysAgo = daysAgo(30);
    topTopics = await db.select<{ name: string; minutes: number }[]>(
      `SELECT t.name, SUM(s.duration_min) as minutes
       FROM session_topics st JOIN topics t ON st.topic_id = t.id
       JOIN sessions s ON st.session_id = s.id
       WHERE s.subject_id = $1 AND s.start_ts >= $2
       GROUP BY t.id ORDER BY minutes DESC LIMIT 5`,
      [subjectId, thirtyDaysAgo],
    );

    const neglectedRows = await db.select<{ name: string }[]>(
      `SELECT t.name FROM topics t
       WHERE t.subject_id = $1
       AND t.id NOT IN (
         SELECT DISTINCT st.topic_id FROM session_topics st
         JOIN sessions s ON st.session_id = s.id
         WHERE s.subject_id = $1 AND s.start_ts >= $2
       )`,
      [subjectId, daysAgo(14)],
    );
    neglectedTopics = neglectedRows.map((r) => r.name);

    stuckTopics = await db.select<{ name: string; count: number }[]>(
      `SELECT t.name, COUNT(*) as count FROM session_topics st
       JOIN topics t ON st.topic_id = t.id
       JOIN sessions s ON st.session_id = s.id
       WHERE s.subject_id = $1 AND s.outcome = 'stuck' AND s.start_ts >= $2
       GROUP BY t.id ORDER BY count DESC LIMIT 5`,
      [subjectId, thirtyDaysAgo],
    );
  }

  async function handleDeleteTopic(id: string, name: string) {
    const ok = await showConfirm(
      `Remove topic "${name}"? It will be unlinked from all sessions.`,
      { title: `Delete topic?`, confirmLabel: "Delete Topic" },
    );
    if (!ok) return;
    await deleteTopic(id);
    showToast(`Topic "${name}" deleted`, "error");
    await load();
  }

  async function submitTopicRename(id: string) {
    if (!renameTopicVal.trim()) {
      renamingTopic = null;
      return;
    }
    await renameTopic(id, renameTopicVal.trim());
    renamingTopic = null;
    showToast("Topic renamed", "success");
    await load();
  }

  // Subject actions
  async function handleSubjectRename() {
    if (!renameSubjectVal.trim()) {
      renamingSubject = false;
      return;
    }
    await renameSubject(subjectId, renameSubjectVal.trim());
    renamingSubject = false;
    showToast("Renamed", "success");
    await load();
  }

  async function handleMarkPassed() {
    if (!subject) return;
    if (subject.archived) {
      await unarchiveSubject(subjectId);
      showToast("Subject reactivated", "success");
    } else {
      await archiveSubject(subjectId);
      showToast("Marked as passed — excluded from planning ✓", "success");
    }
    await load();
  }

  async function handleDeleteSubject() {
    if (!subject) return;
    const ok = await showConfirm(
      `Delete "${subject.name}" and ALL its sessions? This cannot be undone.`,
      { title: `Delete ${subject.name}?`, confirmLabel: "Delete Subject" },
    );
    if (!ok) return;
    await deleteSubject(subjectId);
    showToast(`"${subject.name}" deleted`, "error");
    goto("/subjects");
  }

  onMount(load);
</script>

<TopHeader title={subject?.name ?? "…"} subtitle="Subject Detail" />

<main class="flex-1 overflow-y-auto custom-scrollbar p-8">
  <div class="max-w-4xl mx-auto space-y-8">
    <!-- Subject Header Actions -->
    {#if subject}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-3 h-3 rounded-full"
            style="background:{subject.color ?? '#0d968b'}"
          ></div>
          {#if renamingSubject}
            <input
              type="text"
              bind:value={renameSubjectVal}
              autofocus
              class="text-xl font-black bg-white/5 border border-white/10 rounded px-3 py-1 text-white outline-none focus:ring-1 focus:ring-primary"
              on:keydown={(e) => {
                if (e.key === "Enter") handleSubjectRename();
                if (e.key === "Escape") renamingSubject = false;
              }}
            />
            <button
              on:click={handleSubjectRename}
              class="px-3 py-1 rounded text-sm font-bold text-white"
              style="background:#0d968b;">Save</button
            >
            <button
              on:click={() => (renamingSubject = false)}
              class="text-slate-400 text-sm">Cancel</button
            >
          {:else}
            <h1 class="text-2xl font-black text-white">{subject.name}</h1>
            {#if subject.archived}
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style="background:rgba(16,185,129,0.1); color:#34d399;"
                >PASSED</span
              >
            {/if}
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <button
            on:click={() => {
              renamingSubject = true;
              renameSubjectVal = subject?.name ?? "";
            }}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors"
            style="background:rgba(255,255,255,0.05);"
          >
            <span class="material-symbols-outlined text-base">edit</span> Rename
          </button>
          <button
            on:click={handleMarkPassed}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={subject.archived
              ? "background:rgba(245,158,11,0.08); color:#fbbf24;"
              : "background:rgba(16,185,129,0.08); color:#34d399;"}
          >
            <span class="material-symbols-outlined text-base"
              >{subject.archived ? "refresh" : "verified"}</span
            >
            {subject.archived ? "Reactivate" : "Mark as Passed"}
          </button>
          <button
            on:click={handleDeleteSubject}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style="background:rgba(239,68,68,0.08); color:#f87171;"
          >
            <span class="material-symbols-outlined text-base">delete</span> Delete
          </button>
        </div>
      </div>
    {/if}

    <!-- Topics management -->
    <section
      class="p-5 rounded-xl border"
      style="background:#121414; border-color:#1f2222;"
    >
      <h3
        class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4"
      >
        All Topics ({topics.length})
      </h3>
      {#if topics.length === 0}
        <p class="text-sm text-slate-500 italic">
          No topics yet — log a session with topic names to create them.
        </p>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each topics as topic}
            {#if renamingTopic === topic.id}
              <div
                class="flex items-center gap-1 rounded-full px-2 py-1"
                style="background:rgba(13,150,139,0.1); border:1px solid rgba(13,150,139,0.3);"
              >
                <input
                  type="text"
                  bind:value={renameTopicVal}
                  autofocus
                  class="text-xs font-medium bg-transparent text-white outline-none w-28"
                  on:keydown={(e) => {
                    if (e.key === "Enter") submitTopicRename(topic.id);
                    if (e.key === "Escape") renamingTopic = null;
                  }}
                />
                <button
                  on:click={() => submitTopicRename(topic.id)}
                  class="text-primary"
                >
                  <span class="material-symbols-outlined text-[14px]"
                    >check</span
                  >
                </button>
                <button
                  on:click={() => (renamingTopic = null)}
                  class="text-slate-500"
                >
                  <span class="material-symbols-outlined text-[14px]"
                    >close</span
                  >
                </button>
              </div>
            {:else}
              <div
                class="flex items-center gap-1.5 rounded-full px-3 py-1 group"
                style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);"
              >
                <span class="text-xs text-slate-300">{topic.name}</span>
                <!-- Edit -->
                <button
                  on:click={() => {
                    renamingTopic = topic.id;
                    renameTopicVal = topic.name;
                  }}
                  class="text-slate-600 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <span class="material-symbols-outlined text-[12px]">edit</span
                  >
                </button>
                <!-- Delete -->
                <button
                  on:click={() => handleDeleteTopic(topic.id, topic.name)}
                  class="text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <span class="material-symbols-outlined text-[12px]"
                    >close</span
                  >
                </button>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </section>

    <!-- Weekly bars -->
    <section
      class="p-6 rounded-2xl border"
      style="background:#121414; border-color:#1f2222;"
    >
      <WeeklyBars weeks={weeklyBars} />
    </section>

    <!-- Topic analytics breakdown -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        class="p-5 rounded-xl border space-y-3"
        style="background:#121414; border-color:#1f2222;"
      >
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500">
          Top Topics (30d)
        </h4>
        {#if topTopics.length}
          {#each topTopics as t}
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-300">{t.name}</span>
              <span class="text-xs font-mono font-bold text-white"
                >{formatMinutes(t.minutes)}</span
              >
            </div>
          {/each}
        {:else}
          <p class="text-sm text-slate-500 italic">No topics logged yet</p>
        {/if}
      </div>

      <div
        class="p-5 rounded-xl border space-y-3"
        style="background:#121414; border-color:#1f2222;"
      >
        <h4
          class="text-xs font-bold uppercase tracking-wider"
          style="color:rgba(245,158,11,0.7);"
        >
          Neglected (14d)
        </h4>
        {#if neglectedTopics.length}
          {#each neglectedTopics as t}
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full" style="background:#f59e0b;"
              ></span>
              <span class="text-sm text-slate-300">{t}</span>
            </div>
          {/each}
        {:else}
          <p class="text-sm italic" style="color:#34d399;">
            All topics covered ✓
          </p>
        {/if}
      </div>

      <div
        class="p-5 rounded-xl border space-y-3"
        style="background:#121414; border-color:#1f2222;"
      >
        <h4
          class="text-xs font-bold uppercase tracking-wider"
          style="color:rgba(239,68,68,0.7);"
        >
          Stuck Topics (30d)
        </h4>
        {#if stuckTopics.length}
          {#each stuckTopics as t}
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-300">{t.name}</span>
              <span
                class="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style="background:rgba(239,68,68,0.1); color:#f87171;"
                >{t.count}×</span
              >
            </div>
          {/each}
        {:else}
          <p class="text-sm italic" style="color:#34d399;">
            No stuck patterns ✓
          </p>
        {/if}
      </div>
    </div>

    <!-- Session history -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-white">Session History</h3>
        <div class="flex gap-1.5">
          {#each ["all", "done", "partial", "stuck"] as const as f}
            <button
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={filter === f
                ? "background:#0d968b; color:white;"
                : "background:#121414; border:1px solid #1f2222; color:#94a3b8;"}
              on:click={() => (filter = f)}
              >{f === "all"
                ? "All"
                : f.charAt(0).toUpperCase() + f.slice(1)}</button
            >
          {/each}
        </div>
      </div>

      {#if filteredSessions.length === 0}
        <p class="text-slate-500 text-sm py-6">No sessions found.</p>
      {:else}
        <div class="space-y-2">
          {#each filteredSessions as session}
            <SessionRow {session} />
          {/each}
        </div>
      {/if}
    </section>
  </div>
</main>
