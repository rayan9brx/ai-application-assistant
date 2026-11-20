import { Component, computed, inject, input, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { safeNext } from './auth.guard';
import { Navigation } from './navigation';

export const MIN_PASSWORD = 8;

/** /signup. With ?save=1 the guest came from the checker's Save button. */
@Component({
  selector: 'app-signup-page',
  template: `
    <section class="auth-card" aria-labelledby="signup-title">
      <h1 id="signup-title">Create your free account</h1>
      <p class="lede">
        {{ save() ? 'Sign up to save this CV and its score. We’ll save it as soon as you’re in.'
                  : 'Save your CVs, track your scores and pick up where you left off.' }}
      </p>
      @if (confirmSent()) {
        <p class="notice" role="status">
          Check your inbox: we sent a confirmation link to {{ email() }}. Open it on this device to
          finish signing up{{ save() ? ' and save your CV' : '' }}.
        </p>
      } @else {
        <form (submit)="submit($event)" novalidate>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <div class="field">
            <label for="signup-name">Full name</label>
            <input id="signup-name" name="name" autocomplete="name" maxlength="200"
              [value]="name()" (input)="name.set(value($event))" />
          </div>
          <div class="field">
            <label for="signup-email">Email</label>
            <input id="signup-email" name="email" type="email" autocomplete="email" required
              [value]="email()" (input)="email.set(value($event))" />
          </div>
          <div class="field">
            <label for="signup-password">Password</label>
            <input id="signup-password" name="password" type="password" autocomplete="new-password"
              required aria-describedby="signup-password-help"
              [value]="password()" (input)="password.set(value($event))" />
            <p class="help" id="signup-password-help">At least {{ minPassword }} characters.</p>
          </div>
          <button class="cta" type="submit" [disabled]="busy()">
            {{ busy() ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
      }
      <p class="alt">Already have an account? <a [href]="loginHref()">Log in</a></p>
    </section>
  `,
  styleUrl: './account-forms.scss',
})
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(Navigation);
  readonly next = input<string>();
  readonly save = input<string>();
  readonly minPassword = MIN_PASSWORD;
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly confirmSent = signal(false);
  readonly loginHref = computed(() =>
    this.next() ? `/login?next=${encodeURIComponent(safeNext(this.next()))}` : '/login',
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
      const destination = safeNext(this.next());
      const signedIn = await this.auth.signUp(email, this.password(), this.name(), destination);
      if (signedIn) await this.navigation.go(destination);
      else this.confirmSent.set(true);
    } catch (error) {
      this.error.set(AuthService.message(error, 'Signing up failed. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
