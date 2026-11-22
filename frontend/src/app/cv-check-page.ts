import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  input,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CvFlow } from './cv-flow';
import { CvLibrary } from './cv-library';
import { IssueCard } from './issue-card';
import { ScoreReport } from './score-report';
import { TailorPanel } from './tailor-panel';
import { UploadBar } from './upload-bar';

const SCORING_STEPS = [
  'Checking ATS compatibility…',
  'Comparing with the job description…',
  'Looking for quick wins…',
  'Writing your suggestions…',
];

/** /check: Upload → Score → Fix → Download. */
@Component({
  selector: 'app-cv-check-page',
  imports: [IssueCard, ScoreReport, TailorPanel, UploadBar],
  templateUrl: './cv-check-page.html',
  styleUrl: './cv-check-page.scss',
})
export class CvCheckPage {
  readonly flow = inject(CvFlow);
  readonly library = inject(CvLibrary);
  /** ?focus=job (from onboarding's "tailor to a job" answer) puts the cursor in the job field. */
  readonly focus = input<string>();
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
    afterNextRender(() => {
      // After the navigation's scroll-to-top, so the field is scrolled into view.
      if (this.focus() === 'job') setTimeout(() => this.jobBox()?.nativeElement.focus());
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
