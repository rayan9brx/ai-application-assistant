import { Component, computed, inject, input, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { safeNext } from './auth.guard';
import { Navigation } from './navigation';

/** /login */
@Component({
  selector: 'app-login-page',
  template: `
    <section class="auth-card" aria-labelledby="login-title">
      <h1 id="login-title">Log in</h1>
      <p class="lede">Welcome back. Your saved CVs and scores are waiting.</p>
      <form (submit)="submit($event)" novalidate>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="login-email">Email</label>
          <input id="login-email" name="email" type="email" autocomplete="email" required
            [value]="email()" (input)="email.set(value($event))" />
        </div>
        <div class="field">
          <div class="row">
            <label for="login-password">Password</label>
            <a href="/reset-password">Forgot password?</a>
          </div>
          <input id="login-password" name="password" type="password" autocomplete="current-password"
            required [value]="password()" (input)="password.set(value($event))" />
        </div>
        <button class="cta" type="submit" [disabled]="busy()">
          {{ busy() ? 'Logging in…' : 'Log in' }}
        </button>
      </form>
      <p class="alt">New to ApplyCraft? <a [href]="signupHref()">Create a free account</a></p>
    </section>
  `,
  styleUrl: './account-forms.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(Navigation);
  /** ?next= from the auth guard. */
  readonly next = input<string>();
  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly signupHref = computed(() =>
    this.next() ? `/signup?next=${encodeURIComponent(safeNext(this.next()))}` : '/signup',
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
      await this.auth.signIn(this.email().trim(), this.password());
      await this.navigation.go(safeNext(this.next()));
    } catch (error) {
      this.error.set(AuthService.message(error, 'Logging in failed. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
