import { Component, computed, input } from '@angular/core';

import { scoreTone } from '../core/score-tone';

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular 0–100 score with the number in the middle, coloured by scoreTone().
 * Size it from the parent with width/height on the host and `--ring-font` for the number.
 */
@Component({
  selector: 'app-score-ring',
  template: `
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <circle class="track" cx="18" cy="18" [attr.r]="radius" />
      <circle
        class="value"
        cx="18"
        cy="18"
        [attr.r]="radius"
        [attr.stroke-dasharray]="circumference"
        [attr.stroke-dashoffset]="offset()"
      />
    </svg>
    <span class="number" aria-hidden="true">{{ rounded() }}{{ suffix() }}</span>
  `,
  styleUrl: './score-ring.scss',
  host: { '[attr.data-tone]': 'tone()' },
})
export class ScoreRing {
  readonly value = input.required<number>();
  readonly suffix = input('');
  readonly radius = RADIUS;
  readonly circumference = CIRCUMFERENCE;
  readonly rounded = computed(() => Math.round(this.value()));
  readonly offset = computed(
    () => CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, this.value())) / 100),
  );
  readonly tone = computed(() => scoreTone(this.value()));
}
