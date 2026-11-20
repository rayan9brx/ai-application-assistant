import { Component, HostListener, computed, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ComingSoon } from './coming-soon';
import { Hero } from './hero';
import { TOOLS_HREF, itemBySlug } from './menu-config';
import { Navbar, NavLink } from './navbar';
import { Navigation } from './navigation';
import { PricingPage } from './pricing-page';
import { ProblemSection } from './problem-section';
import { Showcase } from './showcase';
import { ToolsPage } from './tools-page';
import { UploadBar } from './upload-bar';

const SITE_TITLE = 'ApplyCraft — Your application workspace';

@Component({
  selector: 'app-root',
  imports: [ComingSoon, Hero, Navbar, PricingPage, ProblemSection, Showcase, ToolsPage, UploadBar],
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

  /** Anything under /tools/ that is not a known tool still gets the generic placeholder. */
  readonly page = computed(() => {
    const path = this.navigation.path().replace(/\/+$/, '') || '/';
    if (path === '/pricing') return { kind: 'pricing' as const };
    if (path === TOOLS_HREF) return { kind: 'tools' as const };
    if (path.startsWith(`${TOOLS_HREF}/`)) {
      return { kind: 'coming-soon' as const, item: itemBySlug(path.slice(TOOLS_HREF.length + 1)) };
    }
    return { kind: 'home' as const };
  });

  constructor() {
    const title = inject(Title);
    effect(() => {
      const page = this.page();
      title.setTitle(
        page.kind === 'pricing'
          ? 'Pricing — ApplyCraft'
          : page.kind === 'tools'
            ? `All tools — ApplyCraft`
            : page.kind === 'coming-soon'
              ? `${page.item?.title ?? 'Coming soon'} — ApplyCraft`
              : SITE_TITLE,
      );
    });
  }

  @HostListener('document:click', ['$event'])
  followInternalLink(event: MouseEvent): void {
    this.navigation.handleClick(event);
  }
}
