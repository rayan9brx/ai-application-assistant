import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { safeNext } from './auth.guard';
import { CvApi, OnboardingStatus } from './cv-api';
import { EMPTY_ANSWERS, ONBOARDING_STEPS, OnboardingAnswers, isAnswered } from './onboarding-options';

const RETURN_KEY = 'onboarding-return-url';

/**
 * The one-time onboarding flow. It opens for a signed-in user who has neither finished nor
 * skipped it, and resumes at the first unanswered step. Answers are saved after every step.
 */
@Injectable({ providedIn: 'root' })
export class Onboarding {
  private readonly auth = inject(AuthService);
  private readonly api = inject(CvApi);
  readonly open = signal(false);
  readonly answers = signal<OnboardingAnswers>(EMPTY_ANSWERS);
  /** 0-based step to open on. */
  readonly startStep = signal(0);
  private checkedFor: string | null = null;

  constructor() {
    this.auth.onChange((event) => {
      if (event === 'SIGNED_OUT') {
        this.checkedFor = null;
        this.open.set(false);
      } else void this.check();
    });
    void this.auth.whenReady().then(() => this.check());
  }

  /** /login and /signup: where the user was headed, to go there after the flow instead. */
  static rememberReturnUrl(url: string | undefined): void {
    try {
      if (url) sessionStorage.setItem(RETURN_KEY, safeNext(url));
      else sessionStorage.removeItem(RETURN_KEY);
    } catch {
      // Without storage the flow simply ends on its usual page.
    }
  }

  /** The remembered returnUrl, once. */
  takeReturnUrl(): string | null {
    try {
      const url = sessionStorage.getItem(RETURN_KEY);
      sessionStorage.removeItem(RETURN_KEY);
      return url ? safeNext(url) : null;
    } catch {
      return null;
    }
  }

  /** Saves the answers so far; a failed save never blocks the flow. */
  async save(status: OnboardingStatus, step?: number): Promise<void> {
    try {
      await this.api.saveOnboarding(this.answers(), status, step);
    } catch {
      // The answers stay in memory; the next step's save sends them again.
    }
  }

  /** "Skip for now" on a 1-based step: keeps the partial answers and never shows the flow again. */
  skip(step: number): void {
    this.open.set(false);
    void this.save('skipped', step);
  }

  close(): void {
    this.open.set(false);
  }

  private async check(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId || userId === this.checkedFor) return;
    this.checkedFor = userId;
    try {
      const state = await this.api.onboarding();
      if (this.auth.user()?.id !== userId || state.done) return;
      this.answers.set(state.answers);
      const next = ONBOARDING_STEPS.findIndex((step) => !isAnswered(step, state.answers));
      this.startStep.set(next === -1 ? ONBOARDING_STEPS.length - 1 : next);
      this.open.set(true);
    } catch {
      this.checkedFor = null;
    }
  }
}
