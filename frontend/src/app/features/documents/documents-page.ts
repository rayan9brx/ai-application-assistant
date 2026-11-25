import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { CvApi, CvSummary } from '../../core/cv-api';
import { CvFlow } from '../../core/cv-flow';
import { Navigation } from '../../core/navigation';
import { ScoreRing } from '../../shared/score-ring';

type SortKey = 'edited' | 'name';
const SORT_KEY = 'documents-sort';

/**
 * /documents: all of the user's documents in one place. CVs use the dashboard's cards (open,
 * rename, duplicate, download PDF, delete); cover letters show an empty state until they exist.
 */
@Component({
  selector: 'app-documents-page',
  imports: [ScoreRing],
  templateUrl: './documents-page.html',
  styleUrls: ['../dashboard/dashboard-page.scss', './documents-page.scss'],
})
export class DocumentsPage {
  private readonly api = inject(CvApi);
  private readonly flow = inject(CvFlow);
  private readonly navigation = inject(Navigation);
  private readonly renameDialog = viewChild<ElementRef<HTMLDialogElement>>('renameDialog');
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');

  readonly cvs = signal<CvSummary[] | null>(null);
  readonly error = signal('');
  readonly busyId = signal<string | null>(null);
  readonly query = signal('');
  readonly sort = signal<SortKey>(storedSort());
  readonly menuFor = signal<string | null>(null);
  /** The CV a dialog (rename, delete) is open for. */
  readonly target = signal<CvSummary | null>(null);
  readonly newTitle = signal('');

  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    const list = (this.cvs() ?? []).filter(
      (cv) => !query || cv.title.toLowerCase().includes(query) || cv.preview.toLowerCase().includes(query),
    );
    return this.sort() === 'name'
      ? list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      : list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set('');
    try {
      this.cvs.set(await this.api.list());
    } catch (error) {
      this.error.set(CvFlow.message(error, 'Your CVs couldn’t be loaded. Please refresh.'));
      this.cvs.set(this.cvs() ?? []);
    }
  }

  setSort(value: string): void {
    const sort: SortKey = value === 'name' ? 'name' : 'edited';
    this.sort.set(sort);
    try {
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      // A per-browser convenience only.
    }
  }

  toggleMenu(cv: CvSummary, event: Event): void {
    event.stopPropagation();
    this.menuFor.update((id) => (id === cv.id ? null : cv.id));
  }

  async open(cv: CvSummary): Promise<void> {
    this.menuFor.set(null);
    await this.navigation.go(`/builder/${cv.id}`);
  }

  async duplicate(cv: CvSummary): Promise<void> {
    this.menuFor.set(null);
    await this.act(cv.id, async () => {
      await this.api.duplicate(cv.id);
      await this.load();
    }, 'This CV couldn’t be duplicated.');
  }

  async download(cv: CvSummary): Promise<void> {
    this.menuFor.set(null);
    await this.act(cv.id, async () => {
      const saved = await this.api.get(cv.id);
      await this.flow.exportPdf(saved.content.text, saved.template);
    }, 'The PDF couldn’t be created. Please try again.');
  }

  askRename(cv: CvSummary): void {
    this.menuFor.set(null);
    this.target.set(cv);
    this.newTitle.set(cv.title);
    this.renameDialog()?.nativeElement.showModal();
  }

  async rename(event: Event): Promise<void> {
    event.preventDefault();
    const cv = this.target();
    const title = this.newTitle().trim().slice(0, 200);
    if (!cv || !title) return;
    await this.act(cv.id, async () => {
      const saved = await this.api.get(cv.id);
      await this.api.update(cv.id, { title, content: saved.content, jobDescription: saved.jobDescription });
      this.cvs.update((list) => list?.map((item) => (item.id === cv.id ? { ...item, title } : item)) ?? null);
      this.renameDialog()?.nativeElement.close();
    }, 'This CV couldn’t be renamed.');
  }

  askDelete(cv: CvSummary): void {
    this.menuFor.set(null);
    this.target.set(cv);
    this.deleteDialog()?.nativeElement.showModal();
  }

  async remove(): Promise<void> {
    const cv = this.target();
    if (!cv) return;
    await this.act(cv.id, async () => {
      await this.api.remove(cv.id);
      if (this.flow.savedCvId() === cv.id) this.flow.savedCvId.set(null);
      this.cvs.update((list) => list?.filter((item) => item.id !== cv.id) ?? null);
      this.deleteDialog()?.nativeElement.close();
    }, 'This CV couldn’t be deleted.');
  }

  closeDialog(dialog: HTMLDialogElement): void {
    dialog.close();
  }

  /** "2h ago", "3 days ago"… */
  ago(value: string): string {
    const seconds = Math.round((Date.parse(value) - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  @HostListener('document:click', ['$event'])
  closeMenu(event: MouseEvent): void {
    if (!(event.target as Element).closest?.('.cv-menu')) this.menuFor.set(null);
  }

  @HostListener('document:keydown.escape')
  escape(): void {
    this.menuFor.set(null);
  }

  private async act(id: string, action: () => Promise<void>, fallback: string): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(CvFlow.message(error, fallback));
    } finally {
      this.busyId.set(null);
    }
  }
}

function storedSort(): SortKey {
  try {
    return localStorage.getItem(SORT_KEY) === 'name' ? 'name' : 'edited';
  } catch {
    return 'edited';
  }
}
