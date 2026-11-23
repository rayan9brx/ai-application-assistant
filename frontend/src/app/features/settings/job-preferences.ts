import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CvApi } from '../../core/cv-api';
import { CvFlow } from '../../core/cv-flow';
import {
  EMPTY_ANSWERS,
  ONBOARDING_STEPS,
  OnboardingAnswers,
  OnboardingOption,
  OnboardingStep,
  cleanLocation,
} from '../../core/onboarding-options';

/** Settings → Job preferences: the onboarding answers, editable. */
@Component({
  selector: 'app-job-preferences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="help" role="status">Loading…</p>
    } @else {
      <form (submit)="save($event)" novalidate>
        <p class="help">We use these to tailor suggestions and, soon, job matches.</p>
        @for (s of steps; track s.field) {
          @if (s.kind === 'chips') {
            <div class="question">
              <label class="q-title" for="pref-location">{{ s.short }}</label>
              <div class="chips">
                @for (l of answers().locations; track l) {
                  <span class="chip">{{ l }}
                    <button type="button" [attr.aria-label]="'Remove ' + l" (click)="removeLocation(l)">×</button>
                  </span>
                }
              </div>
              <input id="pref-location" type="text" autocomplete="off" maxlength="60"
                placeholder="Add a city or Remote and press Enter" [value]="locationText()"
                (input)="locationText.set(value($event))" (keydown.enter)="addLocation($event)" />
            </div>
          } @else {
            <fieldset class="question">
              <legend class="q-title">{{ s.short }}</legend>
              <div class="options">
                @for (o of optionsOf(s); track o.key) {
                  <label class="option" [class.selected]="picked(s, o.key)" [title]="o.sub ?? ''">
                    <input [type]="s.kind === 'multi' ? 'checkbox' : 'radio'" [name]="'pref-' + s.field"
                      [value]="o.key" [checked]="picked(s, o.key)" (change)="choose(s, o.key)" />
                    {{ o.label }}
                  </label>
                }
              </div>
            </fieldset>
          }
        }
        @if (state().error) {
          <p class="error" role="alert">{{ state().error }}</p>
        }
        @if (state().done) {
          <p class="notice" role="status">Your job preferences are saved.</p>
        }
        <button class="cta cta-small" type="submit" [disabled]="state().busy">
          {{ state().busy ? 'Saving…' : 'Save preferences' }}
        </button>
      </form>
    }
  `,
  styles: `
    :host { display: block; }
    form { display: grid; gap: var(--space-5); }
    .help { color: var(--text-secondary); font-size: var(--text-sm); }
    .question { display: grid; gap: var(--space-2); min-width: 0; margin: 0; padding: 0; border: 0; }
    .q-title { padding: 0; font-size: var(--text-sm); font-weight: 650; }
    .options, .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .option {
      position: relative; display: inline-flex; align-items: center; min-height: 36px; padding: 6px 14px;
      border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface);
      font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: border-color .15s, background-color .15s;
    }
    .option:hover { border-color: var(--text); }
    .option.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 600; }
    .option:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
    .option input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
    .chip { display: inline-flex; align-items: center; gap: 2px; padding: 2px 2px 2px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: var(--text-sm); font-weight: 600; }
    .chip button { width: 28px; min-height: 28px; padding: 0; border: 0; border-radius: 50%; background: none; color: inherit; font-size: 1rem; }
    .chip button:hover { background: color-mix(in srgb, var(--primary-700) 12%, transparent); }
    input[type='text'] { min-height: 44px; padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; }
    input[type='text']:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
    .error { padding: 10px 12px; border-radius: var(--radius-sm); background: var(--danger-bg); color: var(--danger-text); font-size: var(--text-sm); }
    .notice { padding: 10px 12px; border-radius: var(--radius-sm); background: var(--success-bg); color: var(--success-text); font-size: var(--text-sm); }
    .cta { justify-self: start; }
  `,
})
export class JobPreferences {
  private readonly api = inject(CvApi);
  readonly steps = ONBOARDING_STEPS;
  readonly answers = signal<OnboardingAnswers>(EMPTY_ANSWERS);
  readonly loading = signal(true);
  readonly locationText = signal('');
  readonly state = signal<{ busy?: boolean; error?: string; done?: boolean }>({});

  constructor() {
    this.api.onboarding().then(
      (state) => {
        this.answers.set(state.answers);
        this.loading.set(false);
      },
      (error) => {
        this.loading.set(false);
        this.state.set({ error: CvFlow.message(error, 'Your job preferences couldn’t be loaded.') });
      },
    );
  }

  optionsOf(step: OnboardingStep): OnboardingOption[] {
    return step.kind === 'chips' ? [] : step.options;
  }

  picked(step: OnboardingStep, key: string): boolean {
    const value = this.answers()[step.field];
    return Array.isArray(value) ? value.includes(key) : value === key;
  }

  choose(step: OnboardingStep, key: string): void {
    this.state.set({});
    if (step.kind === 'multi') {
      const field = step.field;
      this.answers.update((a) => ({
        ...a,
        [field]: a[field].includes(key) ? a[field].filter((k) => k !== key) : [...a[field], key],
      }));
    } else if (step.kind !== 'chips') {
      const field = step.field;
      this.answers.update((a) => ({ ...a, [field]: key }));
    }
  }

  addLocation(event: Event): void {
    event.preventDefault();
    const clean = cleanLocation(this.locationText(), this.answers().locations);
    if (clean) this.answers.update((a) => ({ ...a, locations: [...a.locations, clean] }));
    this.locationText.set('');
    this.state.set({});
  }

  removeLocation(location: string): void {
    this.answers.update((a) => ({ ...a, locations: a.locations.filter((l) => l !== location) }));
    this.state.set({});
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.state().busy) return;
    // A location typed but not yet added with Enter is kept too.
    const pending = cleanLocation(this.locationText(), this.answers().locations);
    if (pending) {
      this.answers.update((a) => ({ ...a, locations: [...a.locations, pending] }));
      this.locationText.set('');
    }
    this.state.set({ busy: true });
    try {
      const saved = await this.api.saveOnboarding(this.answers(), 'edit');
      this.answers.set(saved.answers);
      this.state.set({ done: true });
    } catch (error) {
      this.state.set({ error: CvFlow.message(error, 'Saving your job preferences failed.') });
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
