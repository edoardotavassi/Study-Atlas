<script lang="ts">
  import OutcomePill from "./OutcomePill.svelte";
  import type { Session } from "../domain/types";
  import { timeAgo, formatMinutes } from "../db/utils";

  import {
    showQuickLogModal,
    quickLogPreFill,
    triggerAppRefresh,
  } from "../stores/ui.store";
  import { showConfirm } from "../stores/confirm.store";
  import {
    deleteSession,
    getTopicsBySession,
  } from "../db/repositories/sessions.repo";

  export let session: Session;

  // Subject color → icon background
  const subjectColors = [
    "bg-indigo-500/10 text-indigo-400",
    "bg-emerald-500/10 text-emerald-400",
    "bg-amber-500/10 text-amber-400",
    "bg-purple-500/10 text-purple-400",
    "bg-rose-500/10 text-rose-400",
    "bg-sky-500/10 text-sky-400",
  ];

  function colorClass(name: string) {
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xff;
    return subjectColors[hash % subjectColors.length];
  }

  $: cc = colorClass(session.subject_name ?? session.subject_id);
  $: ago = timeAgo(session.end_ts);
  $: dur = formatMinutes(session.duration_min);

  async function handleDelete() {
    const ok = await showConfirm(
      "Are you sure you want to delete this session? This action cannot be undone.",
      { title: "Delete Session", danger: true },
    );
    if (!ok) return;
    await deleteSession(session.id);
    triggerAppRefresh();
  }

  async function handleEdit() {
    const topics = await getTopicsBySession(session.id);
    quickLogPreFill.set({
      id: session.id,
      subjectName: session.subject_name ?? "",
      topicNames: topics.map((t) => t.name),
      durationMin: session.duration_min,
      startTs: session.start_ts,
      endTs: session.end_ts,
      outcome: session.outcome,
      focus: session.focus,
      note: session.note,
    });
    showQuickLogModal.set(true);
  }
</script>

<div
  class="group p-4 rounded-xl bg-card-dark border border-border-dark flex items-center gap-4 hover:border-primary/30 transition-all relative overflow-hidden"
>
  <!-- Icon -->
  <div
    class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 {cc}"
  >
    <span class="material-symbols-outlined text-lg">menu_book</span>
  </div>

  <!-- Info -->
  <div class="flex-1 min-w-0">
    <p class="text-sm font-bold text-white truncate">
      {session.subject_name ?? "Unknown"}
    </p>
    <p class="text-xs text-slate-500 mt-0.5">
      {ago}
      {#if session.focus != null}
        · Focus: {Math.round((session.focus / 5) * 100)}%
      {/if}
    </p>
    {#if session.note}
      <p class="text-xs text-slate-400 italic mt-0.5 truncate">
        "{session.note}"
      </p>
    {/if}
  </div>

  <!-- Right side (Hidden on hover) -->
  <div
    class="text-right flex flex-col items-end gap-1 flex-shrink-0 transition-opacity duration-200 group-hover:opacity-0 group-hover:pointer-events-none"
  >
    <p class="text-sm font-mono font-bold text-white">{dur}</p>
    <OutcomePill outcome={session.outcome} showLabel={false} />
  </div>

  <!-- Hover Actions -->
  <div
    class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
  >
    <button
      class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors shadow-lg"
      on:click|preventDefault={handleEdit}
    >
      <span class="material-symbols-outlined text-[18px]">edit</span>
    </button>
    <button
      class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 flex items-center justify-center transition-colors shadow-lg"
      on:click|preventDefault={handleDelete}
    >
      <span class="material-symbols-outlined text-[18px]">delete</span>
    </button>
  </div>
</div>
