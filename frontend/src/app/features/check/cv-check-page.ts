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
import { CvFlow } from '../../core/cv-flow';
import { CvLibrary } from '../../core/cv-library';
import { CvSheet } from '../../shared/cv-sheet';
import { CvTemplateId, TEMPLATES_HREF, exampleBySlug, isTemplateId, templateById } from '../../core/cv-templates';
import { TemplatePicker } from '../../shared/template-picker';
import { IssueCard } from './issue-card';
import { ScoreReport } from './score-report';
import { TailorPanel } from './tailor-panel';
import { UploadBar } from '../../shared/upload-bar';

const SCORING_STEPS = [
  'Checking ATS compatibility…',
  'Comparing with the job description…',
  'Looking for quick wins…',
  'Writing your suggestions…',
];

/** /check: Upload → Score → Fix → Download. */
@Component({
  selector: 'app-cv-check-page',
  imports: [CvSheet, IssueCard, ScoreReport, TailorPanel, TemplatePicker, UploadBar],
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
  private readonly uploadBar = viewChild<UploadBar>('uploadBar');
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
            const field = this.jobBox()?.nativeElement ?? document.getElementById('results-job');
            field?.focus();
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
    // A file from the landing page's upload bar: score it right away.
    const handedOff = this.flow.takeHandOff();
    if (handedOff) {
      this.mode.set('file');
      this.file.set(handedOff);
      this.score();
    }
  }

  /** "Try again" after a failure: re-run with the same file or text. */
  retry(): void {
    this.score();
  }

  /** "Score my CV": scores when ready, otherwise opens the file picker (or focuses the text box). */
  scoreOrBrowse(): void {
    if (this.canScore()) this.score();
    else if (this.mode() === 'file') this.uploadBar()?.browse();
    else this.pasteBox()?.nativeElement.focus();
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
    this.flow.reset();
    scrollTo({ top: 0 });
  }

  value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }
}
