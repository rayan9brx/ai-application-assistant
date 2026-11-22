import { Component, computed, inject, input, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { safeNext } from './auth.guard';
import { AuthShell } from './auth-shell';
import { GoogleButton } from './google-button';
import { Navigation } from './navigation';

export const MIN_PASSWORD = 8;

/** /signup. ?returnUrl= is where the user goes after signing up (or confirming their email). */
@Component({
  selector: 'app-signup-page',
  imports: [AuthShell, GoogleButton],
  template: `
    <app-auth-shell>
      <section aria-labelledby="signup-title">
        <h1 id="signup-title">Create your ApplyCraft account</h1>
        <p class="subtitle">Free forever. No credit card required.</p>
        @if (returnUrl()) {
          <p class="return-note" role="status">Create a free account to score your CV</p>
        }

        @if (confirmSent()) {
          <p class="notice" role="status">
            Check your inbox: we sent a confirmation link to {{ email() }}. Open it on this device to
            finish signing up.
          </p>
        } @else {
          <app-google-button class="social" [busy]="googleBusy()" (pressed)="google()" />
          <p class="divider" role="separator">OR</p>

          <form (submit)="submit($event)" novalidate>
            <div class="field">
              <label for="signup-email">Your email</label>
              <input id="signup-email" name="email" type="email" autocomplete="email" required
                placeholder="you@example.com" [attr.aria-invalid]="!!error() || null"
                [attr.aria-describedby]="error() ? 'signup-error' : null"
                [value]="email()" (input)="email.set(value($event))" />
            </div>
            <div class="field">
              <label for="signup-password">Your password</label>
              <div class="password">
                <input id="signup-password" name="password" autocomplete="new-password" required
                  [type]="showPassword() ? 'text' : 'password'" aria-describedby="signup-password-help"
                  [attr.aria-invalid]="!!error() || null"
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
              <p class="hint" id="signup-password-help">At least {{ minPassword }} characters</p>
            </div>
            <button class="primary" type="submit" [disabled]="busy()">
              @if (busy()) { <span class="spinner" aria-hidden="true"></span> Creating account… }
              @else { Create free account }
            </button>
            @if (error()) {
              <p class="error" id="signup-error" role="alert">{{ error() }}</p>
            }
          </form>
          <p class="legal">
            By signing up you agree to our <a href="/terms">Terms</a> and
            <a href="/privacy">Privacy Policy</a>
          </p>
        }

        <p class="alt">Already have an account? <a class="link" [href]="loginHref()">Log in</a></p>
      </section>
    </app-auth-shell>
  `,
  styleUrl: './auth-form.scss',
})
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(Navigation);
  readonly returnUrl = input<string>();
  readonly minPassword = MIN_PASSWORD;
  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly busy = signal(false);
  readonly googleBusy = signal(false);
  readonly error = signal('');
  readonly confirmSent = signal(false);
  readonly loginHref = computed(() =>
    this.returnUrl() ? `/login?returnUrl=${encodeURIComponent(safeNext(this.returnUrl()))}` : '/login',
  );

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const email = this.email().trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return this.error.set('Enter a valid email address.');
    if (this.password().length < MIN_PASSWORD)
      return this.error.set(`Use a password of at least ${MIN_PASSWORD} characters.`);
    this.busy.set(true);
    this.error.set('');
    try {
      const destination = safeNext(this.returnUrl());
      // The form no longer asks for a name; it can be added later in Settings.
      const signedIn = await this.auth.signUp(email, this.password(), '', destination);
      if (signedIn) await this.navigation.go(destination);
      else this.confirmSent.set(true);
    } catch (error) {
      this.error.set(AuthService.message(error, 'Signing up failed. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Google sign-up; it returns to the returnUrl after the redirect. */
  async google(): Promise<void> {
    if (this.googleBusy()) return;
    this.googleBusy.set(true);
    this.error.set('');
    try {
      await this.auth.signInWithGoogle(safeNext(this.returnUrl()));
    } catch (error) {
      this.error.set(AuthService.message(error, 'Signing up with Google failed. Please try again.'));
      this.googleBusy.set(false);
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
