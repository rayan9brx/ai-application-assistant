import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { Faq } from '../pricing/faq';
import { FaqItem } from '../pricing/pricing-config';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

const HOME_FAQ: readonly FaqItem[] = [
  {
    question: 'Is Rezumo free?',
    answer:
      'Yes, you can start for free without a credit card: one CV, an ATS score, a few AI rewrites and PDF download. Paid plans add more AI checks and templates.',
    link: { label: 'See pricing', href: '/pricing' },
  },
  {
    question: 'What is an ATS?',
    answer:
      'An Applicant Tracking System is software many companies use to collect and filter applications. It reads your CV as text and looks for the right sections and keywords before a recruiter sees it.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Your saved CVs are stored in the EU and only you can see them. For the analysis, your CV text is sent encrypted to our AI provider. You can delete your CVs or your whole account anytime in Settings. We never sell your data.',
  },
  {
    question: 'Does it work for German CVs?',
    answer:
      'Yes. The templates follow the tabular Lebenslauf layout, and the checker works with German and English CVs, including Werkstudent jobs and internships.',
  },
  {
    question: 'How is it different from ChatGPT?',
    answer:
      'ChatGPT can rewrite text, but you write the prompts and format the result yourself. Rezumo checks your CV like an ATS, lists what’s missing, fixes it in place and gives you a ready PDF.',
  },
];

/** The homepage FAQ and the closing call to action. */
@Component({
  selector: 'app-faq-section',
  imports: [Faq, SectionHead],
  hostDirectives: [Reveal],
  template: `
    <section aria-labelledby="faq-title">
      <app-section-head pill="FAQ" title="Questions, answered" headingId="faq-title" />
      <div class="faq"><app-faq [items]="items" /></div>
    </section>

    <section class="final" aria-labelledby="final-title">
      <h2 id="final-title">Your next interview starts with a better CV</h2>
      <a class="final-cta" [href]="auth.startHref()">Get started for free</a>
    </section>
  `,
  styles: `
    :host { display: block; }
    .faq { max-width: 760px; margin-inline: auto; }
    .final { display: grid; justify-items: center; gap: 28px; margin-top: 120px; padding: 72px 32px; border-radius: 28px; background: var(--primary-gradient); color: var(--white); text-align: center; }
    .final h2 { max-width: 20ch; font-size: clamp(1.875rem, 4vw, 2.75rem); font-weight: 700; line-height: 1.1; letter-spacing: -.04em; text-wrap: balance; }
    .final-cta { display: inline-flex; align-items: center; min-height: 52px; padding: 14px 32px; border-radius: 999px; background: var(--white); color: var(--primary-700); font-weight: 700; text-decoration: none; transition: transform .18s ease; }
    .final-cta:hover { color: var(--primary-900); transform: translateY(-1px); }
    .final-cta:focus-visible { outline: 2px solid var(--white); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) { .final-cta:hover { transform: none; } }
    @media (max-width: 640px) {
      .final { margin-top: 72px; padding: 48px 20px; border-radius: 20px; }
      .final-cta { width: 100%; justify-content: center; }
    }
  `,
})
export class FaqSection {
  readonly auth = inject(AuthService);
  readonly items = HOME_FAQ;
}
