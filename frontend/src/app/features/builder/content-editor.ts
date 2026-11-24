import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, effect, inject, signal, untracked } from '@angular/core';
import {
  BuilderContact,
  BuilderContent,
  BuilderEntry,
  BuilderSection,
  JOINS_LINES,
  MAX_EXTRA_LINKS,
  SectionKind,
  emptyEntry,
  joinLineBreaks,
  sectionInfo,
} from '../../core/cv-builder';

type ContactField = Exclude<keyof BuilderContact, 'extraLinks'>;
import { CvFix, CvFlow } from '../../core/cv-flow';
import { BuilderStore } from './builder-store';

interface Proposal {
  busy: boolean;
  fix?: CvFix;
  text?: string;
  error?: string;
}

/** Contact details and the CV sections as an accordion, with entries, bullets and AI rewrites. */
@Component({
  selector: 'app-content-editor',
  imports: [NgTemplateOutlet],
  templateUrl: './content-editor.html',
  styleUrls: ['./builder-panels.scss', './content-editor.scss'],
})
export class ContentEditor {
  readonly store = inject(BuilderStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly info = sectionInfo;
  readonly open = signal<ReadonlySet<SectionKind>>(new Set(['target', 'summary', 'experience']));
  readonly editingContact = signal(false);
  readonly menuFor = signal<SectionKind | null>(null);
  readonly proposals = signal<Record<string, Proposal>>({});
  readonly maxExtraLinks = MAX_EXTRA_LINKS;
  readonly contactFields: { key: ContactField; label: string; type: string; placeholder: string }[] = [
    { key: 'name', label: 'Full name', type: 'text', placeholder: 'Jonas Weber' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+49 40 5550 1234' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'Hamburg, Germany' },
    { key: 'links', label: 'Links', type: 'text', placeholder: 'linkedin.com/in/…, github.com/…' },
  ];

  constructor() {
    // Jump requests (from the Analyzer): open the section, scroll to it and focus its first field.
    effect(() => {
      const target = this.store.focus();
      if (!target) return;
      untracked(() => {
        this.store.focus.set(null);
        if (target.kind === 'contact') this.editingContact.set(true);
        else {
          this.open.update((set) => new Set(set).add(target.kind as SectionKind));
          if (this.store.content().sections.find((s) => s.kind === target.kind)?.hidden) {
            this.setHidden(target.kind, false);
          }
        }
        setTimeout(() => {
          const element = this.host.querySelector<HTMLElement>(`#sec-${target.kind}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          element?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true });
          element?.classList.add('flash');
          setTimeout(() => element?.classList.remove('flash'), 1200);
        });
      });
    });
  }

  @HostListener('document:click', ['$event'])
  closeMenu(event: MouseEvent): void {
    if (!(event.target as Element).closest?.('.section-menu')) this.menuFor.set(null);
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  contactSummary(contact: BuilderContact): string {
    return [contact.email, contact.phone, contact.location].filter((v) => v.trim()).join(' · ');
  }

  setContact(key: ContactField, value: string): void {
    this.store.update((content) => (content.contact[key] = value));
  }

  addExtraLink(): void {
    let index = -1;
    this.store.update((content) => {
      if (content.contact.extraLinks.length < MAX_EXTRA_LINKS) index = content.contact.extraLinks.push({ label: '', url: '' }) - 1;
    });
    if (index >= 0) this.focusLater(`#extra-link-${index}`);
  }

  setExtraLink(index: number, key: 'label' | 'url', value: string): void {
    this.store.update((content) => {
      const link = content.contact.extraLinks[index];
      if (link) link[key] = value;
    });
  }

  removeExtraLink(index: number): void {
    this.store.update((content) => content.contact.extraLinks.splice(index, 1));
  }

  // Line breaks: pasted text (often from a PDF) is joined into flowing text right away; typed
  // text is joined when the field loses focus. An empty line stays a paragraph break.

  /** `kind` null: a bullet, which is always one line. */
  pasteJoined(event: ClipboardEvent, kind: SectionKind | null): void {
    const pasted = event.clipboardData?.getData('text/plain');
    if (pasted == null || !/[\r\n]/.test(pasted)) return;
    if (kind && !JOINS_LINES.has(kind)) return;
    event.preventDefault();
    const field = event.target as HTMLTextAreaElement;
    const joined = joinLineBreaks(pasted);
    field.setRangeText(kind ? joined : joined.replace(/\n+/g, ' '), field.selectionStart, field.selectionEnd, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  joinText(kind: SectionKind): void {
    if (!JOINS_LINES.has(kind)) return;
    const section = this.store.content().sections.find((s) => s.kind === kind);
    if (section && joinLineBreaks(section.text) !== section.text.trim()) this.setText(kind, joinLineBreaks(section.text));
  }

  joinBullet(kind: SectionKind, id: string, index: number): void {
    const bullet = this.store.content().sections.find((s) => s.kind === kind)?.entries.find((e) => e.id === id)?.bullets[index];
    if (bullet == null) return;
    const joined = joinLineBreaks(bullet).replace(/\n+/g, ' ');
    if (joined !== bullet.trim()) this.setBullet(kind, id, index, joined);
  }

  toggle(kind: SectionKind): void {
    this.open.update((set) => {
      const next = new Set(set);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });
  }

  private edit(kind: SectionKind, change: (section: BuilderSection, content: BuilderContent) => void): void {
    this.store.update((content) => {
      const section = content.sections.find((s) => s.kind === kind);
      if (section) change(section, content);
    });
  }

  private editEntry(kind: SectionKind, id: string, change: (entry: BuilderEntry, section: BuilderSection) => void): void {
    this.edit(kind, (section) => {
      const entry = section.entries.find((e) => e.id === id);
      if (entry) change(entry, section);
    });
  }

  setText(kind: SectionKind, text: string): void {
    this.edit(kind, (section) => (section.text = text));
  }

  add(section: BuilderSection): void {
    this.open.update((set) => new Set(set).add(section.kind));
    if (this.info(section.kind).type === 'entries') {
      const entry = emptyEntry();
      this.edit(section.kind, (s) => {
        s.hidden = false;
        s.entries.push(entry);
      });
      this.focusLater(`#entry-${entry.id} input`);
    } else {
      this.edit(section.kind, (s) => (s.hidden = false));
      this.focusLater(`#sec-${section.kind} textarea, #sec-${section.kind} input`);
    }
  }

  move(kind: SectionKind, by: -1 | 1): void {
    this.menuFor.set(null);
    this.store.update((content) => {
      const i = content.sections.findIndex((s) => s.kind === kind);
      const j = i + by;
      if (i < 0 || j < 0 || j >= content.sections.length) return;
      [content.sections[i], content.sections[j]] = [content.sections[j], content.sections[i]];
    });
  }

  setHidden(kind: SectionKind, hidden: boolean): void {
    this.menuFor.set(null);
    this.edit(kind, (section) => (section.hidden = hidden));
  }

  /** The section types are fixed, so "delete" empties the section and hides it. */
  clear(kind: SectionKind): void {
    this.menuFor.set(null);
    this.edit(kind, (section) => {
      section.text = '';
      section.entries = [];
      section.hidden = true;
    });
  }

  setEntry(kind: SectionKind, id: string, key: 'title' | 'org' | 'location' | 'start' | 'end', value: string): void {
    this.editEntry(kind, id, (entry) => (entry[key] = value));
  }

  setPresent(kind: SectionKind, id: string, present: boolean): void {
    this.editEntry(kind, id, (entry) => (entry.present = present));
  }

  moveEntry(kind: SectionKind, id: string, by: -1 | 1): void {
    this.edit(kind, (section) => {
      const i = section.entries.findIndex((e) => e.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= section.entries.length) return;
      [section.entries[i], section.entries[j]] = [section.entries[j], section.entries[i]];
    });
  }

  removeEntry(kind: SectionKind, id: string): void {
    this.edit(kind, (section) => (section.entries = section.entries.filter((e) => e.id !== id)));
  }

  setBullet(kind: SectionKind, id: string, index: number, value: string): void {
    this.editEntry(kind, id, (entry) => (entry.bullets[index] = value));
  }

  addBullet(kind: SectionKind, id: string): void {
    let index = 0;
    this.editEntry(kind, id, (entry) => (index = entry.bullets.push('') - 1));
    this.focusLater(`#bullet-${id}-${index}`);
  }

  removeBullet(kind: SectionKind, id: string, index: number): void {
    this.editEntry(kind, id, (entry) => entry.bullets.splice(index, 1));
    this.dropProposal(`${id}:${index}`);
  }

  /** Enter in a bullet adds the next one. */
  bulletKey(event: KeyboardEvent, kind: SectionKind, id: string): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.addBullet(kind, id);
  }

  // ✨ Improve with AI

  async improve(key: string, sectionLabel: string, line: string): Promise<void> {
    if (!line.trim() || this.proposals()[key]?.busy) return;
    this.setProposal(key, { busy: true });
    try {
      const fix = await this.store.improve(sectionLabel, line.trim());
      const text = fix.replacement
        .split('\n')
        .map((l) => l.replace(/^\s*[-•*–▪●]\s+/, '').trim())
        .filter((l) => l && l.toUpperCase() !== l)
        .join(' ');
      if (!text || text === line.trim()) this.setProposal(key, { busy: false, error: 'No better version found — this line already reads well.' });
      else this.setProposal(key, { busy: false, fix, text });
    } catch (error) {
      this.setProposal(key, { busy: false, error: CvFlow.message(error, 'The AI rewrite failed. Please try again.') });
    }
  }

  accept(key: string, kind: SectionKind, id: string, index: number): void {
    if (key === 'summary') this.acceptSummary();
    else this.acceptBullet(kind, id, index);
  }

  acceptSummary(): void {
    const text = this.proposals()['summary']?.text;
    if (text) this.setText('summary', text);
    this.dropProposal('summary');
  }

  acceptBullet(kind: SectionKind, id: string, index: number): void {
    const key = `${id}:${index}`;
    const text = this.proposals()[key]?.text;
    if (text) this.setBullet(kind, id, index, text);
    this.dropProposal(key);
  }

  dropProposal(key: string): void {
    this.proposals.update((all) => {
      const { [key]: _, ...rest } = all;
      return rest;
    });
  }

  private setProposal(key: string, proposal: Proposal): void {
    this.proposals.update((all) => ({ ...all, [key]: proposal }));
  }

  private focusLater(selector: string): void {
    setTimeout(() => this.host.querySelector<HTMLElement>(selector)?.focus());
  }
}
