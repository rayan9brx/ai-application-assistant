import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DayPoint } from './admin-api';

const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

/** Visitors and sign-ups per day as a small SVG line chart, with a data table for screen readers. */
@Component({
  selector: 'app-admin-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend" aria-hidden="true">
      <span><i class="swatch visitors"></i>Visitors</span>
      <span><i class="swatch signups"></i>Sign-ups</span>
    </div>
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="summary()">
      @for (tick of chart().ticks; track tick.value) {
        <line class="grid" [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="tick.y" [attr.y2]="tick.y" />
        <text class="axis" [attr.x]="pad.left - 6" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.value }}</text>
      }
      @for (label of chart().labels; track label.x) {
        <text class="axis" [attr.x]="label.x" [attr.y]="height - 8" text-anchor="middle">{{ label.text }}</text>
      }
      <polyline class="line visitors" [attr.points]="chart().visitors" />
      <polyline class="line signups" [attr.points]="chart().signups" />
      @for (p of chart().points; track p.day) {
        <circle class="dot visitors" [attr.cx]="p.x" [attr.cy]="p.vy" r="3"><title>{{ p.day }}: {{ p.visitors }} visitors</title></circle>
        <circle class="dot signups" [attr.cx]="p.x" [attr.cy]="p.sy" r="3"><title>{{ p.day }}: {{ p.signups }} sign-ups</title></circle>
      }
    </svg>
    <table class="sr-only">
      <caption>Visitors and sign-ups per day</caption>
      <tr><th scope="col">Day</th><th scope="col">Visitors</th><th scope="col">Sign-ups</th></tr>
      @for (p of series(); track p.day) {
        <tr><td>{{ p.day }}</td><td>{{ p.visitors }}</td><td>{{ p.signups }}</td></tr>
      }
    </table>
  `,
  styles: `
    :host { display: block; }
    .legend { display: flex; gap: var(--space-4); margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 12px; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .swatch { display: inline-block; width: 12px; height: 3px; border-radius: 2px; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .axis { fill: var(--text-secondary); font-size: 11px; }
    .line { fill: none; stroke-width: 2.25; stroke-linejoin: round; stroke-linecap: round; }
    .dot { stroke: var(--surface); stroke-width: 1.5; }
    .visitors { stroke: var(--accent); background: var(--accent); }
    .signups { stroke: var(--success); background: var(--success); }
    .dot.visitors { fill: var(--accent); }
    .dot.signups { fill: var(--success); }
    line.visitors, line.signups { stroke-width: 0; }
  `,
})
export class AdminLineChart {
  readonly series = input.required<DayPoint[]>();
  readonly width = W;
  readonly height = H;
  readonly pad = PAD;

  readonly summary = computed(() => {
    const s = this.series();
    const visitors = s.reduce((sum, p) => sum + p.visitors, 0);
    const signups = s.reduce((sum, p) => sum + p.signups, 0);
    return `Line chart over ${s.length} days: ${visitors} visitors and ${signups} sign-ups in total.`;
  });

  readonly chart = computed(() => {
    const s = this.series();
    const max = Math.max(1, ...s.map((p) => Math.max(p.visitors, p.signups)));
    const top = niceMax(Math.max(2, max));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (s.length <= 1 ? innerW / 2 : (i / (s.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
    const points = s.map((p, i) => ({ ...p, x: x(i), vy: y(p.visitors), sy: y(p.signups) }));
    // Dots only when they stay readable; long ranges show the lines alone.
    const dots = s.length <= 45 ? points : [];
    const labelEvery = Math.max(1, Math.ceil(s.length / 7));
    return {
      ticks: [0, Math.round(top / 2), top].map((value) => ({ value, y: y(value) })),
      labels: s
        .map((p, i) => ({ i, x: x(i), text: shortDay(p.day) }))
        .filter((l) => l.i % labelEvery === 0 || l.i === s.length - 1),
      visitors: points.map((p) => `${p.x},${p.vy}`).join(' '),
      signups: points.map((p) => `${p.x},${p.sy}`).join(' '),
      points: dots,
    };
  });
}

function niceMax(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 5, 10].map((s) => s * magnitude);
  return steps.find((s) => s >= value) ?? value;
}

function shortDay(day: string): string {
  const [, month, date] = day.split('-');
  return `${Number(date)}.${Number(month)}.`;
}
