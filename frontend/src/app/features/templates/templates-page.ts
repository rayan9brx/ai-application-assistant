import { HttpClient } from '@angular/common/http';
import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, signupUrl } from '../../core/auth.service';
import { CvFlow } from '../../core/cv-flow';
import { CvSheet } from '../../shared/cv-sheet';
import { CV_TEMPLATES, CvTemplateId, SAMPLE_CV, TEMPLATES_HREF } from '../../core/cv-templates';
import { CHECK_HREF } from '../../core/menu-config';
import { TemplateIcon } from '../../shared/template-icon';

/** The /check link that opens the checker with a template chosen (behind sign-up for guests). */
export const useTemplatePath = (id: string) => `${CHECK_HREF}?template=${id}`;

interface Variant {
  id: string;
  name: string;
  description: string;
}

interface TemplateSection {
  template: CvTemplateId;
  pill: string;
  headline: string;
  text: string;
  /** Preview-only styles of the template, drawn by the ::ng-deep rules in templates-page.scss. */
  variants: readonly Variant[];
}

const SECTIONS: readonly TemplateSection[] = [
  {
    template: 'classic',
    pill: 'Our recommendation',
    headline: 'Classic CV template',
    text: 'The standard German-style CV in a Calibri-compatible font: black text, bold headings over a thin rule, dates on the right and small icons in the contact line. Clear for recruiters and every applicant tracking system.',
    variants: [
      { id: 'standard', name: 'Classic', description: 'Fixed black-and-white design; color and font options don’t change it.' },
    ],
  },
  {
    template: 'simple',
    pill: 'Recruiter favorites',
    headline: 'Simple CV templates',
    text: 'Classic single-column layouts that recruiters read in seconds. The safe choice for every industry and every applicant tracking system.',
    variants: [
      { id: 'classic', name: 'Classic', description: 'Clear headings over a thin rule: the timeless standard.' },
      { id: 'centered', name: 'Centered', description: 'Name and contact details centered for a formal first impression.' },
      { id: 'minimal', name: 'Minimal', description: 'No rules and more air, so nothing distracts from your content.' },
    ],
  },
  {
    template: 'modern',
    pill: 'Tech & startup ready',
    headline: 'Modern CV templates',
    text: 'Accent-colored headings and clearly separated sections that make your CV easy to scan. Made for tech, product and startup roles.',
    variants: [
      { id: 'accent', name: 'Accent rule', description: 'Colored headings over a matching rule.' },
      { id: 'tinted', name: 'Tinted headings', description: 'Headings on a soft tint of your accent color.' },
      { id: 'bold', name: 'Bold header', description: 'A larger name with a strong accent line under your header.' },
    ],
  },
  {
    template: 'compact',
    pill: 'High-density layouts',
    headline: 'Compact CV templates',
    text: 'Tight margins and spacing fit more experience on one page without looking crowded. Ideal for long careers and many projects.',
    variants: [
      { id: 'dense', name: 'Dense', description: 'The most content per page, with thin dividers.' },
      { id: 'boxed', name: 'Boxed headings', description: 'Headings on a light band, for quick scanning.' },
    ],
  },
  {
    template: 'creative',
    pill: 'For design & marketing',
    headline: 'Creative CV templates',
    text: 'A bold colored bar with your name, while everything below stays one column of real text that applicant tracking systems can read.',
    variants: [
      { id: 'bar', name: 'Color bar', description: 'Your name in a full-width bar of your accent color.' },
      { id: 'deep', name: 'Deep bar', description: 'A darker bar for a confident, premium look.' },
      { id: 'strip', name: 'Thin strip', description: 'A slim color strip, with your name below in your accent color.' },
    ],
  },
];

/** Accent colors for the previews; each is a color token. */
const COLORS = [
  { id: 'indigo', label: 'Indigo', value: 'var(--primary-600)' },
  { id: 'navy', label: 'Navy', value: 'var(--primary-900)' },
  { id: 'teal', label: 'Teal', value: 'var(--success-text)' },
  { id: 'red', label: 'Red', value: 'var(--danger-text)' },
  { id: 'amber', label: 'Amber', value: 'var(--warning-text)' },
  { id: 'charcoal', label: 'Charcoal', value: 'var(--text)' },
] as const;

