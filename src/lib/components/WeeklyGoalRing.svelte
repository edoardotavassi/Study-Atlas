<script lang="ts">
  export let percent: number = 0; // 0-100
  export let hoursLogged: number = 0;
  export let hoursGoal: number = 20;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  $: offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  $: label =
    percent >= 100
      ? "🎯"
      : percent >= 75
        ? "Almost there!"
        : percent >= 50
          ? "Halfway!"
          : "Keep going!";
  $: hLogged = (hoursLogged / 60).toFixed(1);
  $: hGoal = (hoursGoal / 60).toFixed(0);
</script>

<div
  class="p-6 rounded-2xl border"
  style="background:#121414; border-color:#1f2222;"
>
  <h4
    class="text-xs font-bold mb-6 text-center uppercase tracking-widest text-slate-500"
  >
    Weekly Goal
  </h4>

  <div class="relative w-40 h-40 mx-auto mb-6">
    <svg class="w-full h-full -rotate-90" viewBox="0 0 160 160">
      <!-- Track -->
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="transparent"
        stroke="#1f2222"
        stroke-width="12"
      />
      <!-- Progress -->
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="transparent"
        stroke="#0d968b"
        stroke-width="12"
        stroke-linecap="round"
        stroke-dasharray={circumference}
        stroke-dashoffset={offset}
        style="transition: stroke-dashoffset 0.7s ease;"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-3xl font-black text-white">{Math.round(percent)}%</span>
      <span class="text-[10px] text-slate-500 font-bold uppercase">Done</span>
    </div>
  </div>

  <div class="text-center">
    <p class="text-sm font-medium text-slate-200 mb-1">
      {hLogged} / {hGoal} Hours
    </p>
    <p class="text-xs text-slate-500 italic">"{label}"</p>
  </div>
</div>
