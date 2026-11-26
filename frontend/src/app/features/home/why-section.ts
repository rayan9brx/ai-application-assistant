import { Component } from '@angular/core';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

const REASONS = [
  {
    title: 'German CV standards',
    text: 'Tabular Lebenslauf, German and English, Werkstudent and internship ready.',
    icon: 'M4 4h16v16H4zM4 9h16M9 9v11',
  },
  {
    title: 'Honest pricing',
    text: 'No hidden trial that turns into a subscription. Cancel anytime.',
    icon: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  },
  {
    title: 'Privacy first',
    text: 'Your data stays in the EU. Delete everything with one click.',
    icon: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4',
  },
  {
    title: 'More than ChatGPT',
    text: 'ATS score, fixes and a ready PDF in one place, no prompts needed.',
    icon: 'M4 6h16M4 12h10M4 18h7M17 15l2 2 3-4',
  },
];

/** Four reasons, each an icon card. */
@Component({
  selector: 'app-why-section',
  imports: [SectionHead],
  hostDirectives: [Reveal],
  template: `
    <section aria-labelledby="why-title">
      <app-section-head pill="Why Rezumo" title="Built for job seekers in Germany" headingId="why-title" />
      <ul class="cards" role="list">
        @for (reason of reasons; track reason.title) {
          <li class="card">
            <span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path [attr.d]="reason.icon" /></svg></span>
            <h3>{{ reason.title }}</h3>
            <p>{{ reason.text }}</p>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host { display: block; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; margin: 0; padding: 0; list-style: none; }
    .card { padding: 24px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); box-shadow: var(--shadow); }
    .icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--accent-soft); }
    .icon svg { width: 22px; height: 22px; fill: none; stroke: var(--accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    h3 { margin-top: 16px; font-size: 1.0625rem; letter-spacing: -.01em; }
    p { margin-top: 6px; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.55; }
    @media (max-width: 1000px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .cards { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class WhySection {
  readonly reasons = REASONS;
}
