import { ChangeDetectionStrategy, Component, afterNextRender } from '@angular/core';
import { AuthPreview } from './auth-preview';
import { APP_NAME } from '../../core/brand';
import { Logo } from '../../shared/logo';

/** Full-screen dark layout of /login and /signup: logo, the projected form, product preview. */
@Component({
  selector: 'app-auth-shell',
  imports: [AuthPreview, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'theme-dark' },
  template: `
    <a class="logo" href="/" [attr.aria-label]="appName + ' home'"><app-logo variant="white" [size]="26" /></a>
    <div class="form-side">
      <div class="form-wrap"><ng-content /></div>
      <!-- No site footer here, but German law wants these one click away from every page. -->
      <nav class="legal" aria-label="Legal">
        <a href="/imprint">Imprint</a><span aria-hidden="true">·</span><a href="/privacy">Privacy</a
        ><span aria-hidden="true">·</span><a href="/terms">Terms</a>
      </nav>
    </div>
    <div class="preview-side">
      <app-auth-preview />
    </div>
  `,
  styles: `
    :host {
      position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      min-height: 100vh; min-height: 100dvh; overflow: hidden; color-scheme: dark;
      background: radial-gradient(ellipse 55% 65% at 82% 48%, color-mix(in srgb, var(--primary-700) 33%, transparent), transparent 70%),
        radial-gradient(ellipse 30% 40% at 95% 20%, color-mix(in srgb, var(--primary-400) 15%, transparent), transparent 70%), var(--bg);
      color: var(--text);
    }
    .logo {
      position: absolute; top: 28px; left: 36px; z-index: 2; display: inline-flex;
      align-items: center; gap: 10px; color: var(--text); font-size: 1.05rem; font-weight: 650;
      text-decoration: none; letter-spacing: -.2px;
    }
    .logo:hover { color: var(--text); }
    .logo:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 4px; border-radius: 6px; }
    .form-side { display: grid; grid-template-rows: 1fr auto; justify-items: center; align-items: center; gap: 32px; padding: 104px 32px 28px; }
    .legal { display: flex; gap: 8px; color: var(--text-muted); font-size: 12px; }
    .legal a { color: var(--text-muted); text-decoration: none; }
    .legal a:hover { color: var(--text); text-decoration: underline; }
    .legal a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; border-radius: 4px; }
    .form-wrap { width: min(360px, 100%); }
    .preview-side { display: flex; align-items: center; padding: 64px 0 112px 48px; }
    @media (max-width: 960px) {
      :host { grid-template-columns: 1fr; }
      .preview-side { display: none; }
      .form-side { padding: 96px 20px 24px; }
      .logo { top: 24px; left: 20px; }
    }
  `,
})
export class AuthShell {
  readonly appName = APP_NAME;
  constructor() {
    // A guard redirect (e.g. a guest clicking a /check link) keeps the old scroll position.
    afterNextRender(() => scrollTo({ top: 0, behavior: 'instant' }));
  }
}
