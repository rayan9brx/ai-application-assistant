import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
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
  readonly mode = signal<'file' | 'paste'>('file');
  readonly file = signal<File | null>(null);
  readonly pasted = signal('');
  readonly step = signal(0);
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
