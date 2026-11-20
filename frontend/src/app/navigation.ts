import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';

/**
 * Minimal path-based navigation on top of the History API, so the few app pages work
 * without pulling @angular/router back in. Swap for the router if routing grows.
 */
@Injectable({ providedIn: 'root' })
export class Navigation {
  private readonly injector = inject(Injector);
  readonly path = signal(location.pathname);

  constructor() {
    addEventListener('popstate', () => this.path.set(location.pathname));
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
    this.go(link.pathname + link.search + link.hash);
    return true;
  }

  go(url: string): void {
    const target = new URL(url, location.origin);
    if (target.href !== location.href) history.pushState(null, '', target.href);
    this.path.set(target.pathname);
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
}
