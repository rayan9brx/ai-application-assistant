import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { LegalDocument, renderLegal } from './legal-markdown';
import { ScoreGauge } from './score-gauge';

type LegalLang = 'en' | 'de';

interface LegalNavItem {
  doc: string;
  path: string;
  label: string;
  short: string;
}

interface TocEntry {
  id: string;
  text: string;
}

/** Sidebar order; `doc` matches the route data and the file name in public/legal. */
const PAGES: readonly LegalNavItem[] = [
  { doc: 'terms', path: '/terms', label: 'Terms of Use', short: 'Terms' },
  { doc: 'privacy', path: '/privacy', label: 'Privacy Policy', short: 'Privacy' },
  { doc: 'imprint', path: '/imprint', label: 'Imprint', short: 'Imprint' },
];

/** Offset for the sticky navbar when deciding which section is "current". */
const SPY_OFFSET = 120;

/**
 * /terms, /privacy and /imprint in one layout: header, sticky sidebar (pages, a table of
 * contents from the text's ## headings with scroll-spy, a CTA card) and the text. Each text
 * lives in public/legal/<doc>.<en|de>.md; ?lang=de shows the German, legally binding version.
 */
@Component({
  selector: 'app-legal-page',
  imports: [ScoreGauge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-page.html',
  styleUrls: ['./legal-page.scss', './legal-content.scss'],
})
export class LegalPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  readonly auth = inject(AuthService);
  /** Route data: the file name in public/legal (without .en.md / .de.md) and the page heading. */
  readonly legalDoc = input.required<string>();
  readonly title = input.required<string>();
  /** ?lang= query parameter, so the German version has a link of its own. */
  readonly lang = input<string>();
  readonly language = computed<LegalLang>(() => (this.lang() === 'de' ? 'de' : 'en'));
  readonly pages = PAGES;
  readonly doc = signal<LegalDocument | null>(null);
  readonly failed = signal(false);
  readonly toc = signal<TocEntry[]>([]);
  /** The pasted text may already carry the 'German version prevails' note; don't show it twice. */
  readonly noteInText = computed(() => /german version prevails/i.test(this.doc()?.html ?? ''));
  readonly activeSection = signal('');
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  private request = 0;

  constructor() {
    effect(() => void this.load(this.legalDoc(), this.language()));

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.spy());
    };
    addEventListener('scroll', onScroll, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    });
  }

  /** Keeps the chosen language when moving between the legal pages. */
  pageHref(page: LegalNavItem): string {
    return this.language() === 'de' ? `${page.path}?lang=de` : page.path;
  }

  setLang(lang: LegalLang): void {
    void this.router.navigate([], { queryParams: { lang: lang === 'de' ? 'de' : null }, replaceUrl: true });
  }

  /** Smooth scroll (instant with reduced motion), without touching the URL or the router. */
  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
    this.activeSection.set(id);
  }

  private async load(name: string, lang: LegalLang): Promise<void> {
    const id = ++this.request;
    this.doc.set(null);
    this.failed.set(false);
    this.toc.set([]);
    try {
      const text = await firstValueFrom(this.http.get(`/legal/${name}.${lang}.md`, { responseType: 'text' }));
      if (id !== this.request) return;
      this.doc.set(renderLegal(text));
      afterNextRender(() => this.buildToc(), { injector: this.injector });
    } catch {
      if (id === this.request) this.failed.set(true);
    }
  }

  /** Gives every ## heading an id and lists it; works for Markdown and pasted HTML alike. */
  private buildToc(): void {
    const root = this.content()?.nativeElement;
    if (!root) return;
    const used = new Set<string>();
    const entries = Array.from(root.querySelectorAll('h2'), (heading) => {
      const text = heading.textContent?.trim() ?? '';
      let id = 'section-' + (slug(text) || 'part');
      for (let n = 2; used.has(id); n++) id = `section-${slug(text) || 'part'}-${n}`;
      used.add(id);
      heading.id = id;
      heading.tabIndex = -1;
      return { id, text };
    });
    this.toc.set(entries);
    this.spy();
  }

  /** The current section is the last heading that has scrolled past the navbar. */
  private spy(): void {
    const entries = this.toc();
    if (!entries.length) return;
    let current = entries[0].id;
    for (const entry of entries) {
      const heading = document.getElementById(entry.id);
      if (heading && heading.getBoundingClientRect().top <= SPY_OFFSET) current = entry.id;
    }
    // At the very bottom, the last section counts even if its heading can't reach the top.
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = entries[entries.length - 1].id;
    this.activeSection.set(current);
  }
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/ß/g, 'ss')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
