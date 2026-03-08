<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        todayBrief,
        briefSource,
        briefLoading,
        thinkingText,
        isStreaming,
        planEditing,
        planCommentLoading,
        editPlan,
        refreshBrief,
        planStartedAt,
    } from "$lib/stores/brief.store";
    import {
        showQuickLogModal,
        quickLogPreFill,
        refreshAppTrigger,
    } from "$lib/stores/ui.store";
    import {
        startTimer,
        stopTimer,
        timerRunning,
    } from "$lib/stores/timer.store";
    import { listSubjects } from "$lib/db/repositories/subjects.repo";
    import { getSessionsInRange } from "$lib/db/repositories/sessions.repo";
    import { dayStart, dayEnd } from "$lib/db/utils";
    import type { PlanBlock, Subject } from "$lib/domain/types";

    // Local editable copy of blocks
    let editBlocks: PlanBlock[] = [];
    // Subjects for autocomplete
    let subjects: Subject[] = [];
    // Subjects completed today (normalized lowercase names)
    let completedSubjectNames: Set<string> = new Set();

    // Reset editing state when this component mounts (navigation fix)
    onMount(async () => {
        planEditing.set(false);
        subjects = await listSubjects();
        // Only sessions since the plan was loaded count as "done"
        const sessions = await getSessionsInRange($planStartedAt, dayEnd());
        completedSubjectNames = new Set(
            sessions.map((s) => (s.subject_name ?? "").toLowerCase()),
        );
    });

    // Refresh completed subjects when sessions change — only count sessions since plan loaded
    $: if ($refreshAppTrigger) {
        getSessionsInRange($planStartedAt, dayEnd()).then((sessions) => {
            completedSubjectNames = new Set(
                sessions.map((s) => (s.subject_name ?? "").toLowerCase()),
            );
        });
    }

    $: subjectNames = subjects.map((s) => s.name);

    function startEditing() {
        if (!$todayBrief) return;
        editBlocks = $todayBrief.blocks.map((b) => ({
            ...b,
            topics: [...b.topics],
        }));
        planEditing.set(true);
    }

    function cancelEditing() {
        planEditing.set(false);
        editBlocks = [];
    }

    function addBlock() {
        editBlocks = [
            ...editBlocks,
            { subject: "", minutes: 25, topics: [], task: "" },
        ];
    }

    function removeBlock(i: number) {
        editBlocks = editBlocks.filter((_, idx) => idx !== i);
    }

    async function handleSave() {
        const valid = editBlocks.every(
            (b) => b.subject.trim() && b.minutes > 0,
        );
        if (!valid) return;
        await editPlan(editBlocks, $todayBrief!);
    }

    // Track which block subject we are currently timing
    let activeTimerSubject: string | null = null;

    /**
     * Start button: starts the timer for this block, does NOT open the modal.
     * The button converts to a Stop button.
     */
    function handleStart(block: PlanBlock) {
        startTimer();
        activeTimerSubject = block.subject;
    }

    /**
     * Stop button: stops the timer and opens the Quick Log modal pre-filled
     * with the subject and elapsed duration.
     */
    function handleStop(block: PlanBlock) {
        const result = stopTimer();
        activeTimerSubject = null;
        quickLogPreFill.set({
            subjectName: block.subject,
            durationMin: result?.durationMin,
            startTs: result?.startTs,
            endTs: result?.endTs,
        });
        showQuickLogModal.set(true);
    }

    /** Find the index of the first block NOT yet completed */
    $: activeBlockIndex = (() => {
        if (!$todayBrief) return 0;
        const idx = $todayBrief.blocks.findIndex(
            (b) => !completedSubjectNames.has(b.subject.toLowerCase()),
        );
        return idx === -1 ? $todayBrief.blocks.length : idx;
    })();

    function riskSentiment(text: string): "positive" | "warning" | "danger" {
        const t = text.toLowerCase();
        if (
            [
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
            ].some((k) => t.includes(k))
        )
            return "positive";
        if (
            [
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
            ].some((k) => t.includes(k))
        )
            return "danger";
        return "warning";
    }

    const riskStyles = {
        positive: {
            bg: "rgba(16,185,129,0.08)",
            border: "rgba(16,185,129,0.25)",
            iconColor: "#34d399",
            icon: "check_circle",
        },
        warning: {
            bg: "rgba(245,158,11,0.08)",
            border: "rgba(245,158,11,0.25)",
            iconColor: "#fbbf24",
            icon: "warning",
        },
        danger: {
            bg: "rgba(239,68,68,0.08)",
            border: "rgba(239,68,68,0.25)",
            iconColor: "#f87171",
            icon: "emergency_home",
        },
    };

    const MINUTE_OPTIONS = [25, 50, 90];
