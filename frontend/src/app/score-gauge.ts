import { Component, computed, input } from '@angular/core';

const GAUGE = { cx: 100, cy: 100, r: 80 };
let nextId = 0;

/** Half-circle 0–100 gauge, red → teal, with a knob at the score and the number inside. */
@Component({
  selector: 'app-score-gauge',
  template: `
    <svg viewBox="0 0 200 112" aria-hidden="true">
      <defs>
        <linearGradient [id]="gradientId" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#f0524f" />
          <stop offset="0.45" stop-color="#f59e2c" />
          <stop offset="0.65" stop-color="#f3cf3c" />
          <stop offset="1" stop-color="#2dd4bf" />
        </linearGradient>
      </defs>
      <path
        [attr.d]="path"
        fill="none"
        [attr.stroke]="'url(#' + gradientId + ')'"
        stroke-width="14"
        stroke-linecap="round"
      />
      <circle class="knob" [attr.cx]="knob().x" [attr.cy]="knob().y" r="9" />
      <text class="value" x="100" y="96" text-anchor="middle">{{ score() }}</text>
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      max-width: 220px;
      margin-inline: auto;
    }
    .knob {
      fill: #fff;
      stroke: var(--sc-surface);
      stroke-width: 3;
      transition:
        cx 0.6s ease,
        cy 0.6s ease;
    }
    .value {
      fill: var(--sc-text);
      font-size: 44px;
      font-weight: 700;
      letter-spacing: -1px;
    }
  `,
})
export class ScoreGauge {
  readonly score = input.required<number>();
  readonly gradientId = `score-gauge-gradient-${nextId++}`;
  readonly path = `M${GAUGE.cx - GAUGE.r} ${GAUGE.cy} A${GAUGE.r} ${GAUGE.r} 0 0 1 ${GAUGE.cx + GAUGE.r} ${GAUGE.cy}`;
  readonly knob = computed(() => ScoreGauge.point(this.score()));

  /** Point on the arc for a score: 0 at the left end, 100 at the right end. */
  static point(score: number): { x: number; y: number } {
    const angle = Math.PI * (1 - Math.min(100, Math.max(0, score)) / 100);
    return { x: GAUGE.cx + GAUGE.r * Math.cos(angle), y: GAUGE.cy - GAUGE.r * Math.sin(angle) };
  }
}
