import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MAX_FILE_BYTES } from '../core/cv-flow';
import { PromptRouter } from '../core/prompt-router';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The first one is the main use: it shows first and every other turn. */
const EXAMPLES = [
  'Paste a job ad or link…',
  'Check if my CV passes ATS…',
  'Paste a job ad or link…',
  'Make my bullet points stronger…',
];

const CHIPS = [
  { label: 'Tailor to a job', text: 'Tailor my CV to this job ad: ' },
  { label: 'Score my CV', text: 'Score my CV and check if it passes ATS' },
  { label: 'Fix weak points', text: 'Fix the weak points in my CV' },
  { label: 'Build a new CV', text: 'Build a new CV' },
];

/**
 * "What do you want to do?" box: a request in plain words (and optionally a CV file) is routed
 * by keywords to the checker, the job tailoring, the builder's analyzer or a new CV.
 */
@Component({
  selector: 'app-smart-prompt',
  templateUrl: './smart-prompt.html',
  styleUrl: './smart-prompt.scss',
})
export class SmartPrompt {
  private readonly router = inject(PromptRouter);
  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  readonly chips = CHIPS;
  readonly accept = `.pdf,.docx,application/pdf,${DOCX}`;
  readonly text = signal('');
  readonly file = signal<File | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly dragging = signal(false);
  readonly example = signal(0);

  constructor() {
    const reduced = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setInterval(() => this.example.update((i) => (i + 1) % EXAMPLES.length), reduced ? 6000 : 3200);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly examples = EXAMPLES;

  input(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  /** Enter sends; Shift+Enter adds a line. */
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.go();
    }
  }

  useChip(text: string): void {
    this.text.set(text);
    const box = this.box().nativeElement;
    box.value = text;
    box.focus();
    box.setSelectionRange(text.length, text.length);
  }

  browse(): void {
    this.picker().nativeElement.click();
  }

  pick(input: HTMLInputElement): void {
    this.select(input.files?.[0]);
    input.value = '';
  }

  removeFile(): void {
    this.file.set(null);
    this.error.set('');
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
    this.select(event.dataTransfer?.files[0]);
  }

  async go(): Promise<void> {
    if (this.busy()) return;
    if (!this.text().trim() && !this.file()) {
      this.box().nativeElement.focus();
      return;
    }
    this.busy.set(true);
    try {
      await this.router.submit(this.text(), this.file());
    } finally {
      this.busy.set(false);
    }
  }

  private select(file?: File): void {
    if (!file) return;
    const supported =
      file.type === 'application/pdf' || file.type === DOCX || /\.(pdf|docx)$/i.test(file.name);
    const error = !supported
      ? `“${file.name}” isn’t a PDF or Word (.docx) file.`
      : file.size > MAX_FILE_BYTES
        ? `“${file.name}” is larger than 5 MB.`
        : '';
    this.error.set(error);
    this.file.set(error ? null : file);
  }
}
