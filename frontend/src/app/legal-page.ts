import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LegalDocument, renderLegal } from './legal-markdown';

type LegalLang = 'en' | 'de';

/**
 * /imprint, /privacy and /terms. Each text lives in public/legal/<doc>.<en|de>.md, so it can be
 * replaced without touching code. English is the default; ?lang=de shows the German version,
 * which is the legally binding one.
 */
@Component({
  selector: 'app-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="legal" [attr.lang]="language()" aria-labelledby="legal-title">
      <div class="top">
        <h1 id="legal-title">{{ title() }}</h1>
        <div class="toggle" role="group" aria-label="Language / Sprache">
          <button type="button" lang="en" [attr.aria-pressed]="language() === 'en'" (click)="setLang('en')">EN</button>
          <button type="button" lang="de" [attr.aria-pressed]="language() === 'de'" (click)="setLang('de')">DE</button>
        </div>
      </div>
      @if (language() === 'en') {
        <p class="note">In case of discrepancies, the German version prevails.</p>
      }
      @if (doc(); as d) {
        @if (d.updated) { <p class="updated">{{ d.updated }}</p> }
        <div class="content" [innerHTML]="d.html"></div>
      } @else if (failed()) {
        <p class="error" role="alert">
          {{ language() === 'de' ? 'Der Text konnte nicht geladen werden. Bitte lade die Seite neu.'
                                 : 'The text couldn’t be loaded. Please reload the page.' }}
        </p>
      } @else {
        <p class="updated" role="status">{{ language() === 'de' ? 'Wird geladen…' : 'Loading…' }}</p>
      }
    </article>
  `,
  styles: `
    :host { display: block; padding-block: var(--space-7); }
    .legal { width: min(760px, 100%); margin-inline: auto; }
    .top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-2); }
    .toggle { display: inline-flex; flex: none; padding: 3px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); }
    .toggle button { min-height: 32px; padding: 4px 14px; border: 0; border-radius: 999px; background: transparent; color: var(--muted); font-size: 12px; }
    .toggle button[aria-pressed='true'] { background: var(--accent); color: #fff; }
    .toggle button:hover:not([aria-pressed='true']) { color: var(--ink); }
    .note { margin: var(--space-3) 0 var(--space-2); padding: 10px 12px; border-left: 3px solid var(--accent); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; background: var(--accent-soft); font-size: var(--text-sm); }
    .updated { margin-bottom: var(--space-6); color: var(--muted); font-size: var(--text-sm); }
    .error { padding: 10px 12px; border-radius: var(--radius-sm); background: var(--danger-soft); color: var(--danger); font-size: var(--text-sm); }
    .content { line-height: 1.7; overflow-wrap: anywhere; }
    .content :is(h2, h3, h4) { margin: var(--space-6) 0 var(--space-2); }
    .content h2 { font-size: 1.25rem; }
    .content h3 { font-size: 1.05rem; }
    .content h4 { font-size: var(--text-base); }
    .content :is(p, ul, ol, table) { margin: 0 0 var(--space-4); }
    .content :is(ul, ol) { padding-left: 1.4em; }
    .content li + li { margin-top: var(--space-1); }
    .content table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .content :is(th, td) { padding: 8px; border: 1px solid var(--line); text-align: left; }
  `,
})
export class LegalPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  /** Route data: the file name in public/legal (without .en.md / .de.md) and the page heading. */
  readonly legalDoc = input.required<string>();
  readonly title = input.required<string>();
  /** ?lang= query parameter, so the German version has a link of its own. */
  readonly lang = input<string>();
  readonly language = computed<LegalLang>(() => (this.lang() === 'de' ? 'de' : 'en'));
  readonly doc = signal<LegalDocument | null>(null);
  readonly failed = signal(false);
  private request = 0;

  constructor() {
    effect(() => void this.load(this.legalDoc(), this.language()));
  }

  setLang(lang: LegalLang): void {
    void this.router.navigate([], {
      queryParams: { lang: lang === 'de' ? 'de' : null },
      replaceUrl: true,
    });
  }

  private async load(name: string, lang: LegalLang): Promise<void> {
    const id = ++this.request;
    this.doc.set(null);
    this.failed.set(false);
    try {
      const text = await firstValueFrom(this.http.get(`/legal/${name}.${lang}.md`, { responseType: 'text' }));
      if (id === this.request) this.doc.set(renderLegal(text));
    } catch {
      if (id === this.request) this.failed.set(true);
    }
  }
}
