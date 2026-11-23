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

/**
 * Four steps from sign-up to applying. All steps are stacked in one grid cell and crossfade,
 * so the card keeps the tallest step's height. Tabs auto-advance every 5s, pausing on hover/focus.
 */
@Component({
  selector: 'app-how-it-works',
  imports: [AtsScoreMock, BulletRewriteMock, CvSheet, TemplatePicker, UploadBar],
  template: `
    <section
      class="how"
      aria-labelledby="how-title"
      [class.paused]="paused()"
      [style.--advance]="advanceMs + 'ms'"
      (mouseenter)="paused.set(true)"
      (mouseleave)="paused.set(false)"
      (focusin)="paused.set(true)"
      (focusout)="paused.set(false)"
    >
      <header class="intro">
        <p class="pill-badge">How it works</p>
        <h2 id="how-title">From sign-up to applying in four steps</h2>
      </header>

      <div class="card" role="tabpanel" id="how-panel" [attr.aria-labelledby]="'how-tab-' + active()">
        <div class="stage">
          <div class="window theme-light">
            <div class="titlebar" aria-hidden="true">
              <span class="lights"><i></i><i></i><i></i></span>
              <span class="address">app.rezumo.com</span>
            </div>
            <div class="screen">
              @for (s of steps; track s.tab; let i = $index) {
                <div class="layer mock" inert [class.on]="i === active()" [attr.aria-hidden]="i !== active()">
                  @switch (s.visual) {
                    @case ('signup') {
                      <div class="question">
                        <p class="q-title">{{ challenge.title }}</p>
                        <ul role="list">
                          @for (option of challenge.options; track option.key; let j = $index) {
                            <li [class.selected]="j === 1">
                              <span class="radio"></span>{{ option.label }}
                            </li>
                          }
                        </ul>
                        <span class="cta cta-small">Continue</span>
                      </div>
                    }
                    @case ('upload') {
                      <div class="stack">
                        <app-upload-bar [showSubmit]="false" />
                        <app-ats-score-mock [play]="i === active()" [animate]="animate" />
                      </div>
                    }
                    @case ('fix') {
                      <app-bullet-rewrite-mock [play]="i === active()" [animate]="animate" />
                    }
                    @case ('apply') {
                      <div class="stack">
                        <app-template-picker [text]="sampleCv" [value]="template" />
                        <div class="pdf">
                          <app-cv-sheet class="sheet" [text]="sampleCv" [template]="template" crop="1 / .5" [decorative]="true" />
                          <span class="cta cta-small">Download PDF</span>
                        </div>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <div class="copy">
          @for (s of steps; track s.tab; let i = $index) {
            <div class="layer" [class.on]="i === active()" [attr.aria-hidden]="i !== active()">
              <span class="num" aria-hidden="true">0{{ i + 1 }}</span>
              <h3>{{ s.title }}</h3>
              <p>{{ s.text }}</p>
            </div>
          }
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
            [class.done]="i < active()"
            (click)="select(i)"
            (keydown.arrowright)="select((i + 1) % steps.length, $event)"
            (keydown.arrowleft)="select((i + steps.length - 1) % steps.length, $event)"
          >
            <span class="track" aria-hidden="true"><span class="fill" [class.timed]="animate"></span></span>
            <span class="label"><span class="tab-num">{{ i + 1 }}</span>{{ s.tab }}</span>
          </button>
        }
      </div>

      <div class="after">
        <a class="cta" [href]="startHref()">Get started for free</a>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; padding-block: 120px; }
    .intro { display: grid; justify-items: center; gap: 16px; margin-bottom: 48px; text-align: center; }
    h2 { max-width: 20ch; font-size: clamp(2rem, 4.4vw, 3rem); font-weight: 700; line-height: 1.05; letter-spacing: -.04em; text-wrap: balance; }

    .card { display: grid; grid-template-columns: 3fr 2fr; align-items: center; gap: 56px; padding: 24px 56px 24px 24px; border: 1px solid var(--border); border-radius: 24px; background: var(--surface); box-shadow: var(--shadow); }
    .stage { padding: 40px; border-radius: 18px; background: var(--primary-50); }
    .window { overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-raised); box-shadow: 0 30px 60px -24px color-mix(in srgb, var(--primary-900) 30%, transparent), 0 10px 24px -12px color-mix(in srgb, var(--text) 14%, transparent); }
    .titlebar { position: relative; display: flex; align-items: center; height: 36px; padding-inline: 14px; }
    .lights { display: flex; gap: 7px; }
    .lights i { width: 11px; height: 11px; border-radius: 50%; background: var(--danger); box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--black) 12%, transparent); }
    .lights i:nth-child(2) { background: var(--warning); }
    .lights i:nth-child(3) { background: var(--success); }
    .address { position: absolute; left: 50%; transform: translateX(-50%); padding: 2px 14px; border-radius: 6px; background: var(--surface); color: var(--text-muted); font-size: 11px; }
    .screen { display: grid; padding: 24px; background: var(--surface); }

    /* Crossfade: every step sits in the same cell; only .on is visible. */
    .screen, .copy { display: grid; }
    .layer { grid-area: 1 / 1; align-self: center; opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .45s ease, transform .45s ease, visibility 0s linear .45s; }
    .layer.on { opacity: 1; visibility: visible; transform: none; transition: opacity .45s ease, transform .45s ease, visibility 0s; }
    .stack { display: grid; gap: 14px; }

    .question { display: grid; gap: 12px; }
    .q-title { font-size: var(--text-lg); font-weight: 650; letter-spacing: -.2px; }
    .question ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .question li { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: var(--text-sm); }
    .radio { flex: none; width: 16px; height: 16px; border: 1.5px solid var(--border-strong); border-radius: 50%; }
    .question li.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--pill-text); font-weight: 600; }
    .question li.selected .radio { border: 5px solid var(--accent); }
    .question .cta { justify-self: end; }
    .pdf { display: flex; align-items: flex-end; gap: 12px; }
    .sheet { flex: 1; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-sm); }

    .copy .layer { display: grid; gap: 14px; }
    .num { color: var(--primary-200); font-size: clamp(3.5rem, 6vw, 5rem); font-weight: 700; line-height: 1; letter-spacing: -.04em; }
    h3 { color: var(--text); font-size: 1.75rem; font-weight: 700; line-height: 1.2; letter-spacing: -.6px; }
    .copy p { max-width: 34ch; color: var(--text-secondary); font-size: var(--text-lg); line-height: 1.6; }

    .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 32px; }
    .tab { display: grid; gap: 14px; justify-items: start; min-height: 0; padding: 0 0 6px; border: 0; border-radius: 0; background: none; color: var(--text-muted); font-size: var(--text-base); text-align: left; }
    .tab:hover { color: var(--text); }
    .tab:focus-visible { outline-offset: 4px; }
    .tab.active { color: var(--text); }
    .track { width: 100%; height: 3px; overflow: hidden; border-radius: 3px; background: var(--border); }
    .fill { display: block; height: 100%; background: var(--accent); transform: scaleX(0); transform-origin: left; }
    .done .fill { transform: none; opacity: .35; }
    .active .fill { transform: none; }
    .active .fill.timed { animation: fill var(--advance) linear forwards; }
    .paused .active .fill.timed { animation-play-state: paused; }
    .label { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; }
    .tab-num { display: inline-grid; place-items: center; width: 28px; height: 28px; border: 1.5px solid var(--border-strong); border-radius: 50%; color: var(--text-muted); font-size: var(--text-sm); transition: background-color .2s, border-color .2s, color .2s; }
    .active .tab-num { border-color: var(--button-bg); background: var(--button-bg); color: var(--button-text); }

    .after { display: flex; justify-content: center; margin-top: 48px; }
    .after .cta { box-shadow: 0 8px 20px -6px color-mix(in srgb, var(--primary-700) 45%, transparent); }

    @keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) { .layer, .layer.on { transition: none; transform: none; } }
    @media (max-width: 900px) {
      :host { padding-block: 72px; }
      .card { grid-template-columns: 1fr; gap: 28px; padding: 16px 16px 28px; }
      .stage { padding: 16px; }
      .screen { padding: 16px; }
      .copy { padding-inline: 8px; }
      .num { font-size: 3rem; }
      h3 { font-size: 1.5rem; }
      .tabs { display: flex; gap: 20px; margin-inline: -16px; padding-inline: 16px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
      .tabs::-webkit-scrollbar { display: none; }
      .tab { flex: none; width: 140px; scroll-snap-align: start; }
    }
  `,
})
export class HowItWorks {
  readonly steps = STEPS;
  readonly challenge = ONBOARDING_STEPS[0] as { title: string; options: OnboardingOption[] };
  readonly sampleCv = SAMPLE_CV;
  readonly template = DEFAULT_TEMPLATE;
  readonly advanceMs = ADVANCE_MS;
  readonly startHref = inject(AuthService).startHref;
  readonly active = signal(0);
  readonly paused = signal(false);
  readonly animate = !prefersReducedMotion();

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.animate) return;
      let elapsed = 0;
      const tick = 100;
      const timer = setInterval(() => {
        if (this.paused()) return;
        elapsed += tick;
        if (elapsed >= ADVANCE_MS) this.select((this.active() + 1) % STEPS.length);
      }, tick);
      this.restart = () => (elapsed = 0);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  private restart = () => {};

  select(index: number, event?: Event): void {
    this.active.set(index);
    this.restart();
    if (event) {
      event.preventDefault();
      document.getElementById(`how-tab-${index}`)?.focus();
    }
  }
}
