import { Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Navigation } from './navigation';
import { ServicesMenu } from './services-menu';

export interface NavLink {
  href: string;
  label: string;
}

@Component({
  selector: 'app-navbar',
  imports: [ServicesMenu],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  host: { '(keydown.escape)': 'closeMenu(true)' },
})
export class Navbar {
  readonly links = input.required<readonly NavLink[]>();
  readonly menuOpen = signal(false);
  private readonly navigation = inject(Navigation);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  /** Only real pages count as active; in-page section links like /#features never do. */
  isActive(link: NavLink): boolean {
    return !link.href.includes('#') && this.navigation.path() === link.href;
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (restoreFocus) this.menuButton().nativeElement.focus();
  }

  mobileLinkClicked(event: MouseEvent): void {
    if ((event.target as Element).closest('a')) this.closeMenu();
  }
}
