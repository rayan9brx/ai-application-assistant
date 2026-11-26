import { Component } from '@angular/core';
import { CV_TEMPLATES, EXAMPLES_HREF, SAMPLE_CV, TEMPLATES_HREF } from '../../core/cv-templates';
import { CvSheet } from '../../shared/cv-sheet';
import { TemplateIcon } from '../../shared/template-icon';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

interface Category {
  slug: string;
  label: string;
  /** True when /examples already has an example CV for it. */
  ready?: boolean;
}

const CATEGORIES: readonly Category[] = [
  { slug: 'software-development', label: 'Software Development', ready: true },
  { slug: 'data-analytics', label: 'Data & Analytics', ready: true },
  { slug: 'working-student', label: 'Working Student (Werkstudent)', ready: true },
  { slug: 'it-support', label: 'IT Support' },
  { slug: 'design-ux', label: 'Design & UX' },
  { slug: 'marketing', label: 'Marketing' },
  { slug: 'sales', label: 'Sales' },
  { slug: 'finance', label: 'Finance' },
  { slug: 'hr', label: 'HR' },
  { slug: 'project-management', label: 'Project Management' },
  { slug: 'customer-service', label: 'Customer Service' },
  { slug: 'internship', label: 'Internship' },
];

/** The five template previews (Classic first) and the CV example categories. */
@Component({
  selector: 'app-templates-section',
  imports: [CvSheet, SectionHead, TemplateIcon],
  hostDirectives: [Reveal],
  template: `
    <section aria-labelledby="templates-title">
      <app-section-head pill="Templates" title="Professional templates that pass ATS" headingId="templates-title" />
      <ul class="templates" role="list">
        @for (t of templates; track t.id) {
          <li>
            <a class="template" [href]="templatesHref + '#' + t.id">
              <app-cv-sheet class="thumb" [text]="sample" [template]="t.id" crop="3 / 4" [decorative]="true" />
              <span class="foot">
                <app-template-icon [template]="t.id" />
                <span class="name">{{ t.name }}</span>
                @if (t.id === 'classic') { <span class="recommended">Recommended</span> }
              </span>
            </a>
          </li>
        }
      </ul>

      <div class="examples">
        <h3>CV examples by role</h3>
        <ul class="pills" role="list">
          @for (c of categories; track c.slug) {
            <li>
              @if (c.ready) {
                <a class="pill" [href]="examplesHref + '?category=' + c.slug">{{ c.label }}</a>
              } @else {
                <span class="pill soon-pill">{{ c.label }} <span class="soon">Soon</span></span>
              }
            </li>
          }
        </ul>
        <a class="browse" [href]="examplesHref">Browse all examples <span aria-hidden="true">→</span></a>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .templates { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
    .template { display: block; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); text-decoration: none; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .template:hover { border-color: var(--accent); color: var(--text); box-shadow: var(--shadow); transform: translateY(-2px); }
    .thumb { border-bottom: 1px solid var(--border); pointer-events: none; }
    .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px; }
    .name { font-weight: 650; }
    .recommended { padding: 2px 8px; border-radius: 999px; background: var(--success-bg); color: var(--success-text); font-size: .6875rem; font-weight: 700; }

    .examples { display: grid; justify-items: center; gap: 16px; margin-top: 48px; text-align: center; }
    h3 { font-size: var(--text-base); color: var(--text-secondary); }
    .pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 880px; margin: 0; padding: 0; list-style: none; }
    .pill { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font-size: var(--text-sm); font-weight: 600; text-decoration: none; }
    a.pill:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
    .soon-pill { color: var(--text-muted); }
    .soon { padding: 1px 6px; border-radius: 999px; background: var(--surface-raised); color: var(--text-secondary); font-size: .625rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .browse { color: var(--accent); font-weight: 600; text-decoration: none; }
    .browse:hover { text-decoration: underline; }

    @media (prefers-reduced-motion: reduce) { .template:hover { transform: none; } }
    /* Phones and tablets: one swipeable row instead of tiny cards. */
    @media (max-width: 1000px) {
      .templates { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(180px, 42%); overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }
      .templates li { scroll-snap-align: start; }
    }
    @media (max-width: 520px) { .templates { grid-auto-columns: 70%; } }
  `,
})
export class TemplatesSection {
  readonly templates = CV_TEMPLATES;
  readonly sample = SAMPLE_CV;
  readonly templatesHref = TEMPLATES_HREF;
  readonly examplesHref = EXAMPLES_HREF;
  readonly categories = CATEGORIES;
}