const FONTS = [
  { id: 'sans', label: 'Modern sans', value: 'var(--font)' },
  { id: 'serif', label: 'Classic serif', value: "Georgia, 'Times New Roman', serif" },
  { id: 'arial', label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
] as const;

const FEATURES = [
  {
    icon: 'ats',
    title: 'ATS-friendly formats',
    text: 'One column of real text with standard headings, so every line gets read.',
  },
  { icon: 'pdf', title: 'PDF download', text: 'Download a clean, text-based PDF that looks the same everywhere.' },
  {
    icon: 'ai',
    title: 'AI-written bullet points',
    text: 'Turn vague duties into results-focused bullet points in one click.',
  },
] as const;

const FAQ = [
  {
    q: 'What makes a CV template ATS-friendly?',
    a: 'Applicant tracking systems read your CV as plain text. ATS-friendly templates use one column, real (selectable) text, standard section headings like “Experience” and “Education”, and no tables, text boxes or images for content. All our templates follow these rules.',
  },
  {
    q: 'Do colors and fonts hurt my ATS score?',
    a: 'No. An ATS ignores colors and reads common fonts without problems. What matters is the structure: text the system can extract in the right order. Color bars and accent headings are fine as long as the content stays real text.',
  },
  {
    q: 'Should my CV be one or two pages?',
    a: 'For students and up to about five years of experience, one page is best. With more experience, two pages are fine. The Compact template helps you fit more on one page without making it hard to read.',
  },
  {
    q: 'Can I switch templates later?',
    a: 'Yes. Your content is saved separately from the design, so you can switch templates in the CV Checker at any time before you download your PDF.',
  },
] as const;

type ColorId = (typeof COLORS)[number]['id'];
type FontId = (typeof FONTS)[number]['id'];

/**
 * /templates: one long page with every template type as its own section (#simple, #modern…),
 * a sticky bar that restyles all previews live, and features + FAQ at the end.
 */
@Component({
  selector: 'app-templates-page',
  imports: [CvSheet, TemplateIcon],
  templateUrl: './templates-page.html',
  styleUrl: './templates-page.scss',
  host: {
    '[style.--cv-accent]': 'accent()',
    '[style.--cv-font]': 'font()',
    '[class.no-dividers]': '!dividers()',
    '[class.indent]': 'indent()',
  },
})
export class TemplatesPage {
  readonly sections = SECTIONS.map((section) => ({
    ...section,
    name: (({ label, name }) => label ?? name)(CV_TEMPLATES.find((t) => t.id === section.template)!),
  }));
  readonly colors = COLORS;
  readonly fonts = FONTS;
  readonly features = FEATURES;
  readonly faq = FAQ;
  readonly sample = SAMPLE_CV;
  readonly auth = inject(AuthService);

  readonly color = signal<ColorId>('indigo');
  readonly fontId = signal<FontId>('sans');
  readonly dividers = signal(true);
  readonly indent = signal(false);
  readonly accent = computed(() => COLORS.find((c) => c.id === this.color())!.value);
  readonly font = computed(() => FONTS.find((f) => f.id === this.fontId())!.value);
  /** The visible slide of each carousel, by template. */
  readonly active = signal<Partial<Record<CvTemplateId, number>>>({});
  readonly downloading = signal<string | null>(null);
  readonly error = signal('');

  private readonly flow = inject(CvFlow);
  private readonly http = inject(HttpClient);

  constructor() {
    // Coming from another page (/templates#modern, or an old /templates/modern link): the
    // router jumps there instantly, so restart from the top and scroll to the section smoothly.
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    afterNextRender(() => {
      const target = fragment && document.getElementById(fragment);
      if (!target) return;
      queueMicrotask(() => {
        scrollTo({ top: 0, behavior: 'instant' });
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  customizeHref(template: CvTemplateId): string {
    return this.auth.gate(useTemplatePath(template));
  }

  /** Guests sign up first and come back to this section. */
  downloadHref(template: CvTemplateId): string {
    return signupUrl(`${TEMPLATES_HREF}#${template}`);
  }

  /** Remembered on this device too, so the choice survives sign-up and email confirmation. */
  choose(template: CvTemplateId): void {
    this.flow.setTemplate(template);
  }

  setFont(event: Event): void {
    this.fontId.set((event.target as HTMLSelectElement).value as FontId);
  }

  move(track: HTMLElement, direction: 1 | -1): void {
    const slide = track.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (slide.offsetWidth + gap), behavior: 'smooth' });
  }

  scrolled(template: CvTemplateId, track: HTMLElement): void {
    const slide = track.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const last = track.children.length - 1;
    // At the end the last slide may not reach the left edge; count it as active anyway.
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    const index = atEnd ? last : Math.round(track.scrollLeft / (slide.offsetWidth + gap));
    this.active.update((active) => ({ ...active, [template]: Math.min(index, last) }));
  }

  activeIndex(template: CvTemplateId): number {
    return this.active()[template] ?? 0;
  }

  /** The sample CV as a PDF in this template (the export needs an account). */
  async download(template: CvTemplateId, key: string): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(key);
    this.error.set('');
    try {
      const blob = await firstValueFrom(
        this.http.post(
          '/api/documents/export',
          { documentType: 'cv', text: this.sample, template },
          { responseType: 'blob' },
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `${template}-cv-template.pdf`,
      });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.error.set('The PDF couldn’t be created. Please try again.');
    } finally {
      this.downloading.set(null);
    }
  }
}
