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
import { Navigation } from '../../core/navigation';
import { CvSheet } from '../../shared/cv-sheet';
import { AnalyzerPanel } from './analyzer-panel';
import { BuilderStore, BuilderTab, NEW_CV, UNTITLED } from './builder-store';
import { ContentEditor } from './content-editor';
import { DesignerPanel } from './designer-panel';
import { JobMatcherPanel } from './job-matcher-panel';

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
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');

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
        if (id !== NEW_CV) {
          await this.store.load(id);
          return;
        }
        // /builder/new (the "+ New CV" buttons): create an empty CV, then show it at its own URL.
        const created = await this.store.create(this.flow.template());
        if (created) await this.router.navigateByUrl(`/builder/${created}`, { replaceUrl: true });
      })();
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
