import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { MAX_FILE_BYTES } from './cv-flow';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Click or drop a PDF/DOCX CV. Emits `selected` on every valid pick and `submitted` on its button,
 * or right after a valid pick when `autoSubmit` is set.
 */
@Component({
  selector: 'app-upload-bar',
  templateUrl: './upload-bar.html',
  styleUrl: './upload-bar.scss',
})
export class UploadBar {
  /** Hide the built-in "Score my CV" button when the page has its own. */
  readonly showSubmit = input(true);
  readonly busy = input(false);
  /** Submit as soon as a valid file is picked or dropped (the button stays as a fallback). */
  readonly autoSubmit = input(false);
  readonly selected = output<File | null>();
  readonly submitted = output<File>();

  readonly file = signal<File | null>(null);
  readonly dragging = signal(false);
  readonly error = signal('');
  readonly accept = `.pdf,.docx,application/pdf,${DOCX}`;
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  browse(): void {
    this.picker().nativeElement.click();
  }

  pick(input: HTMLInputElement): void {
    this.select(input.files?.[0]);
    input.value = '';
  }

  dragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  // Ignore dragleave events fired when the pointer moves onto a child element.
  dragLeave(event: DragEvent): void {
    const card = event.currentTarget as HTMLElement;
    if (!card.contains(event.relatedTarget as Node | null)) this.dragging.set(false);
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.select(event.dataTransfer?.files[0]);
  }

  submit(): void {
    const file = this.file();
    if (file && !this.busy()) this.submitted.emit(file);
  }

  private select(file?: File): void {
    if (!file) return;
    const supported =
      file.type === 'application/pdf' || file.type === DOCX || /\.(pdf|docx)$/i.test(file.name);
    const error = !supported
      ? 'Choose a PDF or Word (.docx) file.'
      : file.size > MAX_FILE_BYTES
        ? 'Your file must be 5 MB or smaller.'
        : '';
    this.error.set(error);
    this.file.set(error ? null : file);
    this.selected.emit(this.file());
    if (!error && this.autoSubmit()) this.submit();
  }
}
