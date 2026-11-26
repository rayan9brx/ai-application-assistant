import { Component, HostListener, computed, inject } from '@angular/core';
import { AppShell } from './layout/app-shell';
import { AuthService } from './core/auth.service';
import { RouterOutlet } from '@angular/router';
import { CvLibrary } from './core/cv-library';
import { Navbar, NavLink } from './layout/navbar';
import { Navigation } from './core/navigation';
import { Onboarding } from './features/onboarding/onboarding';
import { OnboardingDialog } from './features/onboarding/onboarding-dialog';
import { PageViewTracker } from './core/page-view-tracker';
import { SiteFooter } from './layout/site-footer';

const FULL_SCREEN_PATHS = ['/login', '/signup'];
/** Pages of the logged-in app, shown in AppShell (sidebar + top bar). */
const APP_PATHS = ['/dashboard', '/tailor', '/documents', '/check', '/settings', '/admin', '/cover-letters'];

@Component({
  selector: 'app-root',
  imports: [AppShell, Navbar, OnboardingDialog, RouterOutlet, SiteFooter],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly navigation = inject(Navigation);
  readonly navLinks: NavLink[] = [
    { href: '/#features', label: 'Features' },
    { href: '/#problem', label: 'Why ATS matters' },
    { href: '/pricing', label: 'Pricing' },
  ];
  /** Log-in and sign-up are full-screen pages without the site's navbar and footer. */
  readonly fullScreen = computed(() => FULL_SCREEN_PATHS.includes(this.navigation.path()));
  /** App pages, plus the tool pages (/tools/<slug>) for signed-in users. */
  readonly appLayout = computed(() => {
    const path = this.navigation.path();
    if (APP_PATHS.includes(path)) return this.auth.signedIn();
    return path.startsWith('/tools/') && this.auth.signedIn();
  });
  /** The CV builder is full-screen: no app sidebar or top bar, only its own bar. */
  readonly builder = computed(() => this.navigation.path().startsWith('/builder/') && this.auth.signedIn());
  private readonly auth = inject(AuthService);

  constructor() {
    // Listens for sign-in from the start, so a CV a guest asked to save is saved after sign-up.
    inject(CvLibrary);
    // Checks from the start whether the one-time onboarding question is due.
    inject(Onboarding);
    inject(PageViewTracker).start();
  }

  @HostListener('document:click', ['$event'])
  followInternalLink(event: MouseEvent): void {
    this.navigation.handleClick(event);
  }
}
