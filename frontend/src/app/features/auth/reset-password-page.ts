import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { Navigation } from '../../core/navigation';
import { MIN_PASSWORD } from './signup-page';

/**
 * /reset-password: asks for the email and sends a reset link. The link brings the user back
 * here signed in for recovery (AuthService.recovering), and the page asks for a new password.
 */
@Component({
  selector: 'app-reset-password-page',
  template: `
    <section class="auth-card" aria-labelledby="reset-title">
      @if (auth.recovering()) {
        <h1 id="reset-title">Choose a new password</h1>
        <p class="lede">Set a new password for {{ auth.user()?.email }}.</p>
        <form (submit)="setPassword($event)" novalidate>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <div class="field">
            <label for="reset-new">New password</label>
            <input id="reset-new" type="password" autocomplete="new-password" required
              aria-describedby="reset-new-help" [value]="password()"
              (input)="password.set(value($event))" />
            <p class="help" id="reset-new-help">At least {{ minPassword }} characters.</p>
          </div>
          <button class="cta" type="submit" [disabled]="busy()">
            {{ busy() ? 'Saving…' : 'Save new password' }}
          </button>
        </form>
      } @else {
        <h1 id="reset-title">Reset your password</h1>
        <p class="lede">Enter your account’s email and we’ll send you a link to set a new password.</p>
        @if (sent()) {
          <p class="notice" role="status">
            If an account exists for {{ email() }}, a reset link is on its way. Check your inbox.
          </p>
        } @else {
          <form (submit)="sendLink($event)" novalidate>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <div class="field">
              <label for="reset-email">Email</label>
              <input id="reset-email" type="email" autocomplete="email" required [value]="email()"
                (input)="email.set(value($event))" />
            </div>
            <button class="cta" type="submit" [disabled]="busy()">
              {{ busy() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
        }
        <p class="alt"><a href="/login">Back to log in</a></p>
      }
    </section>
  `,
  styleUrl: './account-forms.scss',
})
export class ResetPasswordPage {
  readonly auth = inject(AuthService);
  private readonly navigation = inject(Navigation);
  readonly minPassword = MIN_PASSWORD;
  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly sent = signal(false);

  async sendLink(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    if (!/^\S+@\S+\.\S+$/.test(this.email().trim()))
      return this.error.set('Enter a valid email address.');
    await this.run(async () => {
      await this.auth.sendPasswordReset(this.email().trim());
      this.sent.set(true);
    }, 'We couldn’t send the link. Please try again.');
  }

  async setPassword(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    if (this.password().length < MIN_PASSWORD)
      return this.error.set(`Use a password of at least ${MIN_PASSWORD} characters.`);
    await this.run(async () => {
      await this.auth.updatePassword(this.password());
      await this.navigation.go('/dashboard');
    }, 'Saving your new password failed. Please try again.');
  }

  private async run(action: () => Promise<void>, fallback: string): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(AuthService.message(error, fallback));
    } finally {
      this.busy.set(false);
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
