import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ACCENTS, BuilderDesign, FONTS, SIZES, SPACINGS } from '../core/cv-builder';
import { NgTemplateOutlet } from '@angular/common';
import { parseClassic } from '../core/classic-cv';
import { CvTemplateId, DEFAULT_TEMPLATE, parseCv } from '../core/cv-templates';

/** An A4 page is 595 × 842 points; the sheet is laid out at 1 CSS px per PDF point, then scaled. */
const PAGE_WIDTH = 595;
/**
 * Below this scale, real-size fonts would fall under the browser's minimum font size, so small
 * Classic thumbnails are scaled with a transform like the other templates.
 */
const SHARP_MIN_SCALE = 0.6;
const PAGE_HEIGHT = 842;

/**
 * Classic's fit-to-page steps, tried in order until the CV fits one page; the same values as
 * ClassicCvRenderer.FITS: body size (pt, never below 10), line height, factor for every gap.
 */
const FITS = [
  { body: 11, lh: 1.15, gap: 1 },
  { body: 11, lh: 1.1, gap: 0.8 },
  { body: 10.5, lh: 1.08, gap: 0.65 },
  { body: 10, lh: 1.05, gap: 0.5 },
];
/** Contact items: the usual gap, and the smallest one before the line may wrap (pt). */
const CONTACT_GAP = 11;
const CONTACT_MIN_GAP = 4;

/**
 * Keeps Classic's contact items on one line: full links with the usual gap, else short links
 * (no "https://", "www."), else a smaller gap; only when even that is too wide does it wrap.
 */
function fitContact(page: HTMLElement, scale: number): void {
  const line = page.querySelector<HTMLElement>('.c-contact');
  if (!line) return;
  line.classList.remove('short', 'wrap');
  line.style.removeProperty('--cgap');
  const items = [...line.children] as HTMLElement[];
  const fits = () => line.scrollWidth <= line.clientWidth + 1;
  if (items.length < 2 || fits()) return;
  line.classList.add('short');
  if (fits()) return;
  // Visual sizes over the scale are PDF points, with or without the transform.
  const used = items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) / scale;
  const gap = (line.getBoundingClientRect().width / scale - used) / (items.length - 1);
  if (gap >= CONTACT_MIN_GAP) line.style.setProperty('--cgap', String(Math.floor(gap * 10) / 10));
  else line.classList.add('wrap');
}

/**
 * Applies the first fit step with which a Classic CV fits one page (the last step otherwise) and
 * returns its length in pages at that step (1 when it fits).
 */
function fitClassic(page: HTMLElement, scale: number): number {
  const usable = PAGE_HEIGHT - 2 * 34;
  let pages = 1;
  for (const fit of FITS) {
    page.style.setProperty('--fit-body', String(fit.body));
    page.style.setProperty('--fit-lh', String(fit.lh));
    page.style.setProperty('--fit-gap', String(fit.gap));
    fitContact(page, scale);
    const top = page.getBoundingClientRect().top;
    const last = page.lastElementChild?.getBoundingClientRect().bottom ?? top;
    pages = ((last - top) / scale - 34) / usable;
    if (pages <= 1.001) return 1;
  }
  return pages;
}

/** A paged preview draws the CV once per sheet: give every copy the measured page's fit. */
function copyFit(host: HTMLElement, page: HTMLElement): void {
  const line = page.querySelector<HTMLElement>('.c-contact');
  for (const copy of host.querySelectorAll<HTMLElement>('.page.classic')) {
    if (copy === page) continue;
    for (const name of ['--fit-body', '--fit-lh', '--fit-gap']) copy.style.setProperty(name, page.style.getPropertyValue(name));
    const other = copy.querySelector<HTMLElement>('.c-contact');
    if (!line || !other) continue;
    other.className = line.className;
    other.style.cssText = line.style.cssText;
  }
}

/** One A4 sheet of a paged preview, in PDF points of the laid-out CV. */
interface SheetPage {
  start: number;
  /** Where this sheet's content ends (the rest is covered); null on the last sheet. */
  mask: number | null;
}

