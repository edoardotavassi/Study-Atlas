<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    showQuickLogModal,
    quickLogPreFill,
    showToast,
    triggerAppRefresh,
  } from "../stores/ui.store";
  import ChipInput from "./ChipInput.svelte";
  import OutcomePill from "./OutcomePill.svelte";
  import {
    upsertSubjectByName,
    listSubjects,
  } from "../db/repositories/subjects.repo";
  import {
    upsertTopic,
    listTopicsBySubject,
  } from "../db/repositories/topics.repo";
  import {
    createSession,
    updateSession,
  } from "../db/repositories/sessions.repo";
  import type { Subject, Outcome } from "../domain/types";

  const dispatch = createEventDispatcher();

  let preFill = $quickLogPreFill;
  const isEditing = !!preFill?.id;

  // Form state
  let durationPreset: 25 | 50 | 90 | null = preFill?.durationMin ? null : 25;
  let customDuration = preFill?.durationMin ? String(preFill.durationMin) : "";
  let subjectName = preFill?.subjectName ?? "";
  let topicNames: string[] = preFill?.topicNames ? [...preFill.topicNames] : [];
  let outcome: Outcome = preFill?.outcome ?? "done";
  let note = preFill?.note ?? "";
  let focusLevel = preFill?.focus ?? 3;
  let saving = false;

  $: durationMin = durationPreset ?? (parseInt(customDuration) || 25);

  let subjects: Subject[] = [];
  let topicSuggestions: string[] = [];

  onMount(async () => {
    subjects = await listSubjects();
    preFill = $quickLogPreFill;
    if (preFill) {
      if (preFill.durationMin) {
        customDuration = String(preFill.durationMin);
        durationPreset = null;
      }
      subjectName = preFill.subjectName ?? "";
      topicNames = preFill.topicNames ? [...preFill.topicNames] : [];
      outcome = preFill.outcome ?? "done";
      note = preFill.note ?? "";
      focusLevel = preFill.focus ?? 3;
    }
  });

  async function loadTopics() {
    if (!subjectName.trim()) {
      topicSuggestions = [];
      return;
    }
    const existing = subjects.find(
      (s) => s.name.toLowerCase() === subjectName.trim().toLowerCase(),
    );
    if (existing) {
      const topics = await listTopicsBySubject(existing.id);
      topicSuggestions = topics.map((t) => t.name);
    }
  }

  $: subjectName, loadTopics();

  $: subjectSuggestions = subjects.map((s) => s.name);

  async function handleSave() {
    if (!subjectName.trim()) {
      showToast("Please enter a subject", "error");
      return;
    }
    saving = true;
    try {
      const subject = await upsertSubjectByName(subjectName.trim());
      const topicIds: string[] = [];
      for (const name of topicNames) {
        const t = await upsertTopic(subject.id, name);
        topicIds.push(t.id);
      }

      const sessionInput = {
        subject_id: subject.id,
        start_ts: preFill?.startTs ?? Date.now() - durationMin * 60 * 1000,
        end_ts: preFill?.endTs ?? Date.now(),
        duration_min: durationMin,
        outcome,
        focus: focusLevel,
        note: note.trim() || null,
        topic_ids: topicIds,
      };

      if (isEditing && preFill?.id) {
        await updateSession(preFill.id, sessionInput);
        showToast("Session updated!", "success");
      } else {
        await createSession(sessionInput);
        showToast("Session logged!", "success");
      }

      showQuickLogModal.set(false);
      quickLogPreFill.set(null);
      // Escape Svelte's synchronous batch to ensure store update triggers across isolated pages
      setTimeout(() => {
        triggerAppRefresh();
        dispatch("saved");
      }, 50);
    } catch (e) {
      console.error(e);
      showToast("Failed to save session", "error");
    } finally {
      saving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      showQuickLogModal.set(false);
      quickLogPreFill.set(null);
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  }

  function closeModal() {
    showQuickLogModal.set(false);
    quickLogPreFill.set(null);
  }

  const focusLabels = ["Distracted", "Low", "OK", "Good", "Deep"];
</script>

<svelte:window on:keydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
  on:keydown={(e) => e.key === "Escape" && closeModal()}
  role="dialog"
  aria-modal="true"
  aria-label="Log Study Session"
  tabindex="-1"
>
  <div
    class="w-full max-w-[480px] rounded-xl border flex flex-col overflow-hidden"
    style="background:#111a19; border-color:rgba(255,255,255,0.1); box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.6);"
  >
    <!-- Header -->
    <div class="px-6 pt-5 pb-3 flex justify-between items-center">
      <h3 class="text-lg font-bold tracking-tight text-white">
        {isEditing ? "Edit Study Session" : "Log Study Session"}
      </h3>
      <button
        on:click={closeModal}
        class="text-slate-500 hover:text-white transition-colors"
      >
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
    </div>

    <!-- ... (rest of modal content) ... -->
    <div class="px-6 pb-6 space-y-5 overflow-y-auto max-h-[80vh]">
      <!-- Duration -->
      <div class="space-y-2">
        <span
          class="text-[10px] font-bold uppercase tracking-widest text-slate-500 block"
          >Duration</span
        >
        <div class="grid grid-cols-4 gap-2">
          {#each [25, 50, 90] as const as preset}
            <button
              type="button"
              class="py-2.5 rounded-lg text-sm font-bold transition-all
                {durationPreset === preset
                ? 'text-white'
                : 'text-slate-300 hover:text-white'}"
              style={durationPreset === preset
                ? "background:#0d968b; box-shadow:0 4px 12px rgba(13,150,139,0.3);"
                : "background:rgba(255,255,255,0.05);"}
              on:click={() => {
                durationPreset = preset;
                customDuration = "";
              }}>{preset}m</button
            >
          {/each}
          <input
            type="number"
            bind:value={customDuration}
            placeholder="min"
            min="1"
            max="480"
            on:input={() => (durationPreset = null)}
            class="py-2.5 px-2 rounded-lg text-sm text-slate-200 text-center outline-none border-none focus:ring-1 focus:ring-primary"
            style="background:rgba(255,255,255,0.05);"
          />
        </div>
      </div>

      <!-- Subject & Topics -->
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label
            for="subject-input"
            class="text-[10px] font-bold uppercase tracking-widest text-slate-500 block"
            >Subject</label
          >
          <input
            id="subject-input"
            type="text"
            bind:value={subjectName}
            placeholder="e.g. MIDA…"
            list="subject-suggestions"
            class="w-full py-2.5 px-3 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 outline-none border-none focus:ring-1 focus:ring-primary"
            style="background:rgba(255,255,255,0.05);"
          />
          <datalist id="subject-suggestions">
            {#each subjectSuggestions as s}<option value={s}></option>{/each}
          </datalist>
        </div>
        <div class="space-y-1.5">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-slate-500 block"
            >Topics</span
          >
          <ChipInput
            bind:chips={topicNames}
            suggestions={topicSuggestions}
            placeholder="Add topics…"
          />
        </div>
      </div>

      <!-- Outcome -->
      <div class="space-y-1.5">
        <span
          class="text-[10px] font-bold uppercase tracking-widest text-slate-500 block"
          >Outcome</span
        >
        <div class="grid grid-cols-3 gap-2">
          {#each ["done", "partial", "stuck"] as Outcome[] as opt}
            <button
              type="button"
              class="py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5"
              style={outcome === opt
                ? opt === "done"
                  ? "background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.4); color:#34d399;"
                  : opt === "partial"
                    ? "background:rgba(245,158,11,0.15); border-color:rgba(245,158,11,0.4); color:#fbbf24;"
                    : "background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.4); color:#f87171;"
                : "background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.08); color:#64748b;"}
              on:click={() => (outcome = opt)}
            >
              <span class="material-symbols-outlined text-[15px]">
                {opt === "done"
                  ? "check_circle"
                  : opt === "partial"
                    ? "remove_circle"
                    : "cancel"}
              </span>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          {/each}
        </div>
      </div>

      <!-- Note -->
      <div class="space-y-1.5">
        <label
          for="session-note"
          class="text-[10px] font-bold uppercase tracking-widest text-slate-500 block"
          >Note</label
        >
        <input
          id="session-note"
          type="text"
          bind:value={note}
          placeholder="Brief summary…"
          class="w-full py-2.5 px-3 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 outline-none border-none focus:ring-1 focus:ring-primary"
          style="background:rgba(255,255,255,0.05);"
        />
      </div>

      <!-- Focus (always visible) -->
      <div
        class="rounded-xl p-4 space-y-3"
        style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05);"
      >
        <div class="flex justify-between items-center">
          <label
            for="focus-range"
            class="text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >Focus</label
          >
          <span
            class="text-xs font-bold px-2 py-0.5 rounded-full"
            style="background:rgba(13,150,139,0.15); color:#0d968b;"
          >
            {focusLabels[focusLevel - 1]}
          </span>
        </div>
        <input
          id="focus-range"
          type="range"
          bind:value={focusLevel}
          min="1"
          max="5"
          step="1"
          class="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style="accent-color:#0d968b; background:rgba(255,255,255,0.1);"
        />
        <div
          class="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-wider"
        >
          {#each focusLabels as l}<span>{l}</span>{/each}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="px-6 py-4 border-t flex items-center justify-between"
      style="background:rgba(0,0,0,0.2); border-color:rgba(255,255,255,0.05);"
    >
      <button
        type="button"
        on:click={closeModal}
        class="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >Cancel</button
      >
      <div class="flex items-center gap-3">
        <span class="text-[10px] text-slate-600 hidden md:block"
          >⌘↵ to save</span
        >
        <button
          type="button"
          on:click={handleSave}
          disabled={saving}
          class="px-7 py-2.5 rounded-lg text-white text-sm font-bold transition-all disabled:opacity-50"
          style="background:#0d968b; box-shadow:0 4px 14px rgba(13,150,139,0.3);"
        >
          {saving ? "Saving…" : isEditing ? "Update Log" : "Save Log"}
        </button>
      </div>
    </div>
  </div>
</div>
