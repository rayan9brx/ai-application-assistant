import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from './auth.service';
import { Navigation } from './navigation';
import { Onboarding } from './onboarding';
import { ONBOARDING_OPTIONS, OnboardingOption } from './onboarding-options';

/** The one-time "biggest challenge" question, as a dark overlay in the style of /signup. */
@Component({
  selector: 'app-onboarding-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="backdrop">
        <section
          #dialog
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          tabindex="-1"
          (keydown.escape)="skip()"
        >
          <p class="step">Welcome to ApplyCraft</p>
          <h2 id="onboarding-title">What’s your biggest challenge right now?</h2>
          <p class="subtitle">We’ll take you to the right place to start.</p>

          <fieldset>
            <legend class="sr-only">Your biggest challenge</legend>
            @for (option of options; track option.key) {
              <label class="option" [class.selected]="selected()?.key === option.key">
                <input
                  type="radio"
                  name="onboarding-answer"
                  [value]="option.key"
                  [checked]="selected()?.key === option.key"
                  (change)="selected.set(option)"
                />
                <span class="dot" aria-hidden="true"></span>
                <span>{{ option.label }}</span>
              </label>
            }
          </fieldset>

          <button class="primary" type="button" [disabled]="!selected()" (click)="continue()">
            Continue
          </button>
          <button class="skip" type="button" (click)="skip()">Skip</button>
        </section>
      </div>
    }
    @if (note()) {
      <div class="note" role="status">
        <span>Job search is coming soon. We’ll notify you.</span>
        <button type="button" aria-label="Dismiss" (click)="note.set(false)">×</button>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px;
      overflow-y: auto; background: #0a0f1ecc; backdrop-filter: blur(6px); color-scheme: dark;
    }
    .dialog {
      width: min(480px, 100%); padding: 32px; border: 1px solid #262f4b; border-radius: 16px;
      background: radial-gradient(ellipse 80% 60% at 100% 0%, #4b3fb040, transparent 70%), #0f1629;
      box-shadow: 0 24px 64px #0008; color: #e7e9f3;
    }
    .dialog:focus { outline: none; }
    .step { color: #b4adff; font-size: 12px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; }
    h2 { margin-top: 8px; color: #fff; font-size: clamp(1.3rem, 2.4vw, 1.5rem); letter-spacing: -.5px; }
    .subtitle { margin-top: 6px; color: #8d95ad; font-size: var(--text-sm); }
    fieldset { display: grid; gap: 10px; margin: 24px 0 0; padding: 0; border: 0; }
    .option {
      display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 12px 16px;
      border: 1px solid #29334f; border-radius: 12px; background: #161f37; color: #e7e9f3;
      font-size: .9rem; font-weight: 550; cursor: pointer; transition: border-color .15s, background-color .15s;
    }
    .option:hover { border-color: #36416a; }
    .option.selected { border-color: #8b85ff; background: #1c2245; box-shadow: 0 0 0 1px #8b85ff; }
    .option:has(input:focus-visible) { outline: 3px solid #b4adff; outline-offset: 2px; }
    .option input { position: absolute; opacity: 0; pointer-events: none; }
    .dot { flex: none; width: 18px; height: 18px; border: 2px solid #4a5478; border-radius: 50%; transition: border-color .15s; }
    .selected .dot { border-color: #b4adff; background: radial-gradient(circle, #b4adff 0 4px, transparent 5px); }
    .primary {
      width: 100%; min-height: 48px; margin-top: 24px; border: 0; border-radius: 10px;
      background: #b4adff; color: #0f1629; font-size: .9rem; font-weight: 700; transition: background-color .15s;
    }
    .primary:hover:not(:disabled) { background: #c7c2ff; }
    .primary:disabled { background: #b4adff; color: #0f1629; opacity: .4; }
    .primary:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
    .skip {
      display: flex; min-height: 40px; margin: 8px auto 0; padding: 6px 12px; border: 0; background: none;
      color: #8d95ad; font-size: var(--text-sm); font-weight: 500; text-decoration: underline; text-underline-offset: 3px;
    }
    .skip:hover { color: #fff; }
    .skip:focus-visible { outline: 2px solid #b4adff; outline-offset: 2px; }
    .note {
      position: fixed; bottom: 24px; left: 50%; z-index: 90; display: flex; align-items: center; gap: 12px;
      width: max-content; max-width: calc(100% - 32px); padding: 10px 10px 10px 18px; border-radius: 999px;
      background: #20293d; color: #fff; font-size: var(--text-sm); box-shadow: 0 8px 24px #20293d33; transform: translateX(-50%);
    }
    .note button { min-height: 32px; width: 32px; padding: 0; border: 0; border-radius: 50%; background: #ffffff1a; color: #fff; font-size: 1.1rem; }
    .note button:hover { background: #ffffff33; }
    @media (max-width: 520px) {
      .dialog { padding: 24px 20px; }
    }
  `,
})
export class OnboardingDialog {
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(Onboarding);
  private readonly navigation = inject(Navigation);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  readonly options = ONBOARDING_OPTIONS;
  readonly selected = signal<OnboardingOption | null>(null);
  readonly note = signal(false);
  /** Not while a password-reset link is being completed. */
  readonly visible = computed(() => this.onboarding.open() && !this.auth.recovering());

  constructor() {
    effect((onCleanup) => {
      if (!this.visible()) return;
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => (document.body.style.overflow = previous));
    });
    effect(() => this.dialog()?.nativeElement.focus());
  }

  async continue(): Promise<void> {
    const option = this.selected();
    if (!option) return;
    void this.onboarding.complete(option.key);
    await this.navigation.go(option.href);
    if (option.key === 'job_search') this.note.set(true);
  }

  skip(): void {
    void this.onboarding.complete('skipped');
  }
}
