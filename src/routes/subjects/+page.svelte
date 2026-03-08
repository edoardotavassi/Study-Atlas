<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import TopHeader from "$lib/components/TopHeader.svelte";
  import SparkLine from "$lib/components/Charts/SparkLine.svelte";
  import { getSubjectStats } from "$lib/domain/analytics";
  import {
    upsertSubjectByName,
    listSubjects,
    renameSubject,
    archiveSubject,
    unarchiveSubject,
    deleteSubject,
  } from "$lib/db/repositories/subjects.repo";
  import { showToast, refreshAppTrigger } from "$lib/stores/ui.store";
  import { showConfirm } from "$lib/stores/confirm.store";
  import type { SubjectStat } from "$lib/domain/types";

  import { formatMinutes } from "$lib/db/utils";

  let stats: SubjectStat[] = [];
  let passedStats: SubjectStat[] = [];
  let loading = true;

  $: if ($refreshAppTrigger) load();

  // Add subject
  let newSubjectName = "";
  let showAddForm = false;

  // Context menu
  let menuOpen: string | null = null; // subject id
  let renaming: string | null = null; // subject id
  let renameValue = "";

  async function load() {
    loading = true;
    const all = await getSubjectStats();
    stats = all.filter((s) => !s.subject.archived);
    passedStats = all.filter((s) => s.subject.archived);
    loading = false;
  }

  async function addSubject() {
    if (!newSubjectName.trim()) return;
    await upsertSubjectByName(newSubjectName.trim());
    newSubjectName = "";
    showAddForm = false;
    showToast("Subject added", "success");
    await load();
  }

  function startRename(s: SubjectStat) {
    renaming = s.subject.id;
    renameValue = s.subject.name;
    menuOpen = null;
  }

  async function submitRename(id: string) {
    if (!renameValue.trim()) {
      renaming = null;
      return;
    }
    await renameSubject(id, renameValue.trim());
    renaming = null;
    showToast("Renamed", "success");
    await load();
  }

  async function markPassed(id: string) {
    menuOpen = null;
    await archiveSubject(id);
    showToast("Marked as passed — excluded from planning ✓", "success");
    await load();
  }

  async function reactivate(id: string) {
    menuOpen = null;
    await unarchiveSubject(id);
    showToast("Subject reactivated", "success");
    await load();
  }

  async function handleDelete(id: string, name: string) {
    menuOpen = null;
    const ok = await showConfirm(
      `Delete "${name}" and ALL its sessions? This cannot be undone.`,
      { title: `Delete ${name}?`, confirmLabel: "Delete Subject" },
    );
    if (!ok) return;
    await deleteSubject(id);
    showToast(`"${name}" deleted`, "error");
    await load();
  }

  function toggleMenu(id: string) {
    menuOpen = menuOpen === id ? null : id;
  }

  function stuckColor(rate: number) {
    if (rate >= 30)
      return {
        bg: "rgba(239,68,68,0.08)",
        border: "rgba(239,68,68,0.2)",
        text: "#f87171",
      };
    if (rate >= 15)
      return {
        bg: "rgba(245,158,11,0.08)",
        border: "rgba(245,158,11,0.2)",
        text: "#fbbf24",
      };
    return {
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.2)",
      text: "#34d399",
    };
  }

  onMount(load);
</script>

<svelte:window
  on:click={() => {
    menuOpen = null;
  }}
/>

<TopHeader title="Subjects" />