/**
 * Splits the laid-out CV into A4 pages between lines, never through one: a page ends before the
 * first line that would cross its bottom margin, a heading moves along with the line after it, and
 * the next page starts with a top margin. `px` is the layout's px per point (scale for sharp pages).
 */
function paginate(page: HTMLElement, scale: number, px: number): SheetPage[] {
  const origin = page.getBoundingClientRect().top;
  const blocks = [...page.querySelectorAll<HTMLElement>('p, .gap, .c-gap, .c-rule')].map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      top: (rect.top - origin) / scale,
      bottom: (rect.bottom - origin) / scale,
      heading: el.matches('.heading, .c-heading'),
      gap: el.matches('.gap, .c-gap'),
    };
  });
  const style = getComputedStyle(page);
  const bottomMargin = parseFloat(style.paddingBottom) / px;
  const topMargin = bottomMargin || parseFloat(style.paddingTop) / px;
  const pages: SheetPage[] = [];
  let start = 0;
  let i = 0;
  while (pages.length < 50) {
    const limit = start + PAGE_HEIGHT - bottomMargin + 0.5;
    let k = i;
    while (k < blocks.length && blocks[k].bottom <= limit) k++;
    if (k >= blocks.length) break;
    if (k === i) k = i + 1; // A block taller than a page: cut it.
    else if (k - 1 > i && blocks[k - 1].heading) k--;
    if (k >= blocks.length) break;
    pages.push({ start, mask: blocks[k].top - start });
    i = k;
    while (i < blocks.length && blocks[i].gap) i++;
    if (i >= blocks.length) return pages;
    start = blocks[i].top - topMargin;
  }
  pages.push({ start, mask: null });
  return pages;
}

/**
 * A CV text drawn in one of the templates, like the PDF export draws it, scaled to the width
 * it is given. With `crop` (an aspect ratio such as "4 / 3") only the top of the page shows.
 */
