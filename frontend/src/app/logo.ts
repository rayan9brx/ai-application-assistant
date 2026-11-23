import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { APP_NAME } from './brand';

/**
 * The Rezumo mark (public/brand/logo-mark.svg), drawn inline so it takes its colour from a
 * token: 'color' uses --primary-600 on light backgrounds, 'white' is for dark ones.
 * `size` is the mark's height in px; the name scales with it. Decorative: label the link around it.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.white]': "variant() === 'white'",
    '[style.--logo-size.px]': 'size()',
  },
  template: `
    <!-- Same shapes as logo-mark.svg; the viewBox is fitted to them (the file's cuts off the stroke tops). -->
    <svg class="mark" viewBox="70 113 380 307" aria-hidden="true" focusable="false">
      <circle cx="118" cy="372" r="46" />
      <path d="M186 152 L270 352 L364 248" />
      <path d="M322 152 L410 352" />
    </svg>
    @if (showName()) {
      <span class="name">{{ name }}</span>
    }
  `,
  styles: `
    :host {
      --logo-size: 28px;
      --logo-color: var(--primary-600);
      --logo-text: var(--text);
      display: inline-flex;
      align-items: center;
      gap: calc(var(--logo-size) * .36);
      color: var(--logo-text);
      line-height: 1;
    }
    :host(.white) { --logo-color: var(--white); --logo-text: var(--white); }
    .mark { display: block; flex: none; width: calc(var(--logo-size) * 380 / 307); height: var(--logo-size); }
    circle { fill: var(--logo-color); }
    path { fill: none; stroke: var(--logo-color); stroke-width: 74; stroke-linecap: round; stroke-linejoin: round; }
    .name { font-size: calc(var(--logo-size) * .68); font-weight: 700; letter-spacing: -.02em; white-space: nowrap; }
  `,
})
export class Logo {
  readonly variant = input<'color' | 'white'>('color');
  /** Height of the mark in px. */
  readonly size = input(28);
  readonly showName = input(true);
  readonly name = APP_NAME;
}
