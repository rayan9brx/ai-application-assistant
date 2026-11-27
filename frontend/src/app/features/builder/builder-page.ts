import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CvApi } from '../../core/cv-api';
import { CvFlow } from '../../core/cv-flow';
import { FitSuggestion, fitSuggestions } from '../../core/fit-suggestions';
import { Navigation } from '../../core/navigation';
import { PromptRouter } from '../../core/prompt-router';
import { CvSheet } from '../../shared/cv-sheet';
import { AnalyzerPanel } from './analyzer-panel';
import { BuilderStore, BuilderTab, NEW_CV, UNTITLED } from './builder-store';
import { ContentEditor } from './content-editor';
import { DesignerPanel } from './designer-panel';
import { JobMatcherPanel } from './job-matcher-panel';

/** An A4 page at real size: 595 pt at 96 px per inch. */
const REAL_WIDTH = (595 * 96) / 72;
const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];
const ZOOM_KEY = 'rezumo.builder.zoom';
/** /builder/latest opens the user's most recently edited CV. */
const LATEST_CV = 'latest';
/** 'fit' fills the preview's width; a number is a percent of the real size. */
type Zoom = 'fit' | number;

function storedZoom(): Zoom {
  try {
    const value = localStorage.getItem(ZOOM_KEY);
    const percent = Number(value);
    if (value && ZOOM_STEPS.includes(percent)) return percent;
  } catch {
    // No storage (private window): use the default.
  }
  return 'fit';
}

/**
 * /builder/:cvId — edit a CV section by section, with the design, the ATS analysis and the job
 * matcher next to a live A4 preview. Changes are saved 1 s after typing stops.
 */
@Component({
  selector: 'app-builder-page',
  imports: [AnalyzerPanel, ContentEditor, CvSheet, DesignerPanel, JobMatcherPanel],
  templateUrl: './builder-page.html',
  styleUrl: './builder-page.scss',
  providers: [BuilderStore],
})
export class BuilderPage {
  readonly store = inject(BuilderStore);
  private readonly api = inject(CvApi);
  private readonly flow = inject(CvFlow);
  private readonly navigation = inject(Navigation);
  private readonly router = inject(Router);
  private readonly prompts = inject(PromptRouter);
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  private readonly pages = viewChild<ElementRef<HTMLElement>>('pages');

  /** The CV's length in pages after the template's own tightening (1 when it fits). */
  readonly pageCount = signal(1);
  /** Suggestions the user chose to keep; nothing is ever removed without a click. */
  private readonly kept = signal<ReadonlySet<string>>(new Set());
  readonly pagesLabel = computed(() => Math.max(1.1, Math.ceil(this.pageCount() * 10) / 10).toFixed(1));
  readonly cuts = computed(() =>
    this.pageCount() > 1
      ? fitSuggestions(this.store.content(), this.store.jobDescription())
          .filter((s) => !this.kept().has(s.key))
          .slice(0, 4)
      : [],
  );

  removeCut(cut: FitSuggestion): void {
    this.store.update(cut.remove);
  }

  keepCut(cut: FitSuggestion): void {
    this.kept.update((set) => new Set(set).add(cut.key));
  }

  readonly minZoom = ZOOM_STEPS[0];
  readonly maxZoom = ZOOM_STEPS[ZOOM_STEPS.length - 1];
  readonly zoom = signal<Zoom>(storedZoom());
  /** The preview's inner width (without its padding), for Fit width. */
  private readonly fitWidth = signal(0);
  readonly sheetWidth = computed(() => {
    const zoom = this.zoom();
    return zoom === 'fit' ? this.fitWidth() || null : Math.round((REAL_WIDTH * zoom) / 100);
  });
  readonly zoomPercent = computed(() => {
    const zoom = this.zoom();
    return zoom === 'fit' ? Math.round((this.fitWidth() / REAL_WIDTH) * 100) : zoom;
  });

  readonly menuOpen = signal(false);
  readonly busy = signal<'export' | 'duplicate' | 'delete' | null>(null);
  readonly untitled = UNTITLED;
  readonly tabs: { id: BuilderTab; label: string }[] = [
    { id: 'content', label: 'Content Editor' },
    { id: 'design', label: 'Designer' },
    { id: 'analyze', label: 'Analyzer' },
    { id: 'match', label: 'Job Matcher' },
    { id: 'cover', label: 'Cover Letter' },
  ];
  readonly issueCount = computed(() => (this.store.analysis() ? this.store.openIssues().length : 0));
  readonly saveLabel = computed(() => {
    switch (this.store.saveState()) {
      case 'pending':
      case 'saving':
        return 'Saving…';
      case 'saved':
        return 'Saved ✓';
      case 'error':
        return 'Not saved';
      default:
        return '';
    }
  });

