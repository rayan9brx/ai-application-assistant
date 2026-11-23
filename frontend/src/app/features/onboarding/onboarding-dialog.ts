import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { Logo } from '../../shared/logo';
import { Navigation } from '../../core/navigation';
import { Onboarding } from './onboarding';
import {
  ONBOARDING_STEPS,
  OnboardingOption,
  OnboardingStep,
  cleanLocation,
  destinationFor,
  isAnswered,
} from '../../core/onboarding-options';

/**
 * The one-time onboarding flow: eight steps over a blurred page, then a success screen.
 * Each "Continue" saves the answers so far, so skipping keeps what was given.
 */
@Component({
  selector: 'app-onboarding-dialog',
  imports: [Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-dialog.html',
  styleUrl: './onboarding-dialog.scss',
})
export class OnboardingDialog {
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(Onboarding);
  private readonly navigation = inject(Navigation);
  private readonly injector = inject(Injector);
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  readonly steps = ONBOARDING_STEPS;
  readonly step = signal(0);
  readonly finished = signal(false);
  readonly direction = signal<'forward' | 'back'>('forward');
  readonly locationText = signal('');
  readonly note = signal(false);
  readonly answers = this.onboarding.answers;
  readonly current = computed(() => this.steps[this.step()]);
  readonly answered = computed(() => isAnswered(this.current(), this.answers()));
  /** Not while a password-reset link is being completed. */
  readonly visible = computed(() => this.onboarding.open() && !this.auth.recovering());
  readonly firstName = computed(() => {
    const name = this.auth.user()?.user_metadata?.['full_name'];
    return typeof name === 'string' ? (name.trim().split(/\s+/)[0] ?? '') : '';
  });
  /** Unused suggestions matching what's typed. */
  readonly suggestions = computed(() => {
    const step = this.current();
    if (step.kind !== 'chips') return [];
    const typed = this.locationText().trim().toLowerCase();
    const chosen = this.answers().locations.map((l) => l.toLowerCase());
    return step.suggestions.filter(
      (city) => !chosen.includes(city.toLowerCase()) && city.toLowerCase().includes(typed),
    );
  });
  private readonly returnUrl = signal<string | null>(null);
  private readonly destination = computed(() => destinationFor(this.answers()));
  readonly finishLabel = computed(() => {
    const target = this.returnUrl() ?? this.destination();
    if (target.startsWith('/check')) return 'Let’s check your CV';
    return target.startsWith('/dashboard') ? 'Go to my dashboard' : 'Continue';
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.visible()) return;
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => (document.body.style.overflow = previous));
    });
    // Each time the flow opens: resume where the user left off.
    effect(() => {
      if (!this.onboarding.open()) return;
      this.step.set(this.onboarding.startStep());
      this.finished.set(false);
      this.focusStep();
    });
  }

  optionsOf(step: OnboardingStep): OnboardingOption[] {
    return step.kind === 'chips' ? [] : step.options;
  }

  isGrid(step: OnboardingStep): boolean {
    return step.kind === 'multi' && !!step.grid;
  }

  picked(step: OnboardingStep, key: string): boolean {
    const value = this.answers()[step.field];
    return Array.isArray(value) ? value.includes(key) : value === key;
  }

  /** Selects a single-choice option, or toggles a multi-choice one. */
  choose(step: OnboardingStep, key: string): void {
    if (step.kind === 'chips') return;
    if (step.kind === 'multi') {
      const field = step.field;
      this.answers.update((a) => ({
        ...a,
        [field]: a[field].includes(key) ? a[field].filter((k) => k !== key) : [...a[field], key],
      }));
    } else {
      const field = step.field;
      this.answers.update((a) => ({ ...a, [field]: key }));
    }
  }

  addLocation(event: Event): void {
    const text = this.locationText();
    if (!text.trim()) return; // Enter in an empty field continues (see keydown).
    event.preventDefault();
    event.stopPropagation();
    this.pickLocation(text);
  }

  pickLocation(text: string): void {
    const clean = cleanLocation(text, this.answers().locations);
    if (clean) this.answers.update((a) => ({ ...a, locations: [...a.locations, clean] }));
    this.locationText.set('');
    this.frame()?.nativeElement.querySelector<HTMLInputElement>('#ob-location')?.focus();
  }

  removeLocation(location: string): void {
    this.answers.update((a) => ({ ...a, locations: a.locations.filter((l) => l !== location) }));
    this.frame()?.nativeElement.querySelector<HTMLInputElement>('#ob-location')?.focus();
  }

  /** Backspace in the empty field removes the last chip. */
  backspace(): void {
    const locations = this.answers().locations;
    if (!this.locationText() && locations.length) this.removeLocation(locations[locations.length - 1]);
  }

  next(): void {
    if (!this.answered()) return;
    const last = this.step() === this.steps.length - 1;
    void this.onboarding.save(last ? 'completed' : 'progress', this.step() + 1);
    this.direction.set('forward');
    if (last) {
      this.returnUrl.set(this.onboarding.takeReturnUrl());
      this.finished.set(true);
    } else {
      this.step.update((s) => s + 1);
    }
    this.focusStep();
  }

  back(): void {
    if (this.step() === 0) return;
    this.direction.set('back');
    this.step.update((s) => s - 1);
    this.focusStep();
  }

  skip(): void {
    this.onboarding.skip(this.step() + 1);
    const returnUrl = this.onboarding.takeReturnUrl();
    if (returnUrl) void this.navigation.go(returnUrl);
  }

  async finish(): Promise<void> {
    const target = this.returnUrl() ?? this.destination();
    this.onboarding.close();
    await this.navigation.go(target);
    if (!this.returnUrl() && this.answers().challenge === 'job_search') this.note.set(true);
  }

  /** Enter continues; Tab stays inside the dialog. */
  keydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (event.key === 'Enter' && !event.defaultPrevented) {
      // Buttons and links handle Enter themselves.
      if (target.closest('button, a')) return;
      event.preventDefault();
      if (this.finished()) void this.finish();
      else this.next();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  /** Arrow keys move between checkboxes too (radio groups already do this natively). */
  arrows(event: KeyboardEvent): void {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
    const input = event.target as HTMLInputElement;
    if (!keys.includes(event.key) || input.type !== 'checkbox') return;
    event.preventDefault();
    const inputs = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLInputElement>('input')];
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const index = inputs.indexOf(input) + (forward ? 1 : -1);
    inputs[(index + inputs.length) % inputs.length]?.focus();
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private trapFocus(event: KeyboardEvent): void {
    const frame = this.frame()?.nativeElement;
    if (!frame) return;
    // The first and last are always buttons (Skip / Continue), so radio groups don't matter here.
    const focusable = [...frame.querySelectorAll<HTMLElement>('button:not([disabled]), input')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Focuses the step's chosen option (or its first one), or the success button. */
  private focusStep(): void {
    afterNextRender(
      () => {
        const frame = this.frame()?.nativeElement;
        const target =
          frame?.querySelector<HTMLElement>('.step input:checked') ??
          frame?.querySelector<HTMLElement>('.step input') ??
          frame?.querySelector<HTMLElement>('.step .primary');
        target?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
}
