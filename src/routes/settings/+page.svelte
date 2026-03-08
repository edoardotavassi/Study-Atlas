<script lang="ts">
  import { onMount } from 'svelte';
  import TopHeader from '$lib/components/TopHeader.svelte';
  import { getAllSettings, setSetting, setGlobalGoal } from '$lib/db/repositories/goals.repo';
  import { listSubjects } from '$lib/db/repositories/subjects.repo';
  import { getDb } from '$lib/db/client';
  import { testOllamaConnection } from '$lib/services/llm';
  import { showToast } from '$lib/stores/ui.store';
  import { save, open } from '@tauri-apps/plugin-dialog';
  import { writeTextFile, readTextFile, copyFile } from '@tauri-apps/plugin-fs';
  import type { Subject } from '$lib/domain/types';

  let settings: Record<string, string> = {};
  let subjects: Subject[] = [];
  let weeklyGoal = 1200;
  let llmEnabled = false;
  let llmEndpoint = 'http://localhost:11434/v1/chat/completions';
  let llmModel = 'qwen3:4b';
  let testingConnection = false;

  async function load() {
    settings = await getAllSettings();
    subjects = await listSubjects();
    weeklyGoal = parseInt(settings['goal.weeklyMinutes'] ?? '1200');
    llmEnabled = settings['llm.enabled'] === 'true';
    llmEndpoint = settings['llm.endpoint'] ?? 'http://localhost:11434/v1/chat/completions';
    llmModel = settings['llm.model'] ?? 'qwen3:4b';
  }

  async function saveSettings() {
    await setGlobalGoal(weeklyGoal);
    await setSetting('llm.enabled', llmEnabled ? 'true' : 'false');
    await setSetting('llm.endpoint', llmEndpoint);
    await setSetting('llm.model', llmModel);
    showToast('Settings saved', 'success');
  }

  async function testConnection() {
    testingConnection = true;
    const result = await testOllamaConnection();
    testingConnection = false;
    showToast(result.message, result.ok ? 'success' : 'error');
  }

  // ─── Export / Import ────────────────────────────────────────────────────────

  async function exportJSON() {
    try {
      const db = await getDb();
      const subjectsData = await db.select('SELECT * FROM subjects');
      const topicsData = await db.select('SELECT * FROM topics');
      const sessionsData = await db.select('SELECT * FROM sessions');
      const sessionTopicsData = await db.select('SELECT * FROM session_topics');
      const exportData = { version: 1, exported: new Date().toISOString(), subjects: subjectsData, topics: topicsData, sessions: sessionsData, session_topics: sessionTopicsData };

      const path = await save({ defaultPath: `study-atlas-export-${new Date().toISOString().slice(0,10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (path) {
        await writeTextFile(path, JSON.stringify(exportData, null, 2));
        showToast('Exported JSON successfully', 'success');
      }
    } catch (e) {
      showToast('Export failed', 'error');
    }
  }

  async function exportCSV() {
    try {
      const db = await getDb();
      const sessions = await db.select<any[]>(
        `SELECT s.id, subj.name as subject, s.start_ts, s.end_ts, s.duration_min, s.outcome, s.focus, s.note, s.created_at
         FROM sessions s JOIN subjects subj ON s.subject_id = subj.id ORDER BY s.start_ts DESC`
      );
      const header = 'id,subject,start_ts,end_ts,duration_min,outcome,focus,note,created_at';
      const rows = sessions.map(r =>
        [r.id, `"${r.subject}"`, r.start_ts, r.end_ts, r.duration_min, r.outcome, r.focus ?? '', `"${(r.note ?? '').replace(/"/g, '""')}"`, r.created_at].join(',')
      );
      const csv = [header, ...rows].join('\n');

      const path = await save({ defaultPath: `study-atlas-sessions-${new Date().toISOString().slice(0,10)}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (path) {
        await writeTextFile(path, csv);
        showToast('Exported CSV successfully', 'success');
      }
    } catch (e) {
      showToast('CSV export failed', 'error');
    }
  }

  async function importJSON() {
    try {
      const selected = await open({ filters: [{ name: 'JSON', extensions: ['json'] }], multiple: false });
      if (!selected || typeof selected !== 'string') return;
      const raw = await readTextFile(selected);
      const data = JSON.parse(raw);
      const db = await getDb();
      let imported = 0;

      // Upsert subjects
      for (const s of data.subjects ?? []) {
        await db.execute(
          'INSERT OR IGNORE INTO subjects (id, name, color, created_at) VALUES ($1, $2, $3, $4)',
          [s.id, s.name, s.color, s.created_at]
        );
      }
      // Upsert topics
      for (const t of data.topics ?? []) {
        await db.execute(
          'INSERT OR IGNORE INTO topics (id, subject_id, name, created_at) VALUES ($1, $2, $3, $4)',
          [t.id, t.subject_id, t.name, t.created_at]
        );
      }
      // Upsert sessions
      for (const s of data.sessions ?? []) {
        await db.execute(
          'INSERT OR IGNORE INTO sessions (id, subject_id, start_ts, end_ts, duration_min, outcome, focus, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [s.id, s.subject_id, s.start_ts, s.end_ts, s.duration_min, s.outcome, s.focus, s.note, s.created_at]
        );
        imported++;
      }
      // Upsert session_topics
      for (const st of data.session_topics ?? []) {
        await db.execute('INSERT OR IGNORE INTO session_topics (session_id, topic_id) VALUES ($1, $2)', [st.session_id, st.topic_id]);
      }
      showToast(`Imported ${imported} sessions`, 'success');
      await load();
    } catch (e) {
      showToast('Import failed — invalid file?', 'error');
    }
  }

  onMount(load);
</script>

<TopHeader title="Settings" />

<main class="flex-1 overflow-y-auto custom-scrollbar p-8">
  <div class="max-w-[800px] mx-auto space-y-12">

    <header>
      <h1 class="text-3xl font-black text-white">Settings</h1>
      <p class="text-slate-400 mt-1">Manage your data, goals, and preferences.</p>
    </header>

    <!-- Data section -->
    <section>
      <div class="flex items-center gap-2 mb-6 pb-2 border-b border-border-dark">
        <span class="material-symbols-outlined text-primary">database</span>
        <h2 class="text-lg font-bold text-white">Data</h2>
      </div>
      <div class="space-y-3">
        <div class="mac-card rounded-xl p-5">
          <p class="text-sm font-semibold text-white mb-1">Database Location</p>
          <code class="text-xs text-primary/70 bg-primary/5 px-2 py-1 rounded">~/Library/Application Support/com.studyatlas.app/study-atlas.db</code>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            on:click={exportJSON}
            class="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors text-slate-200"
          >
            <span class="material-symbols-outlined text-sm">file_export</span> Export JSON
          </button>
          <button
            on:click={exportCSV}
            class="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors text-slate-200"
          >
            <span class="material-symbols-outlined text-sm">table_view</span> Export CSV
          </button>
          <button
            on:click={importJSON}
            class="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors text-slate-200"
          >
            <span class="material-symbols-outlined text-sm">file_upload</span> Import JSON
          </button>
        </div>
      </div>
    </section>

    <!-- Goals section -->
    <section>
      <div class="flex items-center gap-2 mb-6 pb-2 border-b border-border-dark">
        <span class="material-symbols-outlined text-primary">flag</span>
        <h2 class="text-lg font-bold text-white">Goals</h2>
      </div>
      <div class="flex items-center justify-between p-4 bg-white/3 rounded-xl border border-border-dark">
        <div>
          <h3 class="font-bold text-sm text-white">Weekly Minutes Target</h3>
          <p class="text-xs text-slate-500 mt-0.5">Total study time across all subjects</p>
        </div>
        <div class="flex items-center gap-3">
          <input
            type="number"
            bind:value={weeklyGoal}
            min="60" max="10000" step="60"
            class="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:ring-1 focus:ring-primary outline-none text-right"
          />
          <span class="text-xs text-slate-500 font-medium">min/wk</span>
          <span class="text-xs text-slate-400">= {(weeklyGoal/60).toFixed(0)}h</span>
        </div>
      </div>
    </section>

    <!-- Local LLM section -->
    <section>
      <div class="flex items-center gap-2 mb-6 pb-2 border-b border-border-dark">
        <span class="material-symbols-outlined text-primary">smart_toy</span>
        <h2 class="text-lg font-bold text-white">Local Model (Today Brief)</h2>
      </div>
      <div class="mac-card rounded-xl overflow-hidden">
        <!-- Enable toggle -->
        <div class="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 class="font-bold text-sm text-white">Enable AI Brief</h3>
            <p class="text-xs text-slate-500 mt-0.5">Uses local Ollama — no data leaves your device</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" bind:checked={llmEnabled} class="sr-only peer" />
            <div class="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full
              after:content-[''] after:absolute after:top-[2px] after:start-[2px]
              after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all
              peer-checked:bg-primary"></div>
          </label>
        </div>

        <!-- Settings (only when enabled) -->
        {#if llmEnabled}
          <div class="p-5 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-xs font-bold text-slate-500">Endpoint</label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    bind:value={llmEndpoint}
                    class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button
                    on:click={testConnection}
                    disabled={testingConnection}
                    class="px-3 py-2 bg-white/10 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? '…' : 'Test'}
                  </button>
                </div>
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-bold text-slate-500">Model</label>
                <input
                  type="text"
                  bind:value={llmModel}
                  placeholder="qwen3:4b"
                  class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <p class="text-[10px] text-slate-500 italic">stream: false is always enforced. Brief is generated once per day and cached.</p>
          </div>
        {/if}
      </div>
    </section>

    <!-- App info -->
    <section>
      <div class="flex items-center gap-2 mb-6 pb-2 border-b border-border-dark">
        <span class="material-symbols-outlined text-primary">info</span>
        <h2 class="text-lg font-bold text-white">About</h2>
      </div>
      <div class="p-4 mac-card rounded-xl">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span class="material-symbols-outlined text-white text-xl">map</span>
          </div>
          <div>
            <p class="text-sm font-bold text-white">Study Atlas</p>
            <p class="text-xs text-slate-500">v1.0.0 · Local-only · No accounts, no cloud</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Save button -->
    <div class="flex justify-end gap-3 pt-6 border-t border-border-dark pb-20">
      <button
        on:click={saveSettings}
        class="px-8 py-2.5 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
      >
        Save Changes
      </button>
    </div>
  </div>
</main>