<main class="flex-1 overflow-y-auto custom-scrollbar p-8">
  {#if loading}
    <div class="flex items-center justify-center h-64 text-slate-500">
      <span class="material-symbols-outlined animate-spin mr-2"
        >progress_activity</span
      > Loading…
    </div>
  {:else}
    <!-- Active Subjects -->
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
    >
      {#each stats as s}
        {@const sc = stuckColor(s.stuckRateLast14)}
        <div
          class="relative text-left rounded-xl border"
          style="background:#121414; border-color:#1f2222;"
        >
          <!-- Header with 3-dot menu -->
          <div class="flex items-center justify-between p-5 pb-3">
            <div
              class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
              on:click={() => goto(`/subjects/${s.subject.id}`)}
              role="button"
              tabindex="0"
              on:keydown={(e) =>
                e.key === "Enter" && goto(`/subjects/${s.subject.id}`)}
            >
              <div
                class="w-3 h-3 rounded-full shrink-0"
                style="background:{s.subject.color ?? '#0d968b'}"
              ></div>
              {#if renaming === s.subject.id}
                <input
                  type="text"
                  bind:value={renameValue}
                  class="flex-1 text-sm font-bold bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white outline-none focus:ring-1 focus:ring-primary"
                  on:click|stopPropagation
                  on:keydown={(e) => {
                    if (e.key === "Enter") submitRename(s.subject.id);
                    if (e.key === "Escape") renaming = null;
                  }}
                  autofocus
                />
              {:else}
                <h3 class="font-bold text-base text-white truncate">
                  {s.subject.name}
                </h3>
              {/if}
            </div>

            <!-- ⋮ menu trigger -->
            <div class="relative shrink-0">
              <button
                class="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                on:click|stopPropagation={() => toggleMenu(s.subject.id)}
              >
                <span class="material-symbols-outlined text-[18px]"
                  >more_vert</span
                >
              </button>

              {#if menuOpen === s.subject.id}
                <div
                  class="absolute right-0 top-9 z-40 w-52 rounded-xl overflow-hidden shadow-2xl"
                  style="background:#1a1c1c; border:1px solid #2a2d2d;"
                >
                  <button
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 transition-colors"
                    on:click|stopPropagation={() => startRename(s)}
                  >
                    <span
                      class="material-symbols-outlined text-base text-slate-400"
                      >edit</span
                    > Rename
                  </button>
                  <button
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                    on:click|stopPropagation={() => markPassed(s.subject.id)}
                  >
                    <span class="material-symbols-outlined text-base"
                      >verified</span
                    > Mark as Passed
                  </button>
                  <div class="my-1 border-t border-white/5"></div>
                  <button
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/5 transition-colors"
                    on:click|stopPropagation={() =>
                      handleDelete(s.subject.id, s.subject.name)}
                  >
                    <span class="material-symbols-outlined text-base"
                      >delete</span
                    > Delete
                  </button>
                </div>
              {/if}
            </div>
          </div>

          <!-- Stats body — click to navigate -->
          <div
            class="px-5 pb-5 cursor-pointer"
            on:click={() => goto(`/subjects/${s.subject.id}`)}
            role="button"
            tabindex="-1"
            on:keydown={() => {}}
          >
            <div class="flex items-baseline gap-2 mb-1">
              <span class="text-2xl font-bold text-white"
                >{formatMinutes(s.minutesThisWeek)}</span
              >
              {#if s.minutesLastWeek > 0}
                {@const delta = s.minutesThisWeek - s.minutesLastWeek}
                <span
                  class="text-xs font-medium"
                  style="color:{delta >= 0 ? '#34d399' : '#f87171'}"
                >
                  {delta >= 0 ? "+" : ""}{Math.round(
                    (delta / s.minutesLastWeek) * 100,
                  )}%
                </span>
              {/if}
            </div>
            <p class="text-xs text-slate-500 mb-4">
              {s.lastStudiedDate
                ? `Last: ${new Date(s.lastStudiedDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : "Never studied"}
            </p>

            <div class="flex items-center justify-between mb-4">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                style="background:{sc.bg}; border-color:{sc.border}; color:{sc.text};"
              >
                Stuck {s.stuckRateLast14}%
              </span>
              <SparkLine values={s.sparklineWeeks} />
            </div>

            {#if s.topTopics.length}
              <div class="flex flex-wrap gap-1.5">
                {#each s.topTopics as topic}
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full text-slate-400"
                    style="background:rgba(255,255,255,0.04);">{topic}</span
                  >
                {/each}
              </div>
            {:else}
              <p class="text-[10px] text-slate-600 italic">
                No topics logged yet
              </p>
            {/if}
          </div>
        </div>
      {/each}

      <!-- Add New Subject card -->
      {#if showAddForm}
        <div
          class="rounded-xl p-5 flex flex-col gap-3 border"
          style="background:#121414; border-color:#1f2222;"
        >
          <input
            type="text"
            bind:value={newSubjectName}
            placeholder="Subject name…"
            autofocus
            class="w-full px-3 py-2 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-primary border border-white/10"
            style="background:rgba(255,255,255,0.05);"
            on:keydown={(e) => e.key === "Enter" && addSubject()}
          />
          <div class="flex gap-2">
            <button
              on:click={addSubject}
              class="flex-1 py-1.5 rounded-lg text-sm font-bold text-white"
              style="background:#0d968b;">Add</button
            >
            <button
              on:click={() => (showAddForm = false)}
              class="px-3 text-slate-400 hover:text-white text-sm"
              >Cancel</button
            >
          </div>
        </div>
      {:else}
        <button
          class="rounded-xl p-5 flex flex-col items-center justify-center gap-3 border-2 border-dashed transition-all hover:border-primary/40 hover:bg-primary/5"
          style="border-color:#1f2222;"
          on:click={() => (showAddForm = true)}
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center"
            style="background:rgba(13,150,139,0.1);"
          >
            <span class="material-symbols-outlined" style="color:#0d968b;"
              >add</span
            >
          </div>
          <p class="text-sm font-semibold text-slate-400">Add subject</p>
        </button>
      {/if}
    </div>

    <!-- Passed / Archived Subjects -->
    {#if passedStats.length > 0}
      <div class="mt-12">
        <div class="flex items-center gap-3 mb-5">
          <span class="material-symbols-outlined text-emerald-400"
            >verified</span
          >
          <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Passed Subjects
          </h2>
          <div class="flex-1 h-px bg-border-dark"></div>
          <span class="text-[10px] text-slate-500 font-medium"
            >Excluded from planning</span
          >
        </div>
        <div
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {#each passedStats as s}
            <div
              class="rounded-xl p-4 flex items-center justify-between border opacity-60"
              style="background:#121414; border-color:#1f2222;"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  style="background:{s.subject.color ?? '#0d968b'}"
                ></div>
                <span class="text-sm font-bold text-slate-300 truncate"
                  >{s.subject.name}</span
                >
                {#if s.subject.passed_at}
                  <span class="text-[9px] text-emerald-400 font-bold shrink-0">
                    Passed {new Date(s.subject.passed_at).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" },
                    )}
                  </span>
                {/if}
              </div>
              <div class="relative shrink-0">
                <button
                  class="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-white/5"
                  on:click|stopPropagation={() => toggleMenu(s.subject.id)}
                >
                  <span class="material-symbols-outlined text-[18px]"
                    >more_vert</span
                  >
                </button>
                {#if menuOpen === s.subject.id}
                  <div
                    class="absolute right-0 top-9 z-40 w-48 rounded-xl overflow-hidden shadow-2xl"
                    style="background:#1a1c1c; border:1px solid #2a2d2d;"
                  >
                    <button
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
                      on:click|stopPropagation={() => reactivate(s.subject.id)}
                    >
                      <span
                        class="material-symbols-outlined text-base text-amber-400"
                        >refresh</span
                      > Reactivate
                    </button>
                    <button
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/5"
                      on:click|stopPropagation={() =>
                        handleDelete(s.subject.id, s.subject.name)}
                    >
                      <span class="material-symbols-outlined text-base"
                        >delete</span
                      > Delete
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</main>
