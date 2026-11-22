import { ChangeDetectionStrategy, Component, afterNextRender } from '@angular/core';
import { AuthPreview } from './auth-preview';

/** Full-screen dark layout of /login and /signup: logo, the projected form, product preview. */
@Component({
  selector: 'app-auth-shell',
  imports: [AuthPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="logo" href="/" aria-label="ApplyCraft home"
      ><span class="mark" aria-hidden="true">A</span>ApplyCraft</a
    >
    <div class="form-side">
      <div class="form-wrap"><ng-content /></div>
    </div>
    <div class="preview-side">
      <app-auth-preview />
    </div>
  `,
  styles: `
    :host {
      position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      min-height: 100vh; min-height: 100dvh; overflow: hidden; color-scheme: dark;
      background: radial-gradient(ellipse 55% 65% at 82% 48%, #4b3fb055, transparent 70%),
        radial-gradient(ellipse 30% 40% at 95% 20%, #7b5cff26, transparent 70%), #0f1629;
      color: #e7e9f3;
    }
    .logo {
      position: absolute; top: 28px; left: 36px; z-index: 2; display: inline-flex;
      align-items: center; gap: 10px; color: #fff; font-size: 1.05rem; font-weight: 650;
      text-decoration: none; letter-spacing: -.2px;
    }
    .logo:hover { color: #fff; }
    .logo:focus-visible { outline: 3px solid #b4adff; outline-offset: 4px; border-radius: 6px; }
    .mark {
      display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px;
      background: #fff; color: #0f1629; font-weight: 750;
    }
    .form-side { display: grid; place-items: center; padding: 104px 32px 56px; }
    .form-wrap { width: min(360px, 100%); }
    .preview-side { display: flex; align-items: center; padding: 64px 0 112px 48px; }
    @media (max-width: 960px) {
      :host { grid-template-columns: 1fr; }
      .preview-side { display: none; }
      .form-side { padding: 96px 20px 48px; }
      .logo { top: 24px; left: 20px; }
    }
  `,
})
export class AuthShell {
  constructor() {
    // A guard redirect (e.g. a guest clicking a /check link) keeps the old scroll position.
    afterNextRender(() => scrollTo({ top: 0, behavior: 'instant' }));
  }
}
