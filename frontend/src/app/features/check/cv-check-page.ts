import {
  Component,
  DestroyRef,
  ElementRef,
  input,
  untracked,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { CvApi, CvSummary } from '../../core/cv-api';
import { CvFlow, MAX_FILE_BYTES } from '../../core/cv-flow';
import { CvLibrary } from '../../core/cv-library';
import { PromptIntent, PromptRoute, PromptRouter, looksLikeJobAd } from '../../core/prompt-router';
import { ScoreRing } from '../../shared/score-ring';
import { CvSheet } from '../../shared/cv-sheet';
import { CvTemplateId, TEMPLATES_HREF, exampleBySlug, isTemplateId, templateById } from '../../core/cv-templates';
import { TemplatePicker } from '../../shared/template-picker';
import { IssueCard } from './issue-card';
import { ScoreReport } from './score-report';
import { TailorPanel } from './tailor-panel';

const SCORING_STEPS = [
  'Checking ATS compatibility…',
  'Comparing with the job description…',
  'Looking for quick wins…',
  'Writing your suggestions…',
];

/** /check: Upload → Score → Fix → Download. */
@Component({
  selector: 'app-cv-check-page',
  imports: [CvSheet, IssueCard, ScoreReport, TailorPanel, TemplatePicker, ScoreRing],
  templateUrl: './cv-check-page.html',
  styleUrl: './cv-check-page.scss',
})
export class CvCheckPage {
  readonly flow = inject(CvFlow);
  readonly library = inject(CvLibrary);
  /**
   * ?focus=job (Tailor to Job) puts the cursor in the job description field; ?focus=fixes
   * (AI Fixes) scrolls to the report's issues. Re-runs when only the query changes.
   */
  readonly focus = input<string>();
  /** ?template=modern (from /templates/:name) picks that template. */
  readonly template = input<string>();
  /** ?example=data-analyst (from /examples) opens that example CV as a starting point. */
  readonly example = input<string>();
  readonly templateName = computed(() => templateById(this.flow.template())?.name ?? '');
  readonly templatesHref = TEMPLATES_HREF;
  private readonly router = inject(Router);
  readonly openingBuilder = signal(false);

  /** Saves the checked CV and opens it in the CV Builder, which builds the sections from its text. */
  async openBuilder(): Promise<void> {
    if (this.openingBuilder()) return;
    this.openingBuilder.set(true);
    try {
      const saved = this.flow.stale() || !this.flow.savedCvId() ? await this.library.save() : true;
      const id = this.flow.savedCvId();
      if (saved && id) await this.router.navigateByUrl(`/builder/${id}`);
    } finally {
      this.openingBuilder.set(false);
    }
  }
  readonly mode = signal<'file' | 'paste'>('file');
  readonly file = signal<File | null>(null);
  readonly pasted = signal('');
  readonly step = signal(0);
  readonly dragging = signal(false);
  readonly uploadError = signal('');
  /** The job description section; open when there already is one. */
  readonly jobOpen = signal(!!this.flow.jobDescription().trim());
  /** The three most recently updated saved CVs, for one-click scoring. */
  readonly savedCvs = signal<CvSummary[]>([]);
  readonly loadingSaved = signal<string | null>(null);
  /** What they typed in the smart prompt box, when it was routed here. */
  readonly promptHint = signal<{ text: string; route: PromptRoute } | null>(null);
  private readonly api = inject(CvApi);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly pasteBox = viewChild<ElementRef<HTMLTextAreaElement>>('pasteBox');
  private readonly jobBox = viewChild<ElementRef<HTMLTextAreaElement>>('jobBox');
  readonly canScore = computed(() =>
    this.mode() === 'file' ? !!this.file() : this.pasted().trim().length >= 50,
  );
  readonly progress = computed(() => {
    if (this.flow.phase() === 'reading') return 'Reading your CV…';
    const steps = this.flow.jobDescription().trim()
      ? SCORING_STEPS
      : SCORING_STEPS.filter((_, i) => i !== 1);
    return steps[this.step() % steps.length];
  });

  constructor() {
    // Rotate the progress message while the AI works.
    const timer = setInterval(() => {
      if (this.flow.phase() === 'scoring') this.step.update((s) => s + 1);
    }, 3500);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    effect(() => {
      if (this.flow.phase() !== 'scoring') this.step.set(0);
    });
    effect(() => {
      const focus = this.focus();
      untracked(() => {
        // After render and the navigation's scroll-to-top, so the target is scrolled into view.
        setTimeout(() => {
          if (focus === 'job') {
            if (this.flow.phase() === 'input') this.openJob();
            else document.getElementById('results-job')?.focus();
          } else if (focus === 'fixes') {
            document.getElementById('issues-title')?.scrollIntoView({ block: 'start' });
          }
        });
      });
    });
    effect(() => {
      const template = this.template();
      const example = exampleBySlug(this.example());
      if (!template && !this.example()) return;
      untracked(() => {
        if (example) {
          // Replaces what was in the checker; the CV is saved once it is scored.
          this.flow.reset();
          this.file.set(null);
          this.mode.set('paste');
          this.pasted.set(example.text);
          void this.library.setTemplate(example.template);
        } else if (isTemplateId(template)) {
          void this.library.setTemplate(template);
        }
        // Drop the parameters so a refresh doesn't apply them again.
        void this.router.navigate([], {
          queryParams: { template: null, example: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
    // A file from the dashboard's upload card: score it right away.
    const handedOff = this.flow.takeHandOff();
    if (handedOff) {
      this.mode.set('file');
      this.file.set(handedOff);
      this.score();
    }
    this.applyPrompt(inject(PromptRouter).take());
    this.api
      .list()
      .then((cvs) =>
        this.savedCvs.set(
          [...cvs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
        ),
      )
      .catch(() => {
        /* The saved CV shortcuts are optional. */
      });
  }

  /**
   * A request from the smart prompt box: an attached file is scored (or, when tailoring, waits
   * next to the job description); a pasted job ad fills the job description; anything else is
   * shown above the upload as a reminder of what they asked.
   */
  private applyPrompt(intent: PromptIntent | null): void {
    if (!intent) return;
    const jobAd = intent.route === 'tailor' && looksLikeJobAd(intent.text);
    if (intent.file) {
      this.flow.reset();
      this.mode.set('file');
      this.file.set(intent.file);
    }
    if (intent.route === 'tailor') {
      if (jobAd) this.flow.jobDescription.set(intent.text);
      this.jobOpen.set(true);
    }
    if (intent.text && !jobAd) this.promptHint.set({ text: intent.text, route: intent.route });
    if (intent.file && intent.route !== 'tailor') this.score();
  }

  /** The line under the prompt hint, for what they asked. */
  hintAdvice(route: PromptRoute): string {
    switch (route) {
      case 'tailor':
        return 'Paste the job ad below, add your CV and we’ll show how well they match.';
      case 'fix':
        return 'You don’t have a saved CV yet. Upload one and we’ll show you what to fix.';
      case 'score':
        return 'Upload your CV to get your ATS score.';
      default:
        return 'Start with your score: upload your CV and we’ll show you exactly what to improve.';
    }
  }

  browse(): void {
    this.fileInput()?.nativeElement.click();
  }

  picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.select(file);
  }

  dragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  dragLeave(event: DragEvent): void {
    const zone = event.currentTarget as HTMLElement;
    if (!zone.contains(event.relatedTarget as Node | null)) this.dragging.set(false);
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.select(file);
  }

  private select(file: File): void {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      this.uploadError.set(`“${file.name}” isn’t a PDF or Word (.docx) file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.uploadError.set(`“${file.name}” is larger than 5 MB.`);
      return;
    }
    this.uploadError.set('');
    this.flow.error.set('');
    this.file.set(file);
  }

  removeFile(): void {
    this.file.set(null);
    this.flow.error.set('');
  }

  usePaste(): void {
    this.mode.set('paste');
    this.uploadError.set('');
    setTimeout(() => this.pasteBox()?.nativeElement.focus(), 50);
  }

  openJob(): void {
    this.jobOpen.set(true);
    // Once the section is rendered without `inert`, so the field can take focus.
    setTimeout(() => this.jobBox()?.nativeElement.focus({ preventScroll: false }), 50);
  }

  closeJob(): void {
    this.jobOpen.set(false);
    this.flow.jobDescription.set('');
  }

  size(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Opens a saved CV in the checker and scores it, keeping any job description typed here. */
  async scoreSaved(cv: CvSummary): Promise<void> {
    if (this.loadingSaved()) return;
    this.loadingSaved.set(cv.id);
    const job = this.flow.jobDescription();
    try {
      const saved = await this.api.get(cv.id);
      this.file.set(null);
      this.flow.loadSaved(cv.id, saved.content.text, job, null, null, saved.template);
      await this.flow.startWithText(saved.content.text);
    } catch (error) {
      this.flow.error.set(CvFlow.message(error, 'We couldn’t open this CV. Please try again.'));
    } finally {
      this.loadingSaved.set(null);
    }
  }

  /** "Try again" after a failure: re-run with the same file or text. */
  retry(): void {
    this.score();
  }

  score(): void {
    if (!this.canScore()) return;
    const file = this.file();
    if (this.mode() === 'file' && file) void this.flow.startWithFile(file);
    else void this.flow.startWithText(this.pasted());
  }

  selectTemplate(template: CvTemplateId): void {
    void this.library.setTemplate(template);
  }

  startOver(): void {
    this.file.set(null);
    this.pasted.set('');
    this.jobOpen.set(false);
    this.flow.reset();
    scrollTo({ top: 0 });
  }

  value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }
}