</script>

<!-- Header row -->
<div class="flex items-center justify-between mb-5">
    <div class="flex items-center gap-2">
        <span
            class="px-2 py-1 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest"
        >
            {$briefSource === "llm" ? "AI Assisted" : "Smart Plan"}
        </span>
    </div>
    {#if !$planEditing && !$briefLoading}
        <div class="flex items-center gap-1">
            <button
                on:click={startEditing}
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
                title="Edit plan"
            >
                <span class="material-symbols-outlined text-[16px]"
                    >edit_note</span
                >
                Edit
            </button>
            <button
                on:click={() => refreshBrief(true)}
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
                title="Regenerate plan"
            >
                <span class="material-symbols-outlined text-[16px]"
                    >refresh</span
                >
            </button>
        </div>
    {/if}
</div>

<h3 class="text-xl font-bold mb-5 text-white">Today's Plan</h3>

{#if $briefLoading}
    {#if $isStreaming && $thinkingText}
        <div class="space-y-3">
            <div
                class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                style="color:#0d968b;"
            >
                <span class="material-symbols-outlined text-base animate-spin"
                    >progress_activity</span
                >
                Thinking…
            </div>
            <div
                class="rounded-xl p-4 overflow-y-auto max-h-40 text-[11px] leading-relaxed text-slate-400 font-mono"
                style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05);"
            >
                {$thinkingText}
            </div>
        </div>
    {:else}
        <div class="flex items-center gap-3 text-slate-400 text-sm py-4">
            <span class="material-symbols-outlined animate-spin"
                >progress_activity</span
            >
            Generating plan…
        </div>
    {/if}
{:else if $planEditing}
    <!-- ── EDIT MODE ── -->
    <datalist id="plan-subject-list">
        {#each subjectNames as name}<option value={name}></option>{/each}
    </datalist>

    <div class="space-y-3 mb-4">
        {#each editBlocks as block, i}
            <div
                class="rounded-xl p-4 space-y-3"
                style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);"
            >
                <div class="flex items-center gap-2">
                    <span
                        class="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center shrink-0 text-[10px] font-bold text-primary"
                    >
                        {i + 1}
                    </span>
                    <input
                        type="text"
                        bind:value={block.subject}
                        placeholder="Subject name…"
                        list="plan-subject-list"
                        class="flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600 border-b border-slate-700 focus:border-primary pb-0.5 transition-colors"
                    />
                    <button
                        on:click={() => removeBlock(i)}
                        class="text-slate-600 hover:text-rose-400 transition-colors"
                    >
                        <span class="material-symbols-outlined text-[18px]"
                            >close</span
                        >
                    </button>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                    <span
                        class="text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-1"
                        >Duration</span
                    >
                    {#each MINUTE_OPTIONS as m}
                        <button
                            type="button"
                            on:click={() => (block.minutes = m)}
                            class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                            style={block.minutes === m
                                ? "background:#0d968b; color:#fff;"
                                : "background:rgba(255,255,255,0.06); color:#64748b;"}
                            >{m}m</button
                        >
                    {/each}
                    <input
                        type="number"
                        bind:value={block.minutes}
                        min="5"
                        max="180"
                        class="w-16 px-2 py-1 rounded-lg text-xs text-slate-300 text-center outline-none"
                        style="background:rgba(255,255,255,0.06);"
                    />
                </div>

                <input
                    type="text"
                    bind:value={block.task}
                    placeholder="What's the focus? e.g. Practice past papers…"
                    class="w-full bg-transparent text-xs text-slate-400 outline-none placeholder:text-slate-700 border-b border-slate-800 focus:border-slate-600 pb-0.5 transition-colors"
                />
            </div>
        {/each}

        <button
            on:click={addBlock}
            class="w-full py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-primary hover:border-primary/40 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
        >
            <span class="material-symbols-outlined text-[16px]">add</span>
            Add block
        </button>
    </div>

    <div class="flex items-center gap-3">
        <button
            on:click={cancelEditing}
            class="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >Cancel</button
        >
        <button
            on:click={handleSave}
            class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            style="background:#0d968b; box-shadow:0 4px 14px rgba(13,150,139,0.3);"
        >
            <span class="material-symbols-outlined text-[18px]"
                >auto_awesome</span
            >
            Save & Get AI Feedback
        </button>
    </div>
{:else if $todayBrief}
    <!-- ── VIEW MODE ── -->
    <div class="space-y-4 mb-6">
        {#each $todayBrief.blocks as block, i}
            {@const isDone = completedSubjectNames.has(
                block.subject.toLowerCase(),
            )}
            {@const isActive = i === activeBlockIndex}
            <div
                class="flex items-start gap-4 transition-opacity duration-300 {isDone
                    ? 'opacity-35'
                    : !isActive
                      ? 'opacity-55'
                      : ''}"
            >
                <!-- Bullet — clickable on pending blocks to quick-log -->
                {#if isDone}
                    <div
                        class="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 border-emerald-500/50 bg-emerald-500/10"
                    >
                        <span
                            class="material-symbols-outlined text-[13px] text-emerald-400"
                            >check</span
                        >
                    </div>
                {:else}
                    <button
                        title="Quick log {block.subject}"
                        class="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 border-primary transition-all hover:bg-primary/20 hover:scale-110 hover:shadow-[0_0_8px_rgba(13,150,139,0.5)] cursor-pointer"
                        on:click={() => {
                            quickLogPreFill.set({
                                subjectName: block.subject,
                                durationMin: block.minutes,
                            });
                            showQuickLogModal.set(true);
                        }}
                    >
                        {#if isActive}
                            <div class="w-2 h-2 rounded-full bg-primary"></div>
                        {/if}
                    </button>
                {/if}

                <!-- Content -->
                <div class="flex-1">
                    <p
                        class="font-semibold {isDone
                            ? 'line-through text-slate-500'
                            : 'text-white'}"
                    >
                        {block.subject} · {block.minutes}m
                    </p>
                    <p
                        class="text-sm text-slate-400 {isDone
                            ? 'line-through opacity-60'
                            : ''}"
                    >
                        {block.task}
                    </p>
                    {#if block.topics.length}
                        <div class="flex flex-wrap gap-1 mt-1">
                            {#each block.topics as t}
                                <span
                                    class="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/80 font-medium"
                                    >{t}</span
                                >
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Start / Stop button only on active (non-done) block -->
                {#if isActive && !isDone}
                    {#if activeTimerSubject === block.subject}
                        <!-- Stop = timer running for this block -->
                        <button
                            class="px-3 py-1 rounded-lg text-white text-xs font-bold shadow-sm shrink-0 flex items-center gap-1.5 transition-all"
                            style="background:rgba(239,68,68,0.85); box-shadow:0 0 12px rgba(239,68,68,0.4); animation:pulse 1.5s infinite;"
                            on:click={() => handleStop(block)}
                        >
                            <span class="material-symbols-outlined text-[14px]"
                                >stop</span
                            >
                            Stop
                        </button>
                    {:else}
                        <button
                            class="px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold shadow-sm shrink-0 flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                            on:click={() => handleStart(block)}
                        >
                            <span class="material-symbols-outlined text-[14px]"
                                >play_arrow</span
                            >
                            Start
                        </button>
                    {/if}
                {:else if isDone}
                    <span
                        class="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold shrink-0 flex items-center gap-1"
                    >
                        <span class="material-symbols-outlined text-[14px]"
                            >check_circle</span
                        >
                        Done
                    </span>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Risk -->
    {#if $todayBrief.risk}
        {@const sentiment = riskSentiment($todayBrief.risk)}
        {@const rs = riskStyles[sentiment]}
        <div
            class="flex items-start gap-2 mt-4 p-3 rounded-lg"
            style="background:{rs.bg}; border:1px solid {rs.border};"
        >
            <span
                class="material-symbols-outlined text-sm mt-0.5"
                style="color:{rs.iconColor};">{rs.icon}</span
            >
            <p class="text-xs text-slate-300 leading-relaxed">
                {$todayBrief.risk}
            </p>
        </div>
    {/if}

    <!-- AI Comment / Reasoning -->
    {#if $planCommentLoading}
        <div
            class="mt-3 p-3 rounded-lg border flex items-center gap-2"
            style="background:rgba(255,255,255,0.02); border-color:rgba(255,255,255,0.05);"
        >
            <span
                class="material-symbols-outlined text-sm text-primary animate-spin"
                >progress_activity</span
            >
            <p class="text-[11px] text-slate-500 italic">
                Getting AI feedback…
            </p>
        </div>
    {:else if $todayBrief.reasoning}
        <div
            class="mt-3 p-3 rounded-lg border flex items-start gap-2"
            style="background:rgba(255,255,255,0.02); border-color:rgba(255,255,255,0.05);"
        >
            <span class="material-symbols-outlined text-sm mt-0.5 text-primary"
                >auto_awesome</span
            >
            <p class="text-[11px] text-slate-400 leading-relaxed">
                {$todayBrief.reasoning}
            </p>
        </div>
    {/if}
{:else}
    <p class="text-slate-400 text-sm">
        No plan yet. <button
            class="text-primary underline"
            on:click={() => refreshBrief(true)}>Generate one</button
        >
    </p>
{/if}
