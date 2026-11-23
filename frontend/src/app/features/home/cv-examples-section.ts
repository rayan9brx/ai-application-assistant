import { Component, signal } from '@angular/core';
import { EXAMPLES_HREF } from '../../core/cv-templates';

interface Category {
  slug: string;
  label: string;
  /** SVG path data (24×24, stroked). */
  icon: string;
  /** True when /examples already has an example CV for it. */
  ready?: boolean;
}

const CATEGORIES: readonly Category[] = [
  { slug: 'software-development', label: 'Software Development', icon: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16', ready: true },
  { slug: 'data-analytics', label: 'Data & Analytics', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2', ready: true },
  { slug: 'it-support', label: 'IT Support', icon: 'M3 4h18v12H3zM8 20h8M12 16v4' },
  { slug: 'design-ux', label: 'Design & UX', icon: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.5 1-2 2.5-2H18a3 3 0 0 0 3-3c0-5-4-8.5-9-8.5zM7.5 11h.01M10 7.5h.01M15 7.5h.01' },
  { slug: 'marketing', label: 'Marketing', icon: 'M3 11v2l13 5V6L3 11zM16 9a3 3 0 0 1 0 6M7 14l1 5h3l-1-4' },
  { slug: 'sales', label: 'Sales', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { slug: 'finance', label: 'Finance', icon: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6' },
  { slug: 'hr', label: 'HR', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a5 5 0 0 0-4-5' },
  { slug: 'project-management', label: 'Project Management', icon: 'M9 5h11M9 12h11M9 19h11M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2' },
  { slug: 'customer-service', label: 'Customer Service', icon: 'M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v5H4zM17 13h3v5h-3zM20 18a4 4 0 0 1-4 3h-3' },
  { slug: 'working-student', label: 'Working Student (Werkstudent)', icon: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6', ready: true },
  { slug: 'internship', label: 'Internship', icon: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16' },
];

/** Category pills linking to /examples; categories without an example yet show "Soon". */
@Component({
  selector: 'app-cv-examples-section',
  template: `
    <section class="examples" aria-labelledby="cv-examples-title">
      <header class="intro">
        <p class="pill-badge">Examples</p>
        <h2 class="section-title" id="cv-examples-title">CV examples for every role</h2>
        <p class="sub">Real-world structures for students, graduates and professionals.</p>
      </header>

      <div class="tabs" role="tablist" aria-label="Example type">
        @for (tab of tabs; track tab; let i = $index) {
          <button
            type="button"
            role="tab"
            class="tab"
            [id]="'examples-tab-' + i"
            aria-controls="examples-panel"
            [attr.aria-selected]="tab === active()"
            [attr.tabindex]="tab === active() ? 0 : -1"
            [class.active]="tab === active()"
            (click)="active.set(tab)"
          >
            {{ tab }}
          </button>
        }
      </div>

      <div class="panel" role="tabpanel" id="examples-panel" [attr.aria-labelledby]="'examples-tab-' + tabs.indexOf(active())">
        @if (active() === 'CVs') {
          <ul class="pills" role="list">
            @for (c of categories; track c.slug) {
              <li>
                @if (c.ready) {
                  <a class="pill" [href]="examplesHref + '?category=' + c.slug">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="c.icon" /></svg>
                    {{ c.label }}
                  </a>
                } @else {
                  <span class="pill soon-pill">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="c.icon" /></svg>
                    {{ c.label }}
                    <span class="soon">Soon</span>
                  </span>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="coming">Cover letter examples are coming soon.</p>
        }
      </div>

      <div class="after">
        <a class="cta cta-secondary" [href]="examplesHref">All CV examples <span aria-hidden="true">→</span></a>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; padding-block: 120px; }
    .intro { display: grid; justify-items: center; gap: 16px; margin-bottom: 40px; text-align: center; }
    .sub { max-width: 46ch; color: var(--text-secondary); font-size: var(--text-lg); text-wrap: balance; }

    .tabs { display: flex; justify-content: center; gap: 32px; margin-bottom: 24px; }
    .tab { min-height: 44px; padding: 8px 2px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; color: var(--text-muted); font-size: var(--text-base); }
    .tab:hover { color: var(--text); }
    .tab.active { border-bottom-color: var(--accent); color: var(--text); }

    .panel { padding: 32px; border: 1px solid var(--border); border-radius: 24px; background: var(--surface); box-shadow: var(--shadow); }
    .pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .pill { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 18px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font-size: var(--text-sm); font-weight: 600; text-decoration: none; transition: background-color .15s, border-color .15s, transform .15s, box-shadow .15s; }
    .pill svg { flex: none; width: 18px; height: 18px; fill: none; stroke: var(--primary-600); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    a.pill:hover { border-color: var(--primary-200); background: var(--primary-50); color: var(--text); transform: translateY(-1px); box-shadow: var(--shadow); }
    .soon-pill { color: var(--text-muted); cursor: default; }
    .soon-pill svg { stroke: var(--text-muted); }
    .soon { padding: 2px 8px; border-radius: 999px; background: var(--surface-raised); color: var(--text-secondary); font-size: .6875rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .coming { padding-block: 8px; color: var(--text-secondary); text-align: center; }

    .after { display: flex; justify-content: center; margin-top: 40px; }
    .after .cta { gap: 8px; }

    @media (prefers-reduced-motion: reduce) { a.pill:hover { transform: none; } }
    @media (max-width: 900px) {
      :host { padding-block: 72px; }
      .panel { padding: 20px; }
      .pills { justify-content: flex-start; }
    }
  `,
})
export class CvExamplesSection {
  readonly tabs = ['CVs', 'Cover letters'] as const;
  readonly categories = CATEGORIES;
  readonly examplesHref = EXAMPLES_HREF;
  readonly active = signal<(typeof this.tabs)[number]>('CVs');
}
