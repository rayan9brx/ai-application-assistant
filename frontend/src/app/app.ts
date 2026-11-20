import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CvLibrary } from './cv-library';
import { Navbar, NavLink } from './navbar';
import { Navigation } from './navigation';

@Component({
  selector: 'app-root',
  imports: [Navbar, RouterOutlet],
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

  constructor() {
    // Listens for sign-in from the start, so a CV a guest asked to save is saved after sign-up.
    inject(CvLibrary);
  }

  @HostListener('document:click', ['$event'])
  followInternalLink(event: MouseEvent): void {
    this.navigation.handleClick(event);
  }
}
