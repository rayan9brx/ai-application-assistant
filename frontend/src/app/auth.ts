import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface CurrentUser { email: string; }

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  readonly user = signal<CurrentUser | null>(null);
  readonly mode = signal<'login' | 'register'>('login');
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly ready = signal(false);
  email = '';
  password = '';

  // Bootstrap a CSRF cookie and restore only the current server-side identity.
  async initialize(): Promise<void> {
    try {
      await this.refreshCsrf();
      await this.loadUser();
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        this.error.set('Account service unavailable. Check the backend connection and try again.');
      }
    } finally {
      this.ready.set(true);
    }
  }

  // Obtain a fresh cookie after authentication changes or expired security state.
  private async refreshCsrf(): Promise<void> {
    await firstValueFrom(this.http.get('/api/auth/csrf'));
  }

  // Ask the server who owns the session instead of trusting browser storage.
  private async loadUser(): Promise<void> {
    this.user.set(await firstValueFrom(this.http.get<CurrentUser>('/api/auth/me')));
  }

  // Open the inline account screen without navigating away from application text.
  show(mode: 'login' | 'register' = 'login'): void {
    if (this.busy()) return;
    this.mode.set(mode);
    this.password = '';
    this.error.set('');
    this.message.set('');
    this.open.set(true);
    afterNextRender(() => document.getElementById('account-email')?.focus(), { injector: this.injector });
  }

  // Turn session expiry into an inline sign-in prompt while preserving all drafts.
  requireLogin(): void {
    this.user.set(null);
    this.show();
    this.message.set('Sign in to continue. Your application text and previews are still on this page. Retry your action after signing in.');
  }

  // Validate before submitting while leaving passwords unchanged for hashing.
  validationMessage(): string {
    if (!this.email.trim() || this.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) return 'Enter a valid email address.';
    if (!this.password || this.password.length > 128) return 'Enter your password (up to 128 characters).';
    if (this.mode() === 'register' && (this.password.length < 12 || !this.password.trim())) return 'Use a password of 12–128 characters.';
    return '';
  }

  // Register or sign in using CSRF-protected same-origin requests and server cookies.
  async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set(this.validationMessage());
    if (this.error()) return;
    this.busy.set(true);
    this.message.set('');
    try {
      await this.refreshCsrf();
      const email = this.email.trim().toLowerCase();
      if (this.mode() === 'register') {
        await firstValueFrom(this.http.post('/api/auth/register', { email, password: this.password }));
        this.mode.set('login');
        this.message.set('Account created. Sign in to continue.');
      } else {
        const body = new HttpParams().set('email', email).set('password', this.password);
        await firstValueFrom(this.http.post('/api/auth/login', body));
        await this.refreshCsrf();
        await this.loadUser();
        this.open.set(false);
        this.message.set('Signed in. You can continue with your application.');
      }
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.error.set(status === 401 ? 'Invalid email or password.'
        : status === 409 ? 'Unable to register with these details. Try signing in or use another email.'
        : status === 403 ? 'Security check failed. Please try again to refresh your session.'
        : status === 400 ? 'Check your email and password requirements.'
        : 'Account request failed. Check the backend connection and try again.');
    } finally {
      this.password = '';
      this.busy.set(false);
    }
  }

  // Invalidate the server session before clearing the displayed identity.
  async logout(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.refreshCsrf();
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
      this.user.set(null);
      this.password = '';
      this.message.set('Signed out. Your application text remains on this page; refresh to clear it on a shared device.');
      await this.refreshCsrf();
    } catch {
      this.error.set('Could not finish signing out. Check the connection and retry.');
    } finally {
      this.busy.set(false);
    }
  }
}
