import { Component, ElementRef, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-upload-bar',
  templateUrl: './upload-bar.html',
  styleUrl: './upload-bar.scss',
})
export class UploadBar {
  readonly file = signal<File | null>(null);
  readonly dragging = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
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

  // TODO: send the file to a CV scoring endpoint once one exists.
  submit(): void {
    if (!this.file()) return;
    this.file.set(null);
    this.notice.set("CV scoring isn't available yet, so your file wasn't uploaded.");
  }

  // Only PDFs are accepted for now; DOCX needs server-side support first.
  private select(file?: File): void {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    this.notice.set('');
    this.error.set(isPdf ? '' : 'Only PDF files are supported for now.');
    this.file.set(isPdf ? file : null);
  }
}
