import { ApplicationRef, EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { BuilderDesign } from '../core/cv-builder';
import { CvTemplateId } from '../core/cv-templates';
import { CvSheet } from './cv-sheet';

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The CV PDF export: prints the same CvSheet component the preview shows, at A4 size (@page in
 * styles.scss), so the PDF can never differ from the preview. The browser's "Save as PDF" keeps
 * real, selectable text with the fonts embedded. There is no second layout on the backend.
 */
@Injectable({ providedIn: 'root' })
export class CvPrint {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private printing = false;

  /** Opens the print dialog for the CV; `fileName` is the suggested PDF name (without .pdf). */
  async print(text: string, template: CvTemplateId, design: BuilderDesign | null = null, fileName?: string): Promise<void> {
    if (this.printing) return;
    this.printing = true;
    // The fit-to-page and contact-line measurements need the real fonts before the first layout.
    await Promise.all(['400 11pt Carlito', '700 11pt Carlito'].map((font) => document.fonts.load(font).catch(() => [])));
    await document.fonts.ready;

    const container = document.createElement('div');
    container.className = 'cv-print';
    document.body.appendChild(container);
    const ref = createComponent(CvSheet, { environmentInjector: this.injector });
    ref.setInput('text', text);
    ref.setInput('template', template);
    ref.setInput('design', design);
    container.appendChild(ref.location.nativeElement);
    this.appRef.attachView(ref.hostView);
    const title = document.title;
    try {
      ref.changeDetectorRef.detectChanges();
      // Wait until the sheet has measured itself (scale, fit to page, contact line).
      const host = ref.location.nativeElement as HTMLElement;
      for (let i = 0; i < 120 && !host.classList.contains('ready'); i++) await frame();
      await frame();
      await frame();
      document.title = fileName ?? defaultFileName(text);
      document.body.classList.add('printing-cv');
      const printed = new Promise<void>((resolve) => window.addEventListener('afterprint', () => resolve(), { once: true }));
      window.print();
      // Chrome blocks in print(); other browsers return at once and fire afterprint when done.
      await Promise.race([printed, delay(60_000)]);
    } finally {
      document.body.classList.remove('printing-cv');
      document.title = title;
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      container.remove();
      this.printing = false;
    }
  }
}

/** "Rayen Brigui" → "Rayen-Brigui-CV". */
function defaultFileName(text: string): string {
  const name = text.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
  const safe = name.replace(/[^\p{L}\p{N} ]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 60);
  return safe ? `${safe}-CV` : 'CV';
}
