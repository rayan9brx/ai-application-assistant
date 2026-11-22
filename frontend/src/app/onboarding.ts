import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { CvApi } from './cv-api';

const DEFER_KEY = 'onboarding-deferred';

/**
 * The one-time onboarding question. It opens for a signed-in user whose profile says it hasn't
 * been answered or skipped yet, unless they signed in on the way to somewhere (a returnUrl):
 * then it waits until their next visit (a new browser session).
 */
@Injectable({ providedIn: 'root' })
export class Onboarding {
  private readonly auth = inject(AuthService);
  private readonly api = inject(CvApi);
  readonly open = signal(false);
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

  /** Called by /login and /signup when the user is headed to a returnUrl. */
  static deferForThisVisit(): void {
    try {
      sessionStorage.setItem(DEFER_KEY, '1');
    } catch {
      // Without storage the question may simply show on this visit.
    }
  }

  /** Records the answer (or "skipped") and closes the question; never blocks the user. */
  async complete(answer: string): Promise<void> {
    this.open.set(false);
    // Don't ask again on this visit even if saving fails; it comes back next visit then.
    Onboarding.deferForThisVisit();
    try {
      await this.api.completeOnboarding(answer);
    } catch {
      // Ignored: the answer is only for statistics.
    }
  }

  private async check(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId || userId === this.checkedFor || this.deferred()) return;
    this.checkedFor = userId;
    try {
      const profile = await this.api.me();
      if (this.auth.user()?.id === userId && !profile.onboardingDone && !this.deferred())
        this.open.set(true);
    } catch {
      this.checkedFor = null;
    }
  }

  private deferred(): boolean {
    try {
      return sessionStorage.getItem(DEFER_KEY) === '1';
    } catch {
      return false;
    }
  }
}
