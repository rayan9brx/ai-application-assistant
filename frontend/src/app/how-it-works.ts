import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { AtsScoreMock } from './ats-score-mock';
import { AuthService } from './auth.service';
import { BulletRewriteMock } from './bullet-rewrite-mock';
import { CvSheet } from './cv-sheet';
import { DEFAULT_TEMPLATE, SAMPLE_CV } from './cv-templates';
import { prefersReducedMotion } from './in-view';
import { ONBOARDING_STEPS, OnboardingOption } from './onboarding-options';
import { TemplatePicker } from './template-picker';
import { UploadBar } from './upload-bar';

const ADVANCE_MS = 5000;

interface HowStep {
  tab: string;
  title: string;
  text: string;
  visual: 'signup' | 'upload' | 'fix' | 'apply';
}

const STEPS: readonly HowStep[] = [
  { tab: 'Sign up', title: 'Create your free account', text: 'Tell us your goal and get help where you need it most.', visual: 'signup' },
  { tab: 'Upload', title: 'Upload your CV', text: 'Get your ATS score and see what’s missing in seconds.', visual: 'upload' },
  { tab: 'Fix', title: 'Fix it with AI', text: 'Improve weak points and tailor your CV to any job.', visual: 'fix' },
  { tab: 'Apply', title: 'Download & apply', text: 'Download an ATS-friendly PDF and apply with confidence.', visual: 'apply' },
];

/** Four steps from sign-up to applying; tabs auto-advance every 5s and pause on hover. */
@Component({
  selector: 'app-how-it-works',
  imports: [AtsScoreMock, BulletRewriteMock, CvSheet, TemplatePicker, UploadBar],
  template: `
    <section class="how" aria-labelledby="how-title" (mouseenter)="paused.set(true)" (mouseleave)="paused.set(false)" (focusin)="paused.set(true)" (focusout)="paused.set(false)">
      <h2 id="how-title">How it works</h2>

      @let step = steps[active()];
      <div class="card" role="tabpanel" id="how-panel" [attr.aria-labelledby]="'how-tab-' + active()">
        <div class="frame theme-light">
          <p class="sr-only">Example screen for step {{ active() + 1 }}: {{ step.title }}.</p>
          <div class="mock" inert>
            @switch (step.visual) {
              @case ('signup') {
                <div class="question">
                  <p class="q-title">{{ challenge.title }}</p>
                  <ul role="list">
                    @for (option of challenge.options; track option.key; let i = $index) {
                      <li [class.selected]="i === 1">{{ option.label }}</li>
                    }
                  </ul>
                  <span class="cta cta-small">Continue</span>
                </div>
              }
              @case ('upload') {
                <div class="stack">
                  <app-upload-bar [showSubmit]="false" />
                  <app-ats-score-mock [play]="true" [animate]="animate" />
                </div>
              }
              @case ('fix') {
                <app-bullet-rewrite-mock [play]="true" [animate]="animate" />
              }
              @case ('apply') {
                <div class="stack">
                  <app-template-picker [text]="sampleCv" [value]="template" />
                  <div class="pdf">
                    <app-cv-sheet class="sheet" [text]="sampleCv" [template]="template" crop="1 / .55" [decorative]="true" />
                    <span class="cta cta-small">Download PDF</span>
                  </div>
                </div>
              }
            }
          </div>
        </div>
        <div class="copy">
          <p class="num">Step {{ active() + 1 }}</p>
          <h3>{{ step.title }}</h3>
          <p>{{ step.text }}</p>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="How it works steps">
        @for (s of steps; track s.tab; let i = $index) {
          <button
            type="button"
            role="tab"
            class="tab"
            [id]="'how-tab-' + i"
            aria-controls="how-panel"
            [attr.aria-selected]="i === active()"
            [attr.tabindex]="i === active() ? 0 : -1"
            [class.active]="i === active()"
            (click)="select(i)"
            (keydown.arrowright)="select((i + 1) % steps.length, $event)"
            (keydown.arrowleft)="select((i + steps.length - 1) % steps.length, $event)"
          >
            <span class="tab-num">{{ i + 1 }}</span> {{ s.tab }}
          </button>
        }
      </div>

      <a class="cta start" [href]="startHref()">Get started for free</a>
    </section>
  `,
  styles: `
    :host { display: block; margin-block: var(--space-7); }
    .how { display: flex; flex-direction: column; align-items: center; gap: 32px; }
    h2 { font-size: clamp(2rem, 4.2vw, 3rem); font-weight: 700; letter-spacing: -1.5px; text-align: center; }
    .card { display: grid; grid-template-columns: 1.15fr 1fr; align-items: center; gap: 48px; width: 100%; padding: 40px; border-radius: 24px; background: var(--primary-gradient); color: var(--white); }
    .frame { display: grid; place-items: center; min-height: 380px; padding: 24px; border-radius: 18px; background: var(--bg); box-shadow: var(--shadow-lg); }
    .mock { width: 100%; max-width: 440px; animation: fade .35s ease; }
    .stack { display: grid; gap: 14px; }
    .copy { display: grid; gap: 12px; }
    .num { color: var(--primary-100); font-size: var(--text-sm); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
    h3 { font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 700; letter-spacing: -.8px; line-height: 1.15; }
    .copy p:last-child { color: var(--primary-50); font-size: var(--text-lg); line-height: 1.6; }

    .question { display: grid; gap: 12px; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
    .q-title { font-weight: 650; }
    .question ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .question li { padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: var(--text-sm); }
    .question li.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--pill-text); font-weight: 600; }
    .question .cta { justify-self: end; }
    .pdf { display: flex; align-items: flex-end; gap: 12px; }
    .sheet { flex: 1; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }

    .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; border-bottom: 1px solid var(--border); }
    .tab { justify-content: center; min-height: 52px; border: 0; border-bottom: 3px solid transparent; border-radius: 0; background: none; color: var(--text-muted); font-size: var(--text-base); }
    .tab:hover { color: var(--text); }
    .tab.active { border-bottom-color: var(--accent); color: var(--text); }
    .tab-num { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--surface-raised); font-size: var(--text-sm); }
    .tab.active .tab-num { background: var(--button-bg); color: var(--button-text); }

    @keyframes fade { from { opacity: 0; transform: translateY(6px); } }
    @media (prefers-reduced-motion: reduce) { .mock { animation: none; } }
    @media (max-width: 860px) {
      .card { grid-template-columns: 1fr; gap: 28px; padding: 20px; }
      .frame { min-height: 0; padding: 16px; }
      .tab { flex-direction: column; gap: 4px; font-size: var(--text-sm); }
    }
  `,
})
export class HowItWorks {
  readonly steps = STEPS;
  readonly challenge = ONBOARDING_STEPS[0] as { title: string; options: OnboardingOption[] };
  readonly sampleCv = SAMPLE_CV;
  readonly template = DEFAULT_TEMPLATE;
  readonly startHref = inject(AuthService).startHref;
  readonly active = signal(0);
  readonly paused = signal(false);
  readonly animate = !prefersReducedMotion();

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.animate) return;
      const timer = setInterval(() => {
        if (!this.paused()) this.active.update((i) => (i + 1) % STEPS.length);
      }, ADVANCE_MS);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  select(index: number, event?: Event): void {
    this.active.set(index);
    if (event) {
      event.preventDefault();
      document.getElementById(`how-tab-${index}`)?.focus();
    }
  }
}
