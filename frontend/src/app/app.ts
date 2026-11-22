import { Component, HostListener, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CvLibrary } from './cv-library';
import { Navbar, NavLink } from './navbar';
import { Navigation } from './navigation';
import { PageViewTracker } from './page-view-tracker';
import { SiteFooter } from './site-footer';

const FULL_SCREEN_PATHS = ['/login', '/signup'];

@Component({
  selector: 'app-root',
  imports: [Navbar, RouterOutlet, SiteFooter],
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

  constructor() {
    // Listens for sign-in from the start, so a CV a guest asked to save is saved after sign-up.
    inject(CvLibrary);
    inject(PageViewTracker).start();
  }

  @HostListener('document:click', ['$event'])
  followInternalLink(event: MouseEvent): void {
    this.navigation.handleClick(event);
  }
}
