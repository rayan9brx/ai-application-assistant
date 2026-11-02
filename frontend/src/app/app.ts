import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface DemoPreview {
  demo: true;
  notice: string;
  cvDraft: string;
  motivationLetterDraft?: string;
  demoActions: string[];
}
type SourceField = 'cvText' | 'jobText' | 'jobTitle' | 'company' | 'language' | 'includeLetter' | 'motivation';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);
  readonly backendStatus = signal('Checking backend...');
  readonly isLoading = signal(false);
  readonly isExtracting = signal(false);
  readonly uploadError = signal('');
  readonly uploadMessage = signal('');
  readonly analysisError = signal('');
  readonly preview = signal<DemoPreview | null>(null);
  readonly copyStatus = signal({ cvDraft: '', motivationLetterDraft: '' });
  cvText = '';
  jobText = '';
  jobTitle = '';
  company = '';
  language = 'English';
  includeLetter = false;
  motivation = '';
  private original: DemoPreview | null = null;

  // Check the existing health endpoint when the page opens.
  constructor() {
    this.http.get<{ status: string }>('http://localhost:8080/api/health').subscribe({
      next: response => this.backendStatus.set(response.status === 'ok' ? 'Backend connected' : 'Unexpected backend response'),
      error: () => this.backendStatus.set('Cannot connect to backend'),
    });
  }

  // Share source validation between submit availability and error feedback.
  validationMessage(): string {
    if (![this.cvText, this.jobText, this.jobTitle, this.company].every(value => value.trim())) {
      return 'Enter a CV, job description, job title, and company name.';
    }
    if (this.cvText.length > 30000 || this.jobText.length > 30000) return 'Keep the CV and job description within 30,000 characters each.';
    if (this.jobTitle.length > 150 || this.company.length > 150) return 'Keep the job title and company within 150 characters each.';
    if (!['English', 'German'].includes(this.language)) return 'Choose English or German.';
    if (this.motivation.length > 3000) return 'Keep motivation within 3,000 characters.';
    if (this.includeLetter && !this.motivation.trim()) return 'Enter your motivation to include a letter.';
    return '';
  }

  // Enable submission only when every source field is valid.
  canContinue(): boolean {
    return !this.isExtracting() && !this.validationMessage();
  }

  // Confirm before changing sources that would discard edited documents.
  updateSource<K extends SourceField>(field: K, value: App[K], model?: NgModel): void {
    if (this.isLoading() || this.isExtracting() || this[field] === value) return;
    if (this.hasPreviewEdits() && !window.confirm('Changing application details will discard your unsaved preview edits. Continue?')) {
      model?.control.setValue(this[field], { emitEvent: false, emitViewToModelChange: false });
      return;
    }
    (this as App)[field] = value;
    if (field === 'cvText') {
      this.uploadError.set('');
      this.uploadMessage.set('');
    }
    this.preview.set(null);
    this.original = null;
    this.analysisError.set('');
    this.copyStatus.set({ cvDraft: '', motivationLetterDraft: '' });
  }

  // Extract a PDF without changing the current CV or drafts until a valid response arrives.
  uploadCv(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.isLoading() || this.isExtracting()) return;
    this.uploadError.set('');
    this.uploadMessage.set('');
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('Choose a PDF of 5 MB or smaller.');
      return;
    }
    if (!file.size) {
      this.uploadError.set('This file is empty. Choose a readable PDF or paste your CV text.');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    this.isExtracting.set(true);
    this.http.post<{ text: string }>('http://localhost:8080/api/cv/extract', data).subscribe({
      next: response => {
        this.isExtracting.set(false);
        if (typeof response.text !== 'string' || !response.text.trim() || response.text.length > 30000) {
          this.uploadError.set('The extracted text could not be used. Please paste your CV text.');
          return;
        }
        if (this.cvText && !window.confirm('Replace your current CV text with text extracted from this PDF?')) return;
        this.updateSource('cvText', response.text);
        if (this.cvText !== response.text) return;
        this.uploadMessage.set('PDF text extracted. Review and edit your CV below. No AI tailoring was performed.');
      },
      error: error => {
        this.isExtracting.set(false);
        this.uploadError.set(error.status === 413
          ? 'Choose a PDF of 5 MB or smaller.'
          : (typeof error.error?.message === 'string' ? error.error.message : 'PDF extraction failed. Check the backend connection, try another PDF, or paste your CV text.'));
      },
    });
  }

  // Compare editor contents with the last received demo response.
  hasPreviewEdits(): boolean {
    const current = this.preview();
    return !!current && !!this.original && (current.cvDraft !== this.original.cvDraft || current.motivationLetterDraft !== this.original.motivationLetterDraft);
  }

  // Send every form field once and display the returned editable demo.
  analyze(): void {
    if (this.isLoading() || this.isExtracting()) return;
    this.analysisError.set(this.validationMessage());
    if (this.analysisError()) return;
    if (this.hasPreviewEdits() && !window.confirm('Creating another preview will discard your unsaved edits. Continue?')) return;
    this.preview.set(null);
    this.original = null;
    this.copyStatus.set({ cvDraft: '', motivationLetterDraft: '' });
    this.isLoading.set(true);
    this.http.post<DemoPreview>('http://localhost:8080/api/analyze', {
      cvText: this.cvText, jobText: this.jobText, jobTitle: this.jobTitle,
      company: this.company, language: this.language, includeLetter: this.includeLetter,
      motivation: this.motivation,
    }).subscribe({
      next: response => {
        this.original = { ...response };
        this.preview.set({ ...response });
        this.isLoading.set(false);
      },
      error: error => {
        this.analysisError.set(error.status === 400 ? 'The backend rejected the input. Check required fields, lengths, and language.' : 'Request failed. Check that the backend is running and try again.');
        this.isLoading.set(false);
      },
    });
  }

  // Update a document as plain text and clear outdated copy feedback.
  editDraft(field: 'cvDraft' | 'motivationLetterDraft', value: string): void {
    this.preview.update(current => current ? { ...current, [field]: value } : null);
    this.copyStatus.update(current => ({ ...current, [field]: '' }));
  }

  // Report clipboard success or provide a manual-copy fallback.
  async copyDraft(field: 'cvDraft' | 'motivationLetterDraft'): Promise<void> {
    const value = this.preview()?.[field];
    if (value === undefined) return;
    try {
      await navigator.clipboard.writeText(value);
      this.copyStatus.update(current => ({ ...current, [field]: 'Copied to clipboard.' }));
    } catch {
      this.copyStatus.update(current => ({ ...current, [field]: 'Copy failed. Select the document text and copy it manually.' }));
    }
  }
}
