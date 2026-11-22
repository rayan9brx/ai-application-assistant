import { Component, computed, inject, input, signal } from '@angular/core';
import { AuthService, signupUrl } from './auth.service';
import { safeNext } from './auth.guard';
import { AuthShell } from './auth-shell';
import { GoogleButton } from './google-button';
import { Navigation } from './navigation';
import { Onboarding } from './onboarding';

/** /login */
@Component({
  selector: 'app-login-page',
  imports: [AuthShell, GoogleButton],
  template: `
    <app-auth-shell>
      <section aria-labelledby="login-title">
        <h1 id="login-title">Welcome back</h1>
        <p class="subtitle">Your saved CVs and scores are waiting.</p>
        @if (returnUrl()) {
          <p class="return-note" role="status">Log in to score your CV</p>
        }

        <app-google-button class="social" [busy]="googleBusy()" (pressed)="google()" />
        <p class="divider" role="separator">OR</p>

        <form (submit)="submit($event)" novalidate>
          <div class="field">
            <label for="login-email">Your email</label>
            <input id="login-email" name="email" type="email" autocomplete="email" required
              placeholder="you@example.com" [attr.aria-invalid]="!!error() || null"
              [attr.aria-describedby]="error() ? 'login-error' : null"
              [value]="email()" (input)="email.set(value($event))" />
          </div>
          <div class="field">
            <div class="label-row">
              <label for="login-password">Your password</label>
              <a class="link" href="/reset-password">Forgot password?</a>
            </div>
            <div class="password">
              <input id="login-password" name="password" autocomplete="current-password" required
                [type]="showPassword() ? 'text' : 'password'" [attr.aria-invalid]="!!error() || null"
                [value]="password()" (input)="password.set(value($event))" />
              <button type="button" class="eye" [attr.aria-pressed]="showPassword()"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                (click)="showPassword.set(!showPassword())">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M1.5 10S4.5 4.5 10 4.5s8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S1.5 10 1.5 10z" />
                  <circle cx="10" cy="10" r="2.5" />
                  @if (showPassword()) { <path d="M3 3l14 14" /> }
                </svg>
              </button>
            </div>
          </div>
          <button class="primary" type="submit" [disabled]="busy()">
            @if (busy()) { <span class="spinner" aria-hidden="true"></span> Logging in… }
            @else { Log in }
          </button>
          @if (error()) {
            <p class="error" id="login-error" role="alert">{{ error() }}</p>
          }
        </form>

        <p class="alt">New here? <a class="link" [href]="signupHref()">Create a free account</a></p>
      </section>
    </app-auth-shell>
  `,
  styleUrl: './auth-form.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(Navigation);
  /** ?returnUrl= from a gated link or the auth guard. */
  readonly returnUrl = input<string>();
  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly busy = signal(false);
  readonly googleBusy = signal(false);
  readonly error = signal('');
  readonly signupHref = computed(() =>
    this.returnUrl() ? signupUrl(safeNext(this.returnUrl())) : '/signup',
  );

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    if (!this.email().trim() || !this.password()) {
      this.error.set('Enter your email and password.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      this.deferOnboarding();
      await this.auth.signIn(this.email().trim(), this.password());
      await this.navigation.go(safeNext(this.returnUrl()));
    } catch (error) {
      this.error.set(AuthService.message(error, 'Logging in failed. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  async google(): Promise<void> {
    if (this.googleBusy()) return;
    this.googleBusy.set(true);
    this.error.set('');
    try {
      this.deferOnboarding();
      await this.auth.signInWithGoogle(safeNext(this.returnUrl()));
    } catch (error) {
      this.error.set(AuthService.message(error, 'Logging in with Google failed. Please try again.'));
      this.googleBusy.set(false);
    }
  }

  /** Headed to a returnUrl: go straight there; the onboarding question waits for the next visit. */
  private deferOnboarding(): void {
    if (this.returnUrl()) Onboarding.deferForThisVisit();
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