@Component({
  selector: 'app-cv-sheet',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #rich let-runs>@for (run of runs; track $index) {@if (run.href) {<span class="c-link" [class.c-bold]="run.bold">{{ run.text }}</span>} @else if (run.bold) {<strong>{{ run.text }}</strong>} @else {<span>{{ run.text }}</span>}}</ng-template>

    @if (paged()) {
      <!-- One sheet per A4 page: each shows its slice of the same laid-out CV. -->
      @for (p of pages(); track $index) {
        <div class="sheet-page" [style.height.px]="pageHeight()">
          <div class="sheet-shift" [style.top.px]="-p.start * scale()"><ng-container *ngTemplateOutlet="sheet" /></div>
          @if (p.mask !== null) {
            <div class="sheet-mask" [style.top.px]="p.mask * scale()"></div>
          }
        </div>
      }
    } @else {
      <ng-container *ngTemplateOutlet="sheet" />
    }

    <ng-template #sheet>
    @if (template() === 'classic') {
      @let c = classic();
      <!-- Classic: fixed font and black text; the builder's accent and font options don't apply. -->
      <div #page class="page classic" data-template="classic" [class.sharp]="sharp()" [style.--fs]="designStyle().fs" [style.--sp]="designStyle().sp">
        @if (c.name) { <p class="c-name">{{ c.name }}</p> }
        @if (c.title) { <p class="c-title">{{ c.title }}</p> }
        @if (c.contact.length) {
          <p class="c-contact">
            @for (item of c.contact; track $index) {
              <span class="c-item">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  @switch (item.kind) {
                    @case ('location') { <path class="fill" fill-rule="evenodd" d="M8 15.5C5 11.6 3.4 8.9 3.4 6.6a4.6 4.6 0 0 1 9.2 0c0 2.3-1.6 5-4.6 8.9zM8 8.4a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" /> }
                    @case ('email') { <rect x="1.5" y="3.5" width="13" height="9.5" /><path d="M1.5 3.5 8 9l6.5-5.5" /> }
                    @case ('phone') { <rect x="4.5" y="1.5" width="7" height="13" rx="1.3" /><path d="M7 12.2h2" /> }
                    @case ('linkedin') { <rect class="fill" x="1" y="1" width="14" height="14" rx="2" /><path class="knockout" d="M4.6 7v5M4.6 4.4v.1M7.6 12V7M7.6 9.2c0-1.4 3.8-2.4 3.8.3V12" /> }
                    @case ('github') { <circle class="fill" cx="8" cy="8" r="7" /><path class="knockout" d="M6.6 5.4 4.4 8l2.2 2.6M9.4 5.4 11.6 8l-2.2 2.6" /> }
                    @default { <circle cx="8" cy="8" r="6.5" /><path d="M1.5 8h13M8 1.5c-3.6 3.6-3.6 9.4 0 13M8 1.5c3.6 3.6 3.6 9.4 0 13" /> }
                  }
                </svg>
                @if (item.short !== item.text) {
                  <span class="c-full" [class.c-link]="!!item.href">{{ item.text }}</span>
                  <span class="c-short" [class.c-link]="!!item.href">{{ item.short }}</span>
                } @else {
                  <span [class.c-link]="!!item.href">{{ item.text }}</span>
                }
              </span>
            }
          </p>
        }
        @if (c.name || c.title || c.contact.length) { <span class="c-rule" aria-hidden="true"></span> }
        @for (paragraph of c.summary; track $index) {
          <p class="c-summary"><ng-container *ngTemplateOutlet="rich; context: { $implicit: paragraph }" /></p>
        }
        @for (block of c.blocks; track $index) {
          @switch (block.kind) {
            @case ('heading') { <p class="c-heading">{{ block.text }}</p> }
            @case ('bullet') { <p class="c-bullet"><ng-container *ngTemplateOutlet="rich; context: { $implicit: block.runs }" /></p> }
            @case ('entry') {
              <p class="c-entry" [class.spaced]="block.spaced">
                <span class="c-entry-title"><ng-container *ngTemplateOutlet="rich; context: { $implicit: block.title }" /></span>
                <span class="c-dates">{{ block.dates }}</span>
              </p>
            }
            @case ('text') { <p><ng-container *ngTemplateOutlet="rich; context: { $implicit: block.runs }" /></p> }
            @default { <span class="c-gap"></span> }
          }
        }
      </div>
    } @else {
    @let cv = parsed();
    <div
      #page
      class="page"
      [attr.data-template]="template()"
      [class.no-dividers]="design()?.dividers === false"
      [class.indent]="!!design()?.indent"
      [class.custom-accent]="!!designStyle().accent"
      [style.--cv-accent]="designStyle().accent"
      [style.--cv-font]="designStyle().font"
      [style.--fs]="designStyle().fs"
      [style.--sp]="designStyle().sp"
    >
      @if (cv.name || cv.contact.length) {
        <div class="head">
          @if (cv.name) {
            <p class="name">{{ cv.name }}</p>
          }
          @for (line of cv.contact; track $index) {
            <p class="contact">{{ line }}</p>
          }
        </div>
      }
      <div class="body">
        @for (block of cv.blocks; track $index) {
          @switch (block.kind) {
            @case ('heading') {
              <p class="heading">{{ block.text }}</p>
            }
            @case ('bullet') {
              <p class="bullet">{{ block.text }}</p>
            }
            @case ('entry') {
              <p class="entry">
                <strong>{{ block.title }}</strong> <span class="dates">{{ block.dates }}</span>
              </p>
            }
            @case ('text') {
              <p>{{ block.text }}</p>
            }
            @default {
              <span class="gap"></span>
            }
          }
        }
      </div>
    </div>
    }
    </ng-template>
  `,
  styleUrl: './cv-sheet.scss',
  host: {
    // A CV page stays a white sheet, also inside dark layouts.
    class: 'theme-light',
    '[class.cropped]': '!!crop()',
    '[class.paged]': 'paged()',
    '[class.ready]': 'scale() > 0',
    '[style.aspect-ratio]': 'crop()',
    '[style.height.px]': 'crop() || paged() ? null : height()',
    '[style.--scale]': 'scale()',
    '[attr.aria-hidden]': 'decorative() || null',
  },
})
export class CvSheet {
  readonly text = input.required<string>();
  readonly template = input<CvTemplateId>(DEFAULT_TEMPLATE);
  /** Show only the top of the page at this aspect ratio, e.g. "4 / 3". */
  readonly crop = input<string>();
  /** Thumbnails next to a visible name are hidden from screen readers. */
  readonly decorative = input(false);

  /** The builder's design settings (accent, font, size, spacing…); omitted: the template as is. */
  readonly design = input<BuilderDesign | null>(null);
  /** Show every A4 page as its own sheet (the builder's preview); otherwise one long page. */
  readonly paged = input(false, { transform: booleanAttribute });
  /** Where each sheet starts in the laid-out CV, and where its content ends (null: last page). */
  readonly pages = signal<SheetPage[]>([{ start: 0, mask: null }]);
  readonly pageHeight = computed(() => PAGE_HEIGHT * this.scale());
  /** Classic only: the CV's length in pages after the fit-to-page steps (1 when it fits). */
  readonly pageCount = output<number>();
  private lastPages = 1;

  readonly parsed = computed(() => parseCv(this.text()));
  readonly classic = computed(() => parseClassic(this.text()));
  readonly designStyle = computed(() => {
    const design = this.design();
    if (!design) return { accent: null, font: null, fs: null, sp: null };
    return {
      accent: ACCENTS.find((a) => a.id === design.accent)?.token || null,
      font: FONTS.find((f) => f.id === design.font)?.stack,
      fs: SIZES[design.fontSize],
      sp: SPACINGS[design.spacing],
    };
  });
  readonly scale = signal(0);
  readonly height = signal<number | null>(null);
  /** Classic previews shown large enough are laid out at their final size (sharp text). */
  readonly sharp = computed(() => this.scale() >= SHARP_MIN_SCALE);
  /** Optional: the effect below runs before the first render, when there is no page yet. */
  private readonly page = viewChild<ElementRef<HTMLElement>>('page');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let observer: ResizeObserver | undefined;
    let observed: HTMLElement | undefined;
    const measure = () => {
      const page = this.page()?.nativeElement;
      if (!page) return;
      const scale = host.clientWidth / PAGE_WIDTH;
      this.scale.set(scale);
      // Classic is laid out at its final size (sharp text); the others are scaled with a transform.
      const classic = page.classList.contains('classic');
      const sharp = classic && scale >= SHARP_MIN_SCALE;
      if (classic && scale > 0) {
        const pages = Math.round(fitClassic(page, scale) * 100) / 100;
        copyFit(host, page);
        if (pages !== this.lastPages) this.pageCount.emit((this.lastPages = pages));
      } else if (!classic && this.lastPages !== 1) this.pageCount.emit((this.lastPages = 1));
      this.height.set(Math.ceil(sharp ? page.offsetHeight : page.offsetHeight * scale));
      if (this.paged() && scale > 0) {
        const pages = paginate(page, scale, sharp ? scale : 1);
        if (JSON.stringify(pages) !== JSON.stringify(this.pages())) this.pages.set(pages);
      }
    };
    // Classic has its own page element, so switching templates swaps the observed page.
    const watch = () => {
      const page = this.page()?.nativeElement;
      if (!observer || !page || page === observed) return;
      if (observed) observer.unobserve(observed);
      observer.observe(page);
      observed = page;
      measure();
    };
    afterNextRender(() => {
      observer = new ResizeObserver(measure);
      observer.observe(host);
      watch();
    });
    effect(() => {
      this.page();
      watch();
    });
    // A text change may not resize the page (min-height), but can change the fit and contact line.
    let frame = 0;
    effect(() => {
      this.text();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    });
  }
}
