<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  const routes = [
    { path: '/today', icon: 'dashboard', label: 'Today' },
    { path: '/calendar', icon: 'calendar_month', label: 'Calendar' },
    { path: '/subjects', icon: 'menu_book', label: 'Subjects' },
    { path: '/insights', icon: 'insights', label: 'Insights' },
    { path: '/settings', icon: 'settings', label: 'Settings' },
  ];

  function isActive(path: string) {
    return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
  }
</script>

<aside class="w-64 flex-shrink-0 border-r border-border-dark flex flex-col bg-background-dark">
  <!-- Logo -->
  <div class="p-6 flex items-center gap-3">
    <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
      <span class="material-symbols-outlined text-white text-xl">map</span>
    </div>
    <h1 class="text-lg font-bold tracking-tight text-white">Study Atlas</h1>
  </div>

  <!-- Nav -->
  <nav class="flex-1 px-4 space-y-1">
    {#each routes as route}
      <a
        href={route.path}
        class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium
          {isActive(route.path)
            ? 'bg-primary/10 text-primary'
            : 'text-slate-400 hover:bg-card-dark hover:text-slate-200'}"
        on:click|preventDefault={() => goto(route.path)}
      >
        <span class="material-symbols-outlined text-[22px]">{route.icon}</span>
        <span>{route.label}</span>
      </a>
    {/each}
  </nav>

  <!-- Footer: Local-only indicator -->
  <div class="p-4 border-t border-border-dark">
    <div class="flex items-center gap-2 px-2 py-1.5">
      <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
      <span class="text-[11px] text-slate-500 font-medium">Local-only · v1.0.0</span>
    </div>
  </div>
</aside>
