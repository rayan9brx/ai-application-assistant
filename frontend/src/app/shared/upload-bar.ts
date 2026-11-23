import { Component, ElementRef, input, model, output, signal, viewChild } from '@angular/core';
import { MAX_FILE_BYTES } from '../core/cv-flow';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Click or drop a PDF/DOCX CV. Emits `selected` on every pick or removal, and `submitted` when
 * "Score my CV" is pressed with a valid file. Pressing it without a file opens the file picker.
 */
@Component({
  selector: 'app-upload-bar',
  templateUrl: './upload-bar.html',
  styleUrl: './upload-bar.scss',
})
export class UploadBar {
  /** Hide the built-in "Score my CV" button when the page has its own. */
  readonly showSubmit = input(true);
  /** Shows "Scoring…" on the button and ignores further presses. */
  readonly busy = input(false);
  readonly file = model<File | null>(null);
  readonly selected = output<File | null>();
  readonly submitted = output<File>();
  /** When false, "Score my CV" without a file emits `emptySubmit` instead of opening the picker. */
  readonly browseWhenEmpty = input(true);
  readonly emptySubmit = output<void>();

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

  remove(): void {
    this.error.set('');
    this.file.set(null);
    this.selected.emit(null);
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
    if (this.busy()) return;
    const file = this.file();
    if (file) this.submitted.emit(file);
    else if (this.browseWhenEmpty()) this.browse();
    else this.emptySubmit.emit();
  }

  private select(file?: File): void {
    if (!file) return;
    const supported =
      file.type === 'application/pdf' || file.type === DOCX || /\.(pdf|docx)$/i.test(file.name);
    const error = !supported
      ? `“${file.name}” isn’t a PDF or Word (.docx) file. Choose a PDF or Word (.docx) file.`
      : file.size > MAX_FILE_BYTES
        ? `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. Your file must be 5 MB or smaller.`
        : '';
    this.error.set(error);
    this.file.set(error ? null : file);
    this.selected.emit(this.file());
  }
}