  constructor() {
    const route = inject(ActivatedRoute);
    const subscription = route.paramMap.subscribe((params) => {
      const id = params.get('cvId') ?? '';
      void (async () => {
        await this.store.save();
        // A smart-prompt request ends here, so /check won't show it later.
        if (id !== LATEST_CV) this.prompts.take();
        if (id === LATEST_CV) {
          await this.openLatest(route.snapshot.queryParamMap.get('tab'));
          return;
        }
        if (id !== NEW_CV) {
          await this.store.load(id);
          this.applyTabParam(route.snapshot.queryParamMap.get('tab'));
          return;
        }
        // /builder/new (the "+ New CV" buttons): create an empty CV, then show it at its own URL.
        const created = await this.store.create(this.flow.template());
        if (created) await this.router.navigateByUrl(`/builder/${created}`, { replaceUrl: true });
      })();
    });
    // Fit width follows the preview's size.
    effect((onCleanup) => {
      const pages = this.pages()?.nativeElement;
      if (!pages) return;
      const measure = () => {
        const style = getComputedStyle(pages);
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        this.fitWidth.set(Math.max(0, Math.floor(pages.clientWidth - padding)));
      };
      const observer = new ResizeObserver(measure);
      observer.observe(pages);
      measure();
      onCleanup(() => observer.disconnect());
    });
    effect(() => {
      const title = this.store.title().trim() || UNTITLED;
      untracked(() => (document.title = `${title} — CV Builder — Rezumo`));
    });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      void this.store.save();
    });
  }

  /** /builder/latest (the smart prompt's "fix" requests): the most recently edited CV, or /check without one. */
  private async openLatest(tab: string | null): Promise<void> {
    let latest: string | undefined;
    try {
      latest = [...(await this.api.list())].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id;
    } catch {
      latest = undefined;
    }
    // Without a CV the request goes on to /check, which shows it.
    if (latest) this.prompts.take();
    const url = latest ?`/builder/${latest}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}` : '/check';
    await this.router.navigateByUrl(url, { replaceUrl: true });
  }

  /** ?tab=analyze opens that tab once; the parameter is then dropped so a refresh starts normally. */
  private applyTabParam(tab: string | null): void {
    const match = this.tabs.find((t) => t.id === tab);
    if (!match) return;
    this.store.tab.set(match.id);
    void this.router.navigate([], { queryParams: { tab: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  @HostListener('window:beforeunload', ['$event'])
  warnUnsaved(event: BeforeUnloadEvent): void {
    const state = this.store.saveState();
    if (state === 'pending' || state === 'saving' || state === 'error') {
      void this.store.save();
      event.preventDefault();
    }
  }

  @HostListener('document:click', ['$event'])
  closeMenu(event: MouseEvent): void {
    if (!(event.target as Element).closest?.('.menu-wrap')) this.menuOpen.set(false);
  }

  setZoom(zoom: Zoom): void {
    this.zoom.set(zoom);
    try {
      localStorage.setItem(ZOOM_KEY, String(zoom));
    } catch {
      // No storage: the choice lasts until the page closes.
    }
  }

  /** One step smaller (-1) or bigger (1) than the current size, from Fit width too. */
  zoomBy(direction: 1 | -1): void {
    const current = this.zoomPercent();
    const next =
      direction > 0
        ? ZOOM_STEPS.find((step) => step > current)
        : [...ZOOM_STEPS].reverse().find((step) => step < current);
    if (next) this.setZoom(next);
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  rename(): void {
    this.menuOpen.set(false);
    const input = this.titleInput()?.nativeElement;
    input?.focus();
    input?.select();
  }

  async exportPdf(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('export');
    try {
      await this.store.exportPdf();
    } catch (error) {
      this.store.error.set((error as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  async duplicate(): Promise<void> {
    this.menuOpen.set(false);
    if (this.busy()) return;
    this.busy.set('duplicate');
    try {
      await this.store.save();
      const copy = await this.api.duplicate(this.store.id());
      await this.navigation.go(`/builder/${copy.id}`);
    } catch (error) {
      this.store.error.set(CvFlow.message(error, 'This CV couldn’t be duplicated.'));
    } finally {
      this.busy.set(null);
    }
  }

  askDelete(): void {
    this.menuOpen.set(false);
    this.deleteDialog()?.nativeElement.showModal();
  }

  closeDialog(dialog: HTMLDialogElement): void {
    dialog.close();
  }

  async remove(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('delete');
    try {
      const id = this.store.id();
      await this.api.remove(id);
      if (this.flow.savedCvId() === id) this.flow.savedCvId.set(null);
      this.store.discard();
      this.deleteDialog()?.nativeElement.close();
      await this.navigation.go('/dashboard');
    } catch (error) {
      this.store.error.set(CvFlow.message(error, 'This CV couldn’t be deleted.'));
    } finally {
      this.busy.set(null);
    }
  }
}
