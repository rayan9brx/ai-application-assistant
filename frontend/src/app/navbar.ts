import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { ProductMenu } from './product-menu';

export interface NavLink {
  href: string;
  label: string;
}

@Component({
  selector: 'app-navbar',
  imports: [ProductMenu],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  host: { '(keydown.escape)': 'closeMenu(true)' },
})
export class Navbar {
  readonly links = input.required<readonly NavLink[]>();
  readonly menuOpen = signal(false);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

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
