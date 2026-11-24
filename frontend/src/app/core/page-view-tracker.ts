import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminRole } from './admin-role';
import { AuthService } from './auth.service';

/** Set automatically once an admin logs in on this browser; kept after logout. */
const EXCLUDE_KEY = 'rezumo.excludeFromStats';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

export function browserExcluded(): boolean {
  try {
    return localStorage.getItem(EXCLUDE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Excludes this browser from stats for good, even after the admin logs out. */
export function excludeBrowser(): void {
  try {
    localStorage.setItem(EXCLUDE_KEY, '1');
  } catch {
    // Storage blocked: nothing to remember.
  }
}

/** Never track development builds or anything served from this machine. */
function trackingDisabled(): boolean {
  return !environment.production || LOCAL_HOSTS.includes(location.hostname) || location.hostname.endsWith('.localhost');
}

/**
 * Cookieless analytics: after each navigation, POSTs the path (no query string or #hash, which
 * can carry tokens) to our own backend. The external referrer is sent with the first page only.
 * No cookies or third-party scripts. Skipped for admins (here and on the server), for browsers
 * excluded from stats, and in development.
 */
@Injectable({ providedIn: 'root' })
export class PageViewTracker {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly role = inject(AdminRole);
  private readonly router = inject(Router);
  private referrer: string | null = document.referrer || null;
  private last = '';

  start(): void {
    if (trackingDisabled()) return;
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) void this.send(event.urlAfterRedirects);
    });
  }

  private async send(url: string): Promise<void> {
    const path = new URL(url, location.origin).pathname;
    if (path === this.last) return;
    this.last = path;
    const referrer = this.referrer;
    this.referrer = null;
    if (browserExcluded()) return;
    // Wait for the session and role, so an admin's first page load isn't sent before /api/me answers.
    await this.auth.whenReady();
    if (this.auth.signedIn() && (await this.role.check())) return;
    if (browserExcluded()) return;
    this.http.post('/api/track', { path, referrer }).subscribe({ error: () => undefined });
  }
}
