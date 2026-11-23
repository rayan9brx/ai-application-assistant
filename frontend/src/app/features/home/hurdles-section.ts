import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { HurdleStep } from './hurdle-step';
import { HURDLES, HURDLES_CLOSING, HURDLES_HEADER } from './hurdles-config';
import { Stepper } from '../../shared/stepper';

/** Reading line: a step counts as reached once its top passes the middle of the viewport. */
const READ_LINE = 0.5;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

@Component({
  selector: 'app-hurdles-section',
  imports: [HurdleStep, Stepper],
  templateUrl: './hurdles-section.html',
  styleUrl: './hurdles-section.scss',
})
export class HurdlesSection {
  readonly header = HURDLES_HEADER;
  readonly hurdles = HURDLES;
  readonly closing = HURDLES_CLOSING;
  readonly startHref = inject(AuthService).startHref;

  readonly fill = signal(0);
  readonly progress = signal(0);
  readonly positions = signal<readonly number[]>([]);
  readonly active = signal(-1);
  private readonly journey = viewChild.required<ElementRef<HTMLElement>>('journey');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      let frame = 0;
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => this.measure());
      };
      addEventListener('scroll', schedule, { passive: true });
      addEventListener('resize', schedule);
      destroyRef.onDestroy(() => {
        removeEventListener('scroll', schedule);
        removeEventListener('resize', schedule);
        cancelAnimationFrame(frame);
      });
      this.measure();
    });
  }

  /** Map scroll position to the stepper: raw progress for the rail, per-step share for the line. */
  private measure(): void {
    const journey = this.journey().nativeElement;
    const box = journey.getBoundingClientRect();
    if (!box.height) return;
    const tops = Array.from(journey.querySelectorAll('app-hurdle-step'), (step) =>
      clamp((step.getBoundingClientRect().top - box.top) / box.height),
    );
    const p = clamp((innerHeight * READ_LINE - box.top) / box.height);
    const reached = tops.filter((top) => p >= top).length - 1;
    const last = tops.length - 1;
    let fill = 0;
    if (reached >= last) fill = 1;
    else if (reached >= 0) {
      const span = tops[reached + 1] - tops[reached] || 1;
      fill = (reached + (p - tops[reached]) / span) / last;
    }
    this.positions.set(tops);
    this.progress.set(p);
    this.active.set(reached);
    this.fill.set(clamp(fill));
  }
}
