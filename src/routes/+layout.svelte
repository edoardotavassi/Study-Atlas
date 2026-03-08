<script lang="ts">
  import "../app.css";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import QuickLogModal from "$lib/components/QuickLogModal.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import { showQuickLogModal } from "$lib/stores/ui.store";
  import { toastMessage } from "$lib/stores/ui.store";
  import { getDb } from "$lib/db/client";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  onMount(async () => {
    // Initialize DB on first load
    await getDb();
    // Redirect root to /today
    if ($page.url.pathname === "/") goto("/today");
  });
</script>

<div class="flex h-screen overflow-hidden bg-background-dark">
  <Sidebar />
  <div class="flex-1 flex flex-col overflow-hidden">
    <slot />
  </div>
</div>

<!-- Quick Log Modal -->
{#if $showQuickLogModal}
  <QuickLogModal on:saved />
{/if}

<!-- Global Confirm Dialog -->
<ConfirmDialog />

<!-- Toast Notifications -->
{#if $toastMessage}
  <div
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
  >
    <div
      class="flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold
      {$toastMessage.type === 'success'
        ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-200'
        : $toastMessage.type === 'error'
          ? 'bg-rose-900/90 border-rose-500/30 text-rose-200'
          : 'bg-card-dark/90 border-border-dark text-slate-200'}"
    >
      <span class="material-symbols-outlined text-base">
        {$toastMessage.type === "success"
          ? "check_circle"
          : $toastMessage.type === "error"
            ? "error"
            : "info"}
      </span>
      {$toastMessage.text}
    </div>
  </div>
{/if}
