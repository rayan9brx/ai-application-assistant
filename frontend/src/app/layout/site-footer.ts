import { Component, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { APP_NAME } from '../core/brand';
import { Logo } from '../shared/logo';
import { CHECK_HREF, TOOLS_HREF } from '../core/menu-config';

/**
 * Site footer, on every page except log-in and sign-up. German law requires the imprint and
 * privacy policy to be one click away from every page; the terms sit with them.
 */
@Component({
  selector: 'app-site-footer',
  imports: [Logo],
  template: `
    <footer class="site-footer">
      <div class="inner">
        <a class="brand" href="/" [attr.aria-label]="appName + ' home'"><app-logo [size]="22" /></a>
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
        <p class="note">© {{ year }} Rezumo</p>
      </div>
    </footer>
  `,
  styles: `
    .site-footer { border-top: 1px solid var(--border); background: var(--surface); }
    .inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4) var(--space-6); width: min(1184px, 100%); margin-inline: auto; padding: var(--space-6); }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--text); font-weight: 700; text-decoration: none; }
    ul { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); margin: 0; padding: 0; list-style: none; }
    nav a { display: inline-flex; min-height: 32px; align-items: center; color: var(--text-secondary); font-size: var(--text-sm); text-decoration: none; }
    nav a:hover { color: var(--text); text-decoration: underline; }
    .note { color: var(--text-secondary); font-size: var(--text-sm); }
    .legal { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); color: var(--text-secondary); font-size: var(--text-sm); }
    @media (max-width: 520px) { .inner { padding: var(--space-5) var(--space-4); } }
  `,
})
export class SiteFooter {
  readonly appName = APP_NAME;
  readonly auth = inject(AuthService);
  readonly checkHref = CHECK_HREF;
  readonly toolsHref = TOOLS_HREF;
  readonly year = new Date().getFullYear();
}
