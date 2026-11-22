import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from './auth.service';
import { CvApi, CvSummary, SavedAnalysis } from './cv-api';
import { CvFlow, MAX_FILE_BYTES } from './cv-flow';
import { Navigation } from './navigation';
import { ONBOARDING_STEPS, OnboardingAnswers } from './onboarding-options';
import { ScoreRing } from './score-ring';
import { scoreTone } from './score-tone';

type SortKey = 'created' | 'edited' | 'score';
type ViewMode = 'grid' | 'list';
const VIEW_KEY = 'dashboard-view';
const SORT_KEY = 'dashboard-sort';

/**
 * /dashboard: greeting, feature cards and the user's saved CVs (grid or list) with open,
 * rename, duplicate, delete and score history. A dropped or chosen file is scored on /check.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, NgTemplateOutlet, ScoreRing],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly api = inject(CvApi);
  private readonly flow = inject(CvFlow);
  private readonly navigation = inject(Navigation);
  readonly auth = inject(AuthService);
  private readonly renameDialog = viewChild<ElementRef<HTMLDialogElement>>('renameDialog');
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  private readonly historyDialog = viewChild<ElementRef<HTMLDialogElement>>('historyDialog');

  readonly cvs = signal<CvSummary[] | null>(null);
  readonly error = signal('');
  readonly busyId = signal<string | null>(null);
  readonly history = signal<Record<string, SavedAnalysis[]>>({});
  readonly sort = signal<SortKey>(stored(SORT_KEY, ['created', 'edited', 'score'], 'edited'));
  readonly view = signal<ViewMode>(stored(VIEW_KEY, ['grid', 'list'], 'grid'));
  readonly menuFor = signal<string | null>(null);
  /** The CV a dialog (rename, delete, history) is open for. */
  readonly target = signal<CvSummary | null>(null);
  readonly newTitle = signal('');
  readonly dragging = signal(false);
  readonly uploadError = signal('');
  readonly answers = signal<OnboardingAnswers | null>(null);

  readonly firstName = computed(() => {
    const name = this.auth.user()?.user_metadata?.['full_name'];
    return typeof name === 'string' ? (name.trim().split(/\s+/)[0] ?? '') : '';
  });
  readonly subline = computed(() => personalLine(this.answers()));
  readonly sorted = computed(() => {
    const list = [...(this.cvs() ?? [])];
    const time = (value: string | null) => (value ? Date.parse(value) : 0);
    switch (this.sort()) {
      case 'created':
        return list.sort((a, b) => time(b.createdAt) - time(a.createdAt));
      case 'score':
        return list.sort((a, b) => (b.lastScore ?? -1) - (a.lastScore ?? -1));
      default:
        return list.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
    }
  });

  constructor() {
    void this.load();
    this.api.onboarding().then(
      (state) => this.answers.set(state.answers),
      () => undefined,
    );
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
    const sort = (['created', 'edited', 'score'] as SortKey[]).find((s) => s === value) ?? 'edited';
    this.sort.set(sort);
    save(SORT_KEY, sort);
  }

  setView(view: ViewMode): void {
    this.view.set(view);
    save(VIEW_KEY, view);
  }

  // Upload card

  pick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.score(file);
  }

  dragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  dragLeave(event: DragEvent): void {
    const card = event.currentTarget as HTMLElement;
    if (!card.contains(event.relatedTarget as Node | null)) this.dragging.set(false);
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) void this.score(file);
  }

  /** Hands the file to /check, which starts scoring it right away. */
  private async score(file: File): Promise<void> {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      this.uploadError.set(`“${file.name}” isn’t a PDF or Word (.docx) file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.uploadError.set(`“${file.name}” is larger than 5 MB.`);
      return;
    }
    this.uploadError.set('');
    this.flow.reset();
    this.flow.handOff(file);
    await this.navigation.go('/check');
  }

  // CV actions

  toggleMenu(cv: CvSummary, event: Event): void {
    event.stopPropagation();
    this.menuFor.update((id) => (id === cv.id ? null : cv.id));
  }

  /** Loads the CV and its latest score into the checker. */
  async open(cv: CvSummary): Promise<void> {
    this.menuFor.set(null);
    await this.act(cv.id, async () => {
      const [saved, runs] = await Promise.all([this.api.get(cv.id), this.api.history(cv.id)]);
      this.flow.loadSaved(
        saved.id,
        saved.content.text ?? '',
        saved.jobDescription ?? '',
        runs[0]?.result ?? null,
        runs[1]?.overallScore ?? null,
      );
      await this.navigation.go('/check');
      // A CV saved without a score has nothing to show yet: score it now (saved to its history).
      if (!runs[0]) void this.flow.startWithText(saved.content.text ?? '');
    }, 'This CV couldn’t be opened.');
  }

  async duplicate(cv: CvSummary): Promise<void> {
    this.menuFor.set(null);
    await this.act(cv.id, async () => {
      await this.api.duplicate(cv.id);
      await this.load();
    }, 'This CV couldn’t be duplicated.');
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

  async showHistory(cv: CvSummary): Promise<void> {
    this.menuFor.set(null);
    this.target.set(cv);
    this.historyDialog()?.nativeElement.showModal();
    await this.act(cv.id, async () => {
      const runs = await this.api.history(cv.id);
      this.history.update((all) => ({ ...all, [cv.id]: runs }));
    }, 'The score history couldn’t be loaded.');
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

  scoreClass(score: number | null): string {
    return score === null ? 'none' : scoreTone(score);
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

/** The greeting's second line, from the onboarding answers. */
export function personalLine(answers: OnboardingAnswers | null): string {
  const fallback = 'Let’s get your CV ready for your next role.';
  if (!answers) return fallback;
  const roleStep = ONBOARDING_STEPS.find((s) => s.field === 'roles');
  const labels = roleStep && roleStep.kind === 'multi' ? roleStep.options : [];
  const roles = answers.roles
    .filter((r) => r !== 'other')
    .map((r) => labels.find((o) => o.key === r)?.label)
    .filter((label): label is string => !!label);
  const remote = answers.locations.some((l) => l.toLowerCase() === 'remote');
  const places = answers.locations.filter((l) => l.toLowerCase() !== 'remote');

  if (roles.length || places.length || remote) {
    const roleText = roles.length ? `${list(roles.slice(0, 2), 'and')}${roles.length > 2 ? ' and more' : ''} roles` : 'roles';
    const where = places.length
      ? ` in ${list(places.slice(0, 2), 'or')}${remote ? ' or remote' : ''}`
      : remote
        ? ' you can do remotely'
        : '';
    return `Let’s get your CV ready for ${roleText}${where}.`;
  }
  switch (answers.challenge) {
    case 'cv_quality':
      return 'Let’s find out how good your CV really is.';
    case 'ats':
      return 'Let’s get your CV past ATS filters.';
    case 'tailor':
      return 'Let’s tailor your CV to the job you want.';
    case 'job_search':
      return 'Let’s get your CV ready for your job search.';
    default:
      return fallback;
  }
}

function list(items: string[], word: string): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`;
}

function stored<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.find((a) => a === value) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A per-browser convenience only.
  }
}
