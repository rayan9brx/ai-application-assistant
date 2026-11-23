import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CvTemplateId, DEFAULT_TEMPLATE, parseCv } from '../core/cv-templates';

/** An A4 page is 595 × 842 points; the sheet is laid out at 1 CSS px per PDF point, then scaled. */
const PAGE_WIDTH = 595;

/**
 * A CV text drawn in one of the templates, like the PDF export draws it, scaled to the width
 * it is given. With `crop` (an aspect ratio such as "4 / 3") only the top of the page shows.
 */
@Component({
  selector: 'app-cv-sheet',
  template: `
    @let cv = parsed();
    <div #page class="page" [attr.data-template]="template()">
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
  `,
  styleUrl: './cv-sheet.scss',
  host: {
    // A CV page stays a white sheet, also inside dark layouts.
    class: 'theme-light',
    '[class.cropped]': '!!crop()',
    '[class.ready]': 'scale() > 0',
    '[style.aspect-ratio]': 'crop()',
    '[style.height.px]': 'crop() ? null : height()',
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

  readonly parsed = computed(() => parseCv(this.text()));
  readonly scale = signal(0);
  readonly height = signal<number | null>(null);
  private readonly page = viewChild.required<ElementRef<HTMLElement>>('page');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let observer: ResizeObserver | undefined;
    afterNextRender(() => {
      const page = this.page().nativeElement;
      const measure = () => {
        const scale = host.clientWidth / PAGE_WIDTH;
        this.scale.set(scale);
        this.height.set(Math.ceil(page.offsetHeight * scale));
      };
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(host);
      observer.observe(page);
    });
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
  }
}
