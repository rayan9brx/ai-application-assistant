import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AdminRole } from '../core/admin-role';
import { APP_NAV, AppNavItem, isActive } from './app-shell-config';
import { AuthService } from '../core/auth.service';
import { APP_NAME } from '../core/brand';
import { Logo } from '../shared/logo';
import { CvFlow } from '../core/cv-flow';
import { Navigation } from '../core/navigation';
import { UsageStore } from '../core/usage-store';

const MOBILE = '(max-width: 960px)';

/**
 * Layout of the logged-in app: a fixed sidebar (a slide-in drawer on small screens) and a top
 * bar with document tabs, notifications and the account menu. The page goes in <ng-content>.
 */
@Component({
  selector: 'app-shell',
  imports: [Logo],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  readonly auth = inject(AuthService);
  readonly role = inject(AdminRole);
  readonly usage = inject(UsageStore);
  private readonly navigation = inject(Navigation);
  private readonly flow = inject(CvFlow);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly bellButton = viewChild<ElementRef<HTMLButtonElement>>('bellButton');
  private readonly avatarButton = viewChild<ElementRef<HTMLButtonElement>>('avatarButton');

  readonly nav = APP_NAV;
  readonly appName = APP_NAME;
  readonly path = this.navigation.path;
  readonly drawerOpen = signal(false);
  readonly openMenu = signal<'bell' | 'account' | null>(null);
  readonly mobile = signal(matchMedia(MOBILE).matches);
  /** On small screens the closed drawer is off-screen, so keep it out of the tab order. */
  readonly drawerHidden = computed(() => this.mobile() && !this.drawerOpen());
  readonly initial = computed(() => (this.auth.displayName().trim()[0] ?? '?').toUpperCase());

  constructor() {
    const query = matchMedia(MOBILE);
    const change = (event: MediaQueryListEvent) => {
      this.mobile.set(event.matches);
      if (!event.matches) this.drawerOpen.set(false);
    };
    query.addEventListener('change', change);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', change));

    // Page changes close the drawer and menus and refresh the usage numbers.
    effect(() => {
      this.path();
      this.navigation.search();
      this.drawerOpen.set(false);
      this.openMenu.set(null);
      void this.usage.refresh();
    });
    // Scoring, fixing and tailoring use AI: refresh once each finishes.
    effect(() => {
      const phase = this.flow.phase();
      const busy = this.flow.busy();
      if (phase === 'results' && !busy) void this.usage.refresh();
    });
    // No page scroll behind the open drawer.
    effect((onCleanup) => {
      if (!this.drawerOpen()) return;
      document.body.style.overflow = 'hidden';
      onCleanup(() => (document.body.style.overflow = ''));
    });
  }

  active(item: AppNavItem): boolean {
    return isActive(item, this.path(), this.navigation.search());
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.sidebar .new-cv')?.focus());
  }

  closeDrawer(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    this.menuButton()?.nativeElement.focus();
  }

  toggle(menu: 'bell' | 'account'): void {
    this.openMenu.update((open) => (open === menu ? null : menu));
  }

  async logOut(): Promise<void> {
    this.openMenu.set(null);
    await this.auth.signOut();
    this.usage.reset();
    await this.navigation.go('/');
  }

  @HostListener('document:keydown.escape')
  escape(): void {
    const menu = this.openMenu();
    if (menu) {
      this.openMenu.set(null);
      (menu === 'bell' ? this.bellButton() : this.avatarButton())?.nativeElement.focus();
    } else {
      this.closeDrawer();
    }
  }

  @HostListener('document:click', ['$event'])
  outsideClick(event: MouseEvent): void {
    if (!this.openMenu()) return;
    const target = event.target as Element;
    const wrap = target.closest?.('.menu-wrap');
    // Clicks inside the open menu keep it open, except on its links and buttons.
    if (wrap && (!target.closest('.menu') || !target.closest('a, button'))) return;
    this.openMenu.set(null);
  }
}
