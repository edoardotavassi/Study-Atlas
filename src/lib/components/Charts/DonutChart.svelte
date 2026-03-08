<script lang="ts">
  export let segments: { label: string; value: number; color: string | null }[] = [];

  const SIZE = 120;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 44;
  const STROKE = 14;

  $: total = segments.reduce((s, v) => s + v.value, 0) || 1;

  function polarToXY(angle: number, r: number) {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  function arcPath(start: number, end: number): string {
    if (end - start >= 360) end = start + 359.99;
    const s = polarToXY(start, R);
    const e = polarToXY(end, R);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  $: arcs = (() => {
    let angle = 0;
    return segments.map(seg => {
      const sweep = (seg.value / total) * 360;
      const path = arcPath(angle, angle + sweep);
      angle += sweep;
      return { ...seg, path };
    });
  })();

  const COLORS = ['#0d968b','#f59e0b','#6366f1','#ec4899','#10b981','#f97316'];
  function resolveColor(color: string | null, i: number) {
    return color ?? COLORS[i % COLORS.length];
  }
</script>

<div class="flex flex-col items-center gap-4">
  <svg width={SIZE} height={SIZE} viewBox="0 0 {SIZE} {SIZE}">
    <!-- Track -->
    <circle cx={CX} cy={CY} r={R} fill="transparent" stroke="#1f2222" stroke-width={STROKE} />
    {#each arcs as arc, i}
      <path
        d={arc.path}
        fill="transparent"
        stroke={resolveColor(arc.color, i)}
        stroke-width={STROKE}
        stroke-linecap="round"
      />
    {/each}
    <!-- Center total -->
    <text x={CX} y={CY} text-anchor="middle" dominant-baseline="middle"
      class="fill-white font-bold" font-size="14" font-family="Inter, sans-serif">
      {Math.round(total / 60)}h
    </text>
  </svg>

  <!-- Legend -->
  <div class="w-full space-y-1.5">
    {#each segments as seg, i}
      <div class="flex justify-between items-center text-xs">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" style="background: {resolveColor(seg.color, i)}"></div>
          <span class="text-slate-300 font-medium truncate max-w-[100px]">{seg.label}</span>
        </div>
        <span class="font-bold text-white">{Math.round((seg.value / total) * 100)}%</span>
      </div>
    {/each}
  </div>
</div>
