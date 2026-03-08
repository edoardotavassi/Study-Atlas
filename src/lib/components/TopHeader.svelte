<script lang="ts">
  import {
    timerRunning,
    timerDisplay,
    startTimer,
    stopTimer,
  } from "../stores/timer.store";
  import {
    showQuickLogModal,
    quickLogPreFill,
    showToast,
  } from "../stores/ui.store";

  export let title: string = "";
  export let subtitle: string = "";

  function handleStartSession() {
    if ($timerRunning) {
      const result = stopTimer();
      if (result) {
        quickLogPreFill.set(result);
        showQuickLogModal.set(true);
      }
    } else {
      startTimer();
      showToast("Timer started", "info");
    }
  }

  function handleQuickLog() {
    quickLogPreFill.set(null);
    showQuickLogModal.set(true);
  }

  const dateStr = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
</script>

<header
  class="h-16 flex items-center justify-between px-8 border-b border-border-dark bg-background-dark/50 backdrop-blur-md sticky top-0 z-10"
>
  <div>
    {#if title}
      <h2 class="text-xl font-bold tracking-tight text-white">{title}</h2>
    {/if}
    <p class="text-xs text-slate-500 font-medium uppercase tracking-wider">
      {subtitle || dateStr}
    </p>
  </div>

  <div class="flex items-center gap-3">
    <!-- Timer pill (only visible when running) -->
    {#if $timerRunning}
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono font-bold"
        style="background:rgba(13,150,139,0.1); border-color:rgba(13,150,139,0.3); color:#0d968b;"
      >
        <span
          class="w-2 h-2 rounded-full animate-pulse"
          style="background:#0d968b;"
        ></span>
        {$timerDisplay}
      </div>
    {/if}

    <!-- Start Session / Stop button -->
    <button
      on:click={handleStartSession}
      class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg
        {$timerRunning
        ? 'bg-rose-500 text-white hover:bg-rose-400'
        : 'bg-primary text-white hover:bg-primary/90'}"
      style="box-shadow: 0 4px 14px {$timerRunning
        ? 'rgba(239,68,68,0.3)'
        : 'rgba(13,150,139,0.3)'};"
    >
      <span class="material-symbols-outlined text-sm">
        {$timerRunning ? "stop" : "play_arrow"}
      </span>
      <span>{$timerRunning ? "Stop" : "Start Session"}</span>
    </button>

    <!-- Quick Log button -->
    <button
      on:click={handleQuickLog}
      class="flex items-center justify-center w-9 h-9 rounded-lg border border-border-dark text-slate-400 hover:bg-card-dark hover:text-white transition-colors"
      title="Quick Log"
    >
      <span class="material-symbols-outlined text-lg">add</span>
    </button>
  </div>
</header>
