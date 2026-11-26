import { Component, signal } from '@angular/core';
import { CHECK_HREF } from '../../core/menu-config';
import { scoreTone } from '../../core/score-tone';
import { AtsScoreMock } from './ats-score-mock';
import { BulletRewriteMock } from './bullet-rewrite-mock';
import { SAMPLE_TAILOR } from './home-samples';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

const STEPS = [
  {
    title: 'Upload your CV',
    text: 'PDF or Word. Get your ATS score in seconds.',
    icon: 'M12 16V4M7 9l5-5 5 5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  },
  {
    title: 'Fix it with AI',
    text: 'See missing keywords and improve weak points with one click.',
    icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  },
  {
    title: 'Tailor and download',
    text: 'Match any job ad and download an ATS-friendly PDF.',
    icon: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  },
];

/** Three steps side by side, each with a small product mockup that plays once in view. */
@Component({
  selector: 'app-how-it-works',
  imports: [AtsScoreMock, BulletRewriteMock, Reveal, SectionHead],
  template: `
    <section id="features" aria-labelledby="how-title">
      <app-section-head pill="How it works" title="From upload to interview-ready in three steps" headingId="how-title" />
      <ol class="steps" role="list" appReveal (revealed)="start($event)">
        @for (step of steps; track step.title; let i = $index) {
          <li class="step">
            <div class="step-head">
              <span class="number" aria-hidden="true">{{ i + 1 }}</span>
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="step.icon" /></svg>
            </div>
            <h3><span class="sr-only">Step {{ i + 1 }}: </span>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
            <div class="mock-area theme-dark">
              @switch (i) {
                @case (0) { <app-ats-score-mock [play]="playing()" [animate]="animate()" /> }
                @case (1) { <app-bullet-rewrite-mock [play]="playing()" [animate]="animate()" /> }
                @default {
                  <figure class="tailor">
                    <figcaption class="sr-only">
                      Example only: the CV matches the job ad {{ tailor.match }}% and downloads as a PDF.
                    </figcaption>
                    <div aria-hidden="true">
                      <p class="tailor-label">Job ad <span class="example-badge">Example</span></p>
                      <p class="tailor-job">{{ tailor.job }}</p>
                      <p class="tailor-meta">{{ tailor.company }}</p>
                      <div class="tailor-match">
                        <span class="bar"><span [attr.data-tone]="tone" [style.width.%]="playing() ? tailor.match : 0"></span></span>
                        <b [attr.data-tone]="tone">{{ tailor.match }}% match</b>
                      </div>
                      <p class="pdf">
                        <svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" /></svg>
                        <span>{{ tailor.file }}</span>
                        <span class="pdf-tag">ATS-friendly</span>
                      </p>
                    </div>
                  </figure>
                }
              }
            </div>
          </li>
        }
      </ol>
      <div class="after">
        <a class="cta" [href]="checkHref">Check my CV for free</a>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin: 0; padding: 0; list-style: none; }
    .step { display: flex; flex-direction: column; padding: 24px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); box-shadow: var(--shadow); }
    .step-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .number { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 999px; background: var(--pill-bg); color: var(--pill-text); font-weight: 700; }
    .icon { width: 24px; height: 24px; fill: none; stroke: var(--accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    h3 { font-size: 1.25rem; letter-spacing: -.02em; }
    .step > p { margin-top: 8px; color: var(--text-secondary); line-height: 1.55; }

    .mock-area { flex: 1; margin-top: 24px; padding: 16px; border-radius: 16px; background: var(--bg); color: var(--text); }
    /* The mockups were made for full-width sections; make them card-sized. */
    .mock-area ::ng-deep .mock { padding: 16px; border-radius: 14px; box-shadow: none; }
    .mock-area ::ng-deep .ring { --ring-font: 18px; width: 72px; height: 72px; }
    .mock-area ::ng-deep .score-row { gap: 14px; padding-bottom: 14px; }
    .mock-area ::ng-deep .title { font-size: 1rem; }
    .mock-area ::ng-deep .line { padding: 12px; }
    .mock-area ::ng-deep .line p { font-size: .875rem; }
    .mock-area ::ng-deep .arrow { height: 24px; }

    .tailor { margin: 0; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
    .tailor-label { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: .8125rem; font-weight: 600; }
    .tailor-job { margin-top: 10px; font-weight: 650; }
    .tailor-meta { color: var(--text-muted); font-size: .8125rem; }
    .tailor-match { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; margin-top: 14px; }
    .bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--surface-raised); }
    .bar span { display: block; height: 100%; border-radius: inherit; transition: width 1.2s cubic-bezier(.2, .7, .2, 1); }
    .bar [data-tone='high'] { background: var(--score-high); }
    .bar [data-tone='mid'] { background: var(--score-mid); }
    .bar [data-tone='low'] { background: var(--score-low); }
    b { padding: 2px 8px; border-radius: 999px; font-size: .75rem; }
    b[data-tone='high'] { background: var(--success-bg); color: var(--success-text); }
    b[data-tone='mid'] { background: var(--warning-bg); color: var(--warning-text); }
    b[data-tone='low'] { background: var(--danger-bg); color: var(--danger-text); }
    .pdf { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); font-size: .8125rem; font-weight: 600; }
    .pdf svg { flex: none; width: 18px; height: 18px; fill: none; stroke: var(--accent); stroke-width: 1.8; stroke-linejoin: round; }
    .pdf span:first-of-type { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pdf-tag { margin-left: auto; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: .6875rem; white-space: nowrap; }

    .after { display: flex; justify-content: center; margin-top: 48px; }
    @media (prefers-reduced-motion: reduce) { .bar span { transition: none; } }
    @media (max-width: 960px) { .steps { grid-template-columns: minmax(0, 1fr); max-width: 520px; margin-inline: auto; } }
    @media (max-width: 520px) { .after .cta { width: 100%; } }
  `,
})
export class HowItWorks {
  readonly steps = STEPS;
  readonly tailor = SAMPLE_TAILOR;
  readonly tone = scoreTone(SAMPLE_TAILOR.match);
  readonly checkHref = CHECK_HREF;
  readonly playing = signal(false);
  readonly animate = signal(true);

  start(animate: boolean): void {
    this.animate.set(animate);
    this.playing.set(true);
  }
}
