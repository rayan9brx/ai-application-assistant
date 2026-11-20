import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { AtsScoreMock } from './ats-score-mock';
import { BulletRewriteMock } from './bullet-rewrite-mock';
import { Hurdle } from './hurdles-config';
import { whenInView } from './in-view';
import { JobMatchMock } from './job-match-mock';

/** One hurdle: pain, how we help and a CTA beside its visual; fades in on scroll. */
@Component({
  selector: 'app-hurdle-step',
  imports: [AtsScoreMock, BulletRewriteMock, JobMatchMock],
  templateUrl: './hurdle-step.html',
  styleUrl: './hurdle-step.scss',
  host: { '[class.reversed]': 'reversed()', '[class.visible]': 'visible()' },
})
export class HurdleStep {
  readonly hurdle = input.required<Hurdle>();
  /** Put the visual on the left (desktop only) for the zig-zag layout. */
  readonly reversed = input(false);
  readonly visible = signal(false);
  readonly animate = signal(true);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() =>
      whenInView(
        host,
        (animate) => {
          this.animate.set(animate);
          this.visible.set(true);
        },
        destroyRef,
        0.2,
      ),
    );
  }
}
