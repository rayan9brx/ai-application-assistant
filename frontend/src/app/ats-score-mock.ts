import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { SAMPLE_ATS_SCORE } from './hurdles-config';
import { ScoreRing } from './score-ring';
import { SkillPill } from './skill-pill';

const COUNT_MS = 1600;

/** Score ring climbing from a failing to a passing score while missing keywords turn matched. */
@Component({
  selector: 'app-ats-score-mock',
  imports: [ScoreRing, SkillPill],
  template: `
    <figure class="mock">
      <figcaption class="sr-only">
        Sample: the ATS score rises from {{ sample.from }}% to {{ sample.to }}% once the missing
        keywords are added.
      </figcaption>
      <div class="score-row" aria-hidden="true">
        <app-score-ring class="ring" [value]="score()" suffix="%" />
        <div>
          <p class="title">ATS score</p>
          <p class="status" [class.ready]="finished()">
            {{ finished() ? 'Ready to apply' : 'Keywords missing' }}
          </p>
        </div>
      </div>
      <p class="group">Keywords from the job description</p>
      <ul class="pills" role="list">
        @for (keyword of sample.keywords; track keyword; let i = $index) {
          <li app-skill-pill [label]="keyword" [tone]="matched(i) ? 'matched' : 'missing'"></li>
        }
      </ul>
    </figure>
  `,
  styleUrl: './ats-score-mock.scss',
})
export class AtsScoreMock {
  readonly play = input(false);
  /** When false (reduced motion or no observer), show the final score straight away. */
  readonly animate = input(true);
  readonly sample = SAMPLE_ATS_SCORE;
  readonly score = signal(SAMPLE_ATS_SCORE.from);
  readonly finished = computed(() => this.score() >= this.sample.to);
  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
    effect(() => {
      if (!this.play()) return;
      if (this.animate()) untracked(() => this.countUp());
      else this.score.set(this.sample.to);
    });
  }

  /** Keywords flip one by one as the score passes evenly spaced thresholds. */
  matched(index: number): boolean {
    const { from, to, keywords } = this.sample;
    return this.score() >= from + ((to - from) * (index + 1)) / keywords.length;
  }

  private countUp(): void {
    const { from, to } = this.sample;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      this.score.set(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
}
