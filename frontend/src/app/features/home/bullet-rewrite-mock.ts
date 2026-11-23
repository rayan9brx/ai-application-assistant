import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { SAMPLE_REWRITE } from './hurdles-config';

const SWAP_DELAY_MS = 700;

/** Before/after bullet point; the weak line is struck through and the rewrite slides in. */
@Component({
  selector: 'app-bullet-rewrite-mock',
  template: `
    <figure class="mock" [class.rewritten]="rewritten()">
      <figcaption class="head">
        Experience · one bullet point <span class="hint example-badge">Example</span>
      </figcaption>
      <div class="line before">
        <span class="tag">Before</span>
        <p>
          <span class="sr-only">Before: </span><span class="strike">{{ sample.before }}</span>
        </p>
      </div>
      <div class="arrow" aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M8 3v10M4 9l4 4 4-4" /></svg>
      </div>
      <div class="line after">
        <span class="tag ai"><span aria-hidden="true">✦</span> {{ sample.tag }}</span>
        <p><span class="sr-only">After: </span>{{ sample.after }}</p>
      </div>
    </figure>
  `,
  styleUrl: './bullet-rewrite-mock.scss',
})
export class BulletRewriteMock {
  readonly play = input(false);
  /** When false (reduced motion or no observer), show the rewritten state straight away. */
  readonly animate = input(true);
  readonly rewritten = signal(false);
  readonly sample = SAMPLE_REWRITE;

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    effect(() => {
      if (!this.play()) return;
      if (!this.animate()) {
        this.rewritten.set(true);
        return;
      }
      untracked(() => (timer = setTimeout(() => this.rewritten.set(true), SWAP_DELAY_MS)));
    });
  }
}
