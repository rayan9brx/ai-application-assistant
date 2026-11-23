import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AdminRole } from './admin-role';

/**
 * Cookieless analytics: after each navigation, POSTs the path (no query string or #hash, which
 * can carry tokens) to our own backend. The external referrer is sent with the first page only.
 * No cookies, no storage, no third-party scripts. Admins are skipped here and on the server.
 */
@Injectable({ providedIn: 'root' })
export class PageViewTracker {
  private readonly http = inject(HttpClient);
  private readonly role = inject(AdminRole);
  private readonly router = inject(Router);
  private referrer: string | null = document.referrer || null;
  private last = '';

  start(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.send(event.urlAfterRedirects);
    });
  }

  private send(url: string): void {
    const path = new URL(url, location.origin).pathname;
    if (path === this.last || this.role.isAdmin()) return;
    this.last = path;
    const referrer = this.referrer;
    this.referrer = null;
    this.http.post('/api/track', { path, referrer }).subscribe({ error: () => undefined });
  }
}
