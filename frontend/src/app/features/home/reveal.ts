import { DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';
import { prefersReducedMotion, whenInView } from '../../core/in-view';

/**
 * Subtle fade-up the first time the element scrolls into view; `revealed` fires then (with
 * `animate` false for reduced motion), so mockups inside can start playing.
 */
@Directive({ selector: '[appReveal]' })
export class Reveal {
  readonly revealed = output<boolean>();

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canAnimate = !prefersReducedMotion() && typeof IntersectionObserver !== 'undefined';
      if (canAnimate) element.style.opacity = '0';
      whenInView(
        element,
        (animate) => {
          element.style.opacity = '';
          if (animate) {
            element.animate(
              [
                { opacity: 0, transform: 'translateY(16px)' },
                { opacity: 1, transform: 'none' },
              ],
              { duration: 600, easing: 'cubic-bezier(.2, .7, .2, 1)' },
            );
          }
          this.revealed.emit(animate);
        },
        destroyRef,
        0.1,
      );
    });
  }
}
