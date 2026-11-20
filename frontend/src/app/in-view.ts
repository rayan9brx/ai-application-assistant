import { DestroyRef } from '@angular/core';

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Calls onEnter once, the first time the element scrolls into view. `animate` is false when
 * the user prefers reduced motion or the browser can't observe visibility; callers should
 * then jump straight to their final state.
 */
export function whenInView(
  element: Element,
  onEnter: (animate: boolean) => void,
  destroyRef: DestroyRef,
  threshold = 0.25,
): void {
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    onEnter(false);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      onEnter(true);
    },
    { threshold },
  );
  observer.observe(element);
  destroyRef.onDestroy(() => observer.disconnect());
}
