import { Injectable, computed, signal } from '@angular/core';
import { AuthChangeEvent, Session, SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { CHECK_HREF } from './menu-config';

/** /signup with a returnUrl to come back to after sign-up (and email confirmation) or log-in. */
export function signupUrl(returnUrl?: string | null): string {
  return returnUrl ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}` : '/signup';
}

/**
 * Supabase Auth in the browser, with the PUBLISHABLE key only. It handles sign-up, log-in,
 * log-out and password reset; the backend verifies the resulting access token (JWT) itself.
 * The database is never queried from here: all data goes through the Spring Boot API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  );

  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly signedIn = computed(() => !!this.session());
  /** Where the "Try it free" / "Score my CV" buttons lead: the CV Checker, behind sign-up for guests. */
  readonly startHref = computed(() => this.gate(CHECK_HREF));
  /** True after opening a password-reset link, until the new password is set. */
  readonly recovering = signal(false);
  readonly displayName = computed(() => {
    const user = this.user();
    const name = user?.user_metadata?.['full_name'];
    return typeof name === 'string' && name.trim() ? name.trim() : (user?.email ?? '');
  });

  private readonly ready: Promise<void>;
  private readonly listeners: ((event: AuthChangeEvent, session: Session | null) => void)[] = [];

  constructor() {
    this.client.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      if (event === 'PASSWORD_RECOVERY') this.recovering.set(true);
      if (event === 'SIGNED_OUT') this.recovering.set(false);
      // Run app reactions outside Supabase's auth lock, as its docs recommend.
      setTimeout(() => this.listeners.forEach((listener) => listener(event, session)));
    });
    this.ready = this.client.auth.getSession().then(
      ({ data }) => this.session.set(data.session),
      () => this.session.set(null),
    );
  }

  /**
   * The app itself is for signed-in users only: guests get /signup, with `path` as the returnUrl.
   * Read inside a template or computed() so the link updates when the user signs in or out.
   */
  gate(path: string): string {
    return this.signedIn() ? path : signupUrl(path);
  }

  /** Resolves once a stored session (if any) has been restored. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  onChange(listener: (event: AuthChangeEvent, session: Session | null) => void): void {
    this.listeners.push(listener);
  }

  /** A current access token, refreshed by supabase-js when it is about to expire. */
  async accessToken(): Promise<string | null> {
    await this.ready;
    const { data } = await this.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  /** Returns true when the user is signed in right away (email confirmation turned off). */
  /** `returnUrl` is also where the email confirmation link leads, so it survives confirmation. */
  async signUp(email: string, password: string, fullName: string, returnUrl: string): Promise<boolean> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: location.origin + returnUrl,
      },
    });
    if (error) throw error;
    return !!data.session;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  /**
   * Redirects to Google and back to `returnUrl`; the session is picked up from the URL on return.
   * TODO(supabase): enable the Google provider (client ID + secret) in the Supabase dashboard under
   * Authentication → Providers, and add this site's origin to the allowed redirect URLs.
   */
  async signInWithGoogle(returnUrl: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + returnUrl },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    // A session that is already invalid on the server still ends locally.
    if (error) await this.client.auth.signOut({ scope: 'local' });
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + '/reset-password',
    });
    if (error) throw error;
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
    this.recovering.set(false);
  }

  async updateName(fullName: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ data: { full_name: fullName.trim() } });
    if (error) throw error;
  }

  /** A readable message for a Supabase Auth error. */
  static message(error: unknown, fallback: string): string {
    const message = (error as { message?: unknown })?.message;
    if (typeof message !== 'string' || !message) return fallback;
    if (/fetch|network/i.test(message)) return 'We can’t reach the sign-in service. Try again.';
    return message;
  }
}
