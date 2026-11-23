import { Component, input } from '@angular/core';
import { CvTemplateId } from './cv-templates';

/** A small colored glyph for a CV template, shown next to its name. Decorative. */
@Component({
  selector: 'app-template-icon',
  template: `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      @switch (template()) {
        @case ('modern') {
          <path class="strong" d="M3.5 4h6" />
          <path d="M3.5 7.5h9M3.5 10h9M3.5 12.5h6" />
        }
        @case ('compact') {
          <path d="M3.5 3.5h9M3.5 5.75h9M3.5 8h9M3.5 10.25h9M3.5 12.5h6" />
        }
        @case ('creative') {
          <rect class="fill" x="2.5" y="2.5" width="11" height="4" rx="1" />
          <path d="M3.5 9.5h9M3.5 12h6" />
        }
        @default {
          <path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6" />
        }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; background: var(--surface-muted); color: var(--text-secondary); }
    :host([data-template='modern']) { background: var(--primary-50); color: var(--primary-600); }
    :host([data-template='compact']) { background: var(--success-bg); color: var(--success-text); }
    :host([data-template='creative']) { background: var(--warning-bg); color: var(--warning-text); }
    svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; }
    .strong { stroke-width: 2.2; }
    .fill { fill: currentColor; stroke: none; }
  `,
  host: { '[attr.data-template]': 'template()' },
})
export class TemplateIcon {
  readonly template = input.required<CvTemplateId>();
}
