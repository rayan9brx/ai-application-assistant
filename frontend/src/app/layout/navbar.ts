import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { AdminRole } from '../core/admin-role';
import { Logo } from '../shared/logo';
import { APP_NAME } from '../core/brand';
import { AuthService } from '../core/auth.service';
import { Navigation } from '../core/navigation';
import { ServicesMenu } from './services-menu';
import { TemplatesMenu } from './templates-menu';

export interface NavLink {
  href: string;
  label: string;
}

@Component({
  selector: 'app-navbar',
  imports: [Logo, ServicesMenu, TemplatesMenu],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  host: {
    '(keydown.escape)': 'closeMenu(true); closeAccount(true)',
    '(document:click)': 'outsideClick($event)',
  },
})
export class Navbar {
  readonly links = input.required<readonly NavLink[]>();
  readonly menuOpen = signal(false);
  readonly accountOpen = signal(false);
  readonly auth = inject(AuthService);
  /** Shows the Admin link; the backend enforces the role itself. */
  readonly role = inject(AdminRole);
  readonly appName = APP_NAME;
  private readonly navigation = inject(Navigation);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly accountButton = viewChild<ElementRef<HTMLButtonElement>>('accountButton');
  private readonly accountMenu = viewChild<ElementRef<HTMLElement>>('accountMenu');

  /** Up to two initials from the name, or the first letter of the email. */
  readonly initials = computed(() => {
    const name = this.auth.displayName();
    const words = name.includes('@') ? [name] : name.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join('') || '?';
  });

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
    // Accordion triggers (Services, Templates) only expand their section.
    if ((event.target as Element).closest('a, button:not([aria-expanded])')) this.closeMenu();
  }

  toggleAccount(): void {
    this.accountOpen.update((open) => !open);
  }

  closeAccount(restoreFocus = false): void {
    if (!this.accountOpen()) return;
    this.accountOpen.set(false);
    if (restoreFocus) this.accountButton()?.nativeElement.focus();
  }

  outsideClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.accountButton()?.nativeElement.contains(target)) return;
    if (this.accountMenu()?.nativeElement.contains(target) && !(target as Element).closest?.('a, button'))
      return;
    this.closeAccount();
  }

  async logOut(): Promise<void> {
    this.closeAccount();
    this.closeMenu();
    await this.auth.signOut();
    await this.navigation.go('/');
  }
}
