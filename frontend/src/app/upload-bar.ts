import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-upload-bar',
  templateUrl: './upload-bar.html',
  styleUrl: './upload-bar.scss',
})
export class UploadBar {
  readonly busy = input(false);
  readonly score = output<File>();
  readonly file = signal<File | null>(null);
  readonly dragging = signal(false);
  readonly error = signal('');
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
    if (!this.busy()) this.dragging.set(true);
  }

  // Ignore dragleave events fired when the pointer moves onto a child element.
  dragLeave(event: DragEvent): void {
    const card = event.currentTarget as HTMLElement;
    if (!card.contains(event.relatedTarget as Node | null)) this.dragging.set(false);
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.busy()) this.select(event.dataTransfer?.files[0]);
  }

  submit(): void {
    const file = this.file();
    if (!file || this.busy()) return;
    this.score.emit(file);
    this.file.set(null);
  }

  // Only PDFs can be extracted by the backend today; DOCX needs server-side support first.
  private select(file?: File): void {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    this.error.set(isPdf ? '' : 'Only PDF files are supported for now.');
    this.file.set(isPdf ? file : null);
  }
}
