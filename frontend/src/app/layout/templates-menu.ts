import { Component } from '@angular/core';
import {
  COVER_LETTER_EXAMPLES_HREF,
  CV_TEMPLATES,
  EXAMPLES_HREF,
  SAMPLE_CV,
  TEMPLATES_HREF,
} from '../core/cv-templates';
import { CvSheet } from '../shared/cv-sheet';
import { DisclosureMenu } from './disclosure-menu';
import { MenuItemConfig } from '../core/menu-config';
import { MenuItem } from './menu-item';
import { TemplateIcon } from '../shared/template-icon';

export const EXAMPLE_MENU_ITEMS: readonly MenuItemConfig[] = [
  {
    slug: 'cv-examples',
    title: 'CV Examples',
    description: 'Get inspired by strong CVs',
    href: EXAMPLES_HREF,
    public: true,
  },
  {
    slug: 'cover-letter-examples',
    title: 'Cover Letter Examples',
    description: 'Effective cover letter samples',
    href: COVER_LETTER_EXAMPLES_HREF,
    soon: true,
  },
];

/**
 * "Templates" mega menu: the four CV templates as small previews of the same sample CV, and
 * the example pages. Opens and closes like the Services menu (DisclosureMenu).
 */
@Component({
  selector: 'app-templates-menu',
  imports: [CvSheet, MenuItem, TemplateIcon],
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId"
      (click)="toggle()"
      (keydown)="triggerKey($event)"
    >
      Templates
      <svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
    </button>

    <div
      #panel
      class="panel"
      [id]="panelId"
      [class.open]="open()"
      [style.left.px]="variant() === 'dropdown' ? offset() : null"
      [style.width.px]="variant() === 'dropdown' ? width() : null"
      (keydown)="panelKey($event)"
      (click)="linkClicked($event)"
    >
      <div class="column">
        <div class="column-head">
          <p class="label" [id]="panelId + '-templates'">CV templates</p>
          <a class="view-all" [href]="templatesHref">View all <span aria-hidden="true">›</span></a>
        </div>
        <ul class="cards" role="list" [attr.aria-labelledby]="panelId + '-templates'">
          @for (template of templates; track template.id) {
            <li>
              <a class="card" [href]="templatesHref + '#' + template.id">
                @if (variant() === 'dropdown') {
                  <app-cv-sheet
                    class="thumb"
                    [text]="sample"
                    [template]="template.id"
                    crop="16 / 9"
                    [decorative]="true"
                  />
                }
                <span class="card-foot">
                  <app-template-icon [template]="template.id" />
                  <span class="card-text">
                    <span class="card-name">{{ template.name }}</span>
                    <span class="card-tagline">{{ template.tagline }}</span>
                  </span>
                </span>
              </a>
            </li>
          }
        </ul>
      </div>
      <div class="column">
        <div class="column-head">
          <p class="label" [id]="panelId + '-examples'">Examples</p>
        </div>
        <ul role="list" [attr.aria-labelledby]="panelId + '-examples'">
          @for (item of examples; track item.slug) {
            <li><a app-menu-item [item]="item"></a></li>
          }
        </ul>
      </div>
    </div>
  `,
  styleUrls: ['./disclosure-menu.scss', './templates-menu.scss'],
})
export class TemplatesMenu extends DisclosureMenu {
  protected readonly idPrefix = 'templates-menu';
  readonly templates = CV_TEMPLATES;
  readonly examples = EXAMPLE_MENU_ITEMS;
  readonly sample = SAMPLE_CV;
  readonly templatesHref = TEMPLATES_HREF;
}
