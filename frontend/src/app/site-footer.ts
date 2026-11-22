import { Component, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { CHECK_HREF, TOOLS_HREF } from './menu-config';

/**
 * Site footer, on every page except log-in and sign-up. German law requires the imprint and
 * privacy policy to be one click away from every page; the terms sit with them.
 */
@Component({
  selector: 'app-site-footer',
  template: `
    <footer class="site-footer">
      <div class="inner">
        <a class="brand" href="/" aria-label="ApplyCraft home"
          ><span class="brand-mark" aria-hidden="true">A</span>ApplyCraft</a
        >
        <nav aria-label="Footer">
          <ul role="list">
            <li><a [href]="checkHref">CV Checker</a></li>
            <li><a [href]="toolsHref">All tools</a></li>
            <li><a href="/pricing">Pricing</a></li>
            @if (auth.signedIn()) {
              <li><a href="/dashboard">Dashboard</a></li>
            } @else {
              <li><a href="/login">Log in</a></li>
            }
          </ul>
        </nav>
        <nav class="legal" aria-label="Legal">
          <a href="/imprint">Imprint</a><span aria-hidden="true">·</span><a href="/privacy">Privacy</a
          ><span aria-hidden="true">·</span><a href="/terms">Terms</a>
        </nav>
        <p class="note">© {{ year }} ApplyCraft</p>
      </div>
    </footer>
  `,
  styles: `
    .site-footer { border-top: 1px solid var(--line); background: var(--surface); }
    .inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4) var(--space-6); width: min(1184px, 100%); margin-inline: auto; padding: var(--space-6); }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); font-weight: 700; text-decoration: none; }
    .brand-mark { display: grid; place-items: center; width: 24px; height: 24px; border-radius: var(--radius-sm); background: var(--accent); color: #fff; font-size: 14px; }
    ul { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); margin: 0; padding: 0; list-style: none; }
    nav a { display: inline-flex; min-height: 32px; align-items: center; color: var(--muted); font-size: var(--text-sm); text-decoration: none; }
    nav a:hover { color: var(--ink); text-decoration: underline; }
    .note { color: var(--muted); font-size: var(--text-sm); }
    .legal { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); color: var(--muted); font-size: var(--text-sm); }
    @media (max-width: 520px) { .inner { padding: var(--space-5) var(--space-4); } }
  `,
})
export class SiteFooter {
  readonly auth = inject(AuthService);
  readonly checkHref = CHECK_HREF;
  readonly toolsHref = TOOLS_HREF;
  readonly year = new Date().getFullYear();
}
