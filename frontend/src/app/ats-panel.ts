import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CvData, CvPreview } from './cv-preview';
import { whenInView } from './in-view';
import { ParsedField, ParsedFieldRow } from './parsed-field-row';
import { SkillPill } from './skill-pill';

/** Shape of one ATS check. Swap the sample for a real analysis response later. */
export interface AtsResult {
  platforms: readonly string[];
  passed: boolean;
  /** Qualification match against the job description, 0–100. */
  match: number;
  fields: readonly ParsedField[];
  matchedSkills: readonly string[];
  missingSkills: readonly string[];
}

const COUNT_MS = 1100;

@Component({
  selector: 'app-ats-panel',
  imports: [CvPreview, ParsedFieldRow, SkillPill],
  templateUrl: './ats-panel.html',
  styleUrl: './ats-panel.scss',
})
export class AtsPanel {
  readonly result = input.required<AtsResult>();
  readonly cv = input.required<CvData>();

  private readonly counted = signal(0);
  private readonly done = signal(false);
  /** The percentage as currently drawn: counting up, then the real value. */
  readonly shownMatch = computed(() => (this.done() ? this.result().match : this.counted()));
  readonly revealed = this.done.asReadonly();
  readonly tone = computed(() => {
    const match = this.result().match;
    return match < 50 ? 'low' : match < 75 ? 'mid' : 'high';
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private frame = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));
    afterNextRender(() =>
      whenInView(
        this.host.nativeElement,
        (animate) => (animate ? this.countUp() : this.done.set(true)),
        destroyRef,
      ),
    );
  }

  /** Index used to stagger the reveal of rows and pills after the count finishes. */
  order(group: 'field' | 'matched' | 'missing', index: number): number {
    const { fields, matchedSkills } = this.result();
    if (group === 'field') return index;
    if (group === 'matched') return fields.length + index;
    return fields.length + matchedSkills.length + index;
  }

  private countUp(): void {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      this.counted.set(Math.round(this.result().match * (1 - (1 - t) ** 3)));
      if (t < 1) this.frame = requestAnimationFrame(step);
      else this.done.set(true);
    };
    this.frame = requestAnimationFrame(step);
  }
}
