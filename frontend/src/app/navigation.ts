import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/**
 * Lets the app's plain <a href> links navigate through the Angular router without a page
 * reload, and scrolls like a fresh page load (to the top, or to the #anchor).
 */
@Injectable({ providedIn: 'root' })
export class Navigation {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  readonly path = signal(location.pathname);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd)
        this.path.set(new URL(event.urlAfterRedirects, location.origin).pathname);
    });
  }

  /** Handle a click on an internal link; returns false when the browser should handle it. */
  handleClick(event: MouseEvent): boolean {
    const link = (event.target as Element | null)?.closest?.('a');
    if (!link || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target || link.hasAttribute('download') || link.origin !== location.origin)
      return false;
    // In-page anchors on the current page keep the browser's native scrolling.
    if (link.pathname === location.pathname && link.hash) return false;
    event.preventDefault();
    void this.go(link.pathname + link.search + link.hash);
    return true;
  }

  async go(url: string): Promise<boolean> {
    const target = new URL(url, location.origin);
    const done = await this.router.navigateByUrl(target.pathname + target.search + target.hash);
    if (done) {
      afterNextRender(
        () => {
          const anchor = target.hash && document.getElementById(target.hash.slice(1));
          // Jump like a fresh page load; smooth scrolling is only for in-page anchors.
          if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
          else scrollTo({ top: 0, behavior: 'instant' });
        },
        { injector: this.injector },
      );
    }
    return done;
  }
}
