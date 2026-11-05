import { Component, HostListener, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Auth } from './auth';
import { About } from './about';
import { Hero } from './hero';
import { ApplicationInput, ApplicationPage, ApplicationSummary, SavedApplication } from './applications';

interface DemoPreview {
  demo: true;
  notice: string;
  cvDraft: string;
  motivationLetterDraft?: string;
  demoActions: string[];
}
type DraftField = 'cvDraft' | 'motivationLetterDraft';
type SourceField = 'cvText' | 'jobText' | 'jobTitle' | 'company' | 'language' | 'includeLetter' | 'motivation';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, DatePipe, About, Hero],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);
  readonly auth = inject(Auth);
  readonly backendStatus = signal('Checking backend...');
  readonly activeSection = signal<'workspace' | 'applications' | 'about'>('workspace');
  readonly isLoading = signal(false);
  readonly isExtracting = signal(false);
  readonly uploadError = signal('');
  readonly uploadMessage = signal('');
  readonly analysisError = signal('');
  readonly preview = signal<DemoPreview | null>(null);
  readonly exporting = signal<DraftField | null>(null);
  readonly exportError = signal({ cvDraft: '', motivationLetterDraft: '' });
  readonly exportStatus = signal({ cvDraft: '', motivationLetterDraft: '' });
  readonly copyStatus = signal({ cvDraft: '', motivationLetterDraft: '' });
  cvText = '';
  jobText = '';
  jobTitle = '';
  company = '';
  language = 'English';
  includeLetter = false;
  motivation = '';
  private original: DemoPreview | null = null;
  readonly applicationList = signal<ApplicationPage | null>(null);
  readonly applicationsOpen = signal(false);
  readonly listLoading = signal(false);
  readonly storageBusy = signal(false);
  readonly storageMessage = signal('');
  readonly storageError = signal('');
  readonly activeApplication = signal<SavedApplication | null>(null);
  private savedSnapshot = '';
  private workOwner: string | null = null;
  private seenLogout = 0;
  private listRequest = 0;

  // Check the existing health endpoint when the page opens.
  constructor() {
    this.syncNavigation();
    effect(() => {
      const user = this.auth.user()?.email ?? null;
      const logout = this.auth.logoutCount();
      untracked(() => {
        if (logout !== this.seenLogout || (user && this.workOwner && user !== this.workOwner)) this.clearPrivateWork();
        this.seenLogout = logout;
        if (user) this.workOwner = user;
        if (!user) { this.applicationList.set(null); this.applicationsOpen.set(false); this.listLoading.set(false); this.storageBusy.set(false); this.listRequest++; }
      });
    });
    void this.auth.initialize();
    this.http.get<{ status: string }>('/api/health').subscribe({
      next: response => this.backendStatus.set(response.status === 'ok' ? 'Backend connected' : 'Unexpected backend response'),
      error: () => this.backendStatus.set('Cannot connect to backend'),
    });
  }

  // Reflect in-page navigation without replacing the editor or its unsaved state.
  @HostListener('window:hashchange')
  syncNavigation(): void {
    this.activeSection.set(window.location.hash === '#about' ? 'about'
      : window.location.hash === '#saved-applications' ? 'applications' : 'workspace');
  }

  // Capture exactly the current source fields and latest document editor values.
  private applicationInput(): ApplicationInput {
    return { jobTitle: this.jobTitle, company: this.company, language: this.language,
      sourceCv: this.cvText, jobDescription: this.jobText, includeLetter: this.includeLetter,
      motivation: this.motivation, editedCv: this.preview()?.cvDraft ?? '',
      editedLetter: this.preview()?.motivationLetterDraft ?? null, demo: true };
  }

  // Compare content rather than timestamps so edits during a save remain unsaved.
  hasUnsavedChanges(): boolean {
    const input = this.applicationInput();
    return this.savedSnapshot ? JSON.stringify(input) !== this.savedSnapshot
      : !!(this.cvText || this.jobText || this.jobTitle || this.company || this.motivation || this.preview());
  }

  // Warn when leaving a page containing work that has not reached the server.
  @HostListener('window:beforeunload', ['$event'])
  warnBeforeLeaving(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; }
  }

  // Save a snapshot without replacing ongoing edits when the response arrives.
  saveApplication(): void {
    if (this.storageBusy() || this.isLoading() || this.isExtracting() || this.exporting()) return;
    if (!this.auth.user()) { this.auth.requireLogin(); return; }
    this.storageError.set(this.validationMessage());
    if (this.storageError()) return;
    const input = this.applicationInput();
    if (input.editedCv.length > 60000 || (input.editedLetter?.length ?? 0) > 60000) {
      this.storageError.set('Keep each edited document within 60,000 characters.'); return;
    }
    const active = this.activeApplication();
    const email = this.auth.user()!.email;
    const logout = this.auth.logoutCount();
    this.workOwner = email;
    this.storageBusy.set(true);
    this.storageMessage.set('Saving…');
    const request = active
      ? this.http.put<SavedApplication>(`/api/applications/${active.id}`, { ...input, version: active.version })
      : this.http.post<SavedApplication>('/api/applications', input);
    request.subscribe({
      next: saved => {
        if (!this.sameSession(email, logout)) return;
        this.activeApplication.set(saved);
        this.savedSnapshot = JSON.stringify(input);
        this.storageBusy.set(false);
        this.storageMessage.set('Application saved.');
        if (this.applicationsOpen()) this.listApplications(this.applicationList()?.page ?? 0);
      },
      error: error => { if (this.sameSession(email, logout)) this.storageFailure(error); },
    });
  }

  // Fetch only one metadata page and discard responses from an older session.
  listApplications(page = 0): void {
    if (!this.auth.user()) { this.auth.requireLogin(); return; }
    const email = this.auth.user()!.email;
    const logout = this.auth.logoutCount();
    const request = ++this.listRequest;
    this.applicationsOpen.set(true);
    this.listLoading.set(true);
    this.storageError.set('');
    this.http.get<ApplicationPage>(`/api/applications?page=${page}&size=10`).subscribe({
      next: result => {
        if (request === this.listRequest && this.sameSession(email, logout)) { this.applicationList.set(result); this.listLoading.set(false); }
      },
      error: error => { if (request === this.listRequest && this.sameSession(email, logout)) { this.listLoading.set(false); this.storageFailure(error, false); } },
    });
  }

  // Confirm replacement after fetching, preserving edits if loading fails or is cancelled.
  openApplication(item: ApplicationSummary): void {
    if (this.storageBusy() || this.isLoading() || this.isExtracting() || this.exporting() || !this.auth.user()) return;
    const email = this.auth.user()!.email;
    const logout = this.auth.logoutCount();
    this.storageBusy.set(true);
    this.storageError.set('');
    this.http.get<SavedApplication>(`/api/applications/${item.id}`).subscribe({
      next: saved => {
        if (!this.sameSession(email, logout)) return;
        this.storageBusy.set(false);
        if (this.hasUnsavedChanges() && !window.confirm('Replace your unsaved work with this saved application?')) return;
        this.clearPrivateWork();
        this.workOwner = email;
        Object.assign(this, { jobTitle: saved.jobTitle, company: saved.company, language: saved.language,
          cvText: saved.sourceCv, jobText: saved.jobDescription, includeLetter: saved.includeLetter, motivation: saved.motivation });
        const preview: DemoPreview = { demo: true, notice: 'Saved demo documents — no AI tailoring performed.',
          cvDraft: saved.editedCv, ...(saved.editedLetter !== null ? { motivationLetterDraft: saved.editedLetter } : {}), demoActions: [] };
        this.preview.set(preview); this.original = { ...preview };
        this.activeApplication.set(saved);
        this.savedSnapshot = JSON.stringify(this.applicationInput());
        this.storageMessage.set('Saved application opened.');
      },
      error: error => { if (this.sameSession(email, logout)) this.storageFailure(error); },
    });
  }

  // Confirm deletion and retain any open editor contents as a new unsaved draft.
  deleteApplication(item: ApplicationSummary): void {
    if (this.storageBusy() || !this.auth.user() || !window.confirm(`Delete the saved application for ${item.jobTitle} at ${item.company}?`)) return;
    const email = this.auth.user()!.email;
    const logout = this.auth.logoutCount();
    this.storageBusy.set(true);
    this.storageError.set('');
    this.http.delete(`/api/applications/${item.id}?version=${item.version}`).subscribe({
      next: () => {
        if (!this.sameSession(email, logout)) return;
        if (this.activeApplication()?.id === item.id) { this.activeApplication.set(null); this.savedSnapshot = ''; }
        this.storageBusy.set(false);
        this.storageMessage.set('Saved application deleted.');
        const page = this.applicationList();
        this.listApplications(page && page.items.length === 1 ? Math.max(0, page.page - 1) : page?.page ?? 0);
      },
      error: error => { if (this.sameSession(email, logout)) this.storageFailure(error); },
    });
  }

  // Start a separate application only after the user accepts losing unsaved work.
  newApplication(): void {
    if (this.storageBusy() || this.isLoading() || this.isExtracting() || this.exporting()) return;
    if (this.hasUnsavedChanges() && !window.confirm('Discard unsaved work and start a new application?')) return;
    this.clearPrivateWork();
  }

  // Ignore delayed responses from a signed-out or replaced account.
  private sameSession(email: string, logout: number): boolean {
    return this.auth.user()?.email === email && this.auth.logoutCount() === logout;
  }

  // Report fixed errors and keep the full editor state available for retry or copying.
  private storageFailure(error: HttpErrorResponse, finishOperation = true): void {
    if (finishOperation) this.storageBusy.set(false);
    this.storageMessage.set('');
    this.storageError.set(error.status === 409 ? 'This application changed elsewhere. Your edits are preserved. Copy them before reopening the latest saved version.'
      : error.status === 401 ? 'Session expired. Sign in to retry; your current work is preserved.'
      : error.status === 404 ? 'This application is no longer available. Your current work is preserved.'
      : error.status === 400 ? 'Check required fields and character limits. Your current work is preserved.'
      : 'Application request failed. Your current work is preserved. Please retry.');
    this.updateBackendStatus(error);
  }

  // Remove private content and all document feedback after logout or explicit replacement.
  private clearPrivateWork(): void {
    this.cvText = ''; this.jobText = ''; this.jobTitle = ''; this.company = ''; this.motivation = '';
    this.language = 'English'; this.includeLetter = false;
    this.preview.set(null); this.original = null;
    this.activeApplication.set(null); this.savedSnapshot = ''; this.workOwner = null;
    this.applicationList.set(null); this.applicationsOpen.set(false); this.listLoading.set(false); this.listRequest++;
    this.storageBusy.set(false); this.storageMessage.set(''); this.storageError.set('');
    this.uploadError.set(''); this.uploadMessage.set(''); this.analysisError.set('');
    this.copyStatus.set({ cvDraft: '', motivationLetterDraft: '' });
    this.exportError.set({ cvDraft: '', motivationLetterDraft: '' });
    this.exportStatus.set({ cvDraft: '', motivationLetterDraft: '' });
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
    return !this.storageBusy() && !this.isExtracting() && !this.exporting() && !this.validationMessage();
  }

  // Confirm before changing sources that would discard edited documents.
  updateSource<K extends SourceField>(field: K, value: App[K], model?: NgModel): void {
    if (this.isLoading() || this.isExtracting() || this.exporting() || this[field] === value) return;
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
    this.exportError.set({ cvDraft: '', motivationLetterDraft: '' });
    this.exportStatus.set({ cvDraft: '', motivationLetterDraft: '' });
  }

  // Extract a PDF without changing the current CV or drafts until a valid response arrives.
  uploadCv(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.storageBusy() || this.isLoading() || this.isExtracting() || this.exporting()) return;
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
    this.http.post<{ text: string }>('/api/cv/extract', data).subscribe({
      next: response => {
        this.backendStatus.set('Backend connected');
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
        this.updateBackendStatus(error);
        this.isExtracting.set(false);
        this.uploadError.set(error.status === 401 ? 'Sign in above, then select your PDF again. Your text is unchanged.' : error.status === 403 ? 'Security check failed. Sign in again, then select your PDF.' : error.status === 413
          ? 'Choose a PDF of 5 MB or smaller.'
          : (error.status !== 0 && typeof error.error?.message === 'string' ? error.error.message : 'PDF extraction failed. Check the backend connection, try another PDF, or paste your CV text.'));
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
    if (this.storageBusy() || this.isLoading() || this.isExtracting() || this.exporting()) return;
    this.analysisError.set(this.validationMessage());
    if (this.analysisError()) return;
    if (this.hasPreviewEdits() && !window.confirm('Creating another preview will discard your unsaved edits. Continue?')) return;
    this.isLoading.set(true);
    this.http.post<DemoPreview>('/api/analyze', {
      cvText: this.cvText, jobText: this.jobText, jobTitle: this.jobTitle,
      company: this.company, language: this.language, includeLetter: this.includeLetter,
      motivation: this.motivation,
    }).subscribe({
      next: response => {
        this.backendStatus.set('Backend connected');
        this.copyStatus.set({ cvDraft: '', motivationLetterDraft: '' });
        this.exportError.set({ cvDraft: '', motivationLetterDraft: '' });
        this.exportStatus.set({ cvDraft: '', motivationLetterDraft: '' });
        this.original = { ...response };
        this.preview.set({ ...response });
        this.isLoading.set(false);
      },
      error: error => {
        this.updateBackendStatus(error);
        this.analysisError.set(error.status === 401 ? 'Sign in above, then retry. Your application text and previews are unchanged.' : error.status === 403 ? 'Security check failed. Sign in again above, then retry.' : error.status === 400 ? 'The backend rejected the input. Check required fields, lengths, and language.' : 'Request failed. Check that the backend is running and try again.');
        this.isLoading.set(false);
      },
    });
  }

  // Update a document as plain text and clear outdated copy feedback.
  editDraft(field: 'cvDraft' | 'motivationLetterDraft', value: string): void {
    this.preview.update(current => current ? { ...current, [field]: value } : null);
    this.copyStatus.update(current => ({ ...current, [field]: '' }));
    this.exportError.update(current => ({ ...current, [field]: '' }));
    this.exportStatus.update(current => ({ ...current, [field]: '' }));
  }

  // Only nonempty editor content can be exported, one document at a time.
  canExport(field: DraftField): boolean {
    return !!this.preview()?.[field]?.trim() && !this.storageBusy() && !this.exporting() && !this.isLoading() && !this.isExtracting();
  }

  // Download a snapshot of the latest editor text without modifying any draft.
  downloadPdf(field: DraftField): void {
    if (!this.canExport(field)) return;
    const text = this.preview()![field]!;
    this.exportError.update(current => ({ ...current, [field]: '' }));
    this.exportStatus.update(current => ({ ...current, [field]: '' }));
    if (text.length > 60000) {
      this.exportError.update(current => ({ ...current, [field]: 'Keep the document within 60,000 characters for PDF export.' }));
      return;
    }
    this.exporting.set(field);
    this.exportStatus.update(current => ({ ...current, [field]: 'Creating PDF…' }));
    this.http.post('/api/documents/export', {
      documentType: field === 'cvDraft' ? 'cv' : 'motivationLetter', text,
    }, { responseType: 'blob' }).subscribe({
      next: blob => {
        this.backendStatus.set('Backend connected');
        try {
          this.savePdf(blob, field === 'cvDraft' ? 'cv-demo.pdf' : 'motivation-letter-demo.pdf');
          this.exportStatus.update(current => ({ ...current, [field]: 'PDF download started. Review before use.' }));
        } catch {
          this.exportError.update(current => ({ ...current, [field]: 'The PDF could not be downloaded. Your draft is unchanged. Please try again.' }));
        } finally {
          this.exporting.set(null);
        }
      },
      error: error => { void this.handleExportError(field, error); },
    });
  }

  // Allow the browser to consume its download URL before releasing it.
  private savePdf(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    try {
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  // Read JSON errors delivered as blobs and always unlock the export controls.
  private async handleExportError(field: DraftField, error: HttpErrorResponse): Promise<void> {
    this.updateBackendStatus(error);
    let message = error.status === 401 ? 'Sign in above, then retry the download. Your draft is unchanged.' : error.status === 403 ? 'Security check failed. Sign in again above, then retry the download.' : 'PDF export failed. Check the backend connection and try again. Your draft is unchanged.';
    try {
      const payload = error.error instanceof Blob ? JSON.parse(await error.error.text()) : error.error;
      if (![0, 401, 403].includes(error.status) && typeof payload?.message === 'string') message = payload.message;
    } catch { /* Keep the safe fallback for non-JSON error responses. */ }
    this.exportStatus.update(current => ({ ...current, [field]: '' }));
    this.exportError.update(current => ({ ...current, [field]: message }));
    this.exporting.set(null);
  }

  // Reflect connection failures and recovery from subsequent API requests.
  private updateBackendStatus(error: HttpErrorResponse): void {
    if (error.status === 401) this.auth.requireLogin();
    if (error.status === 403) {
      this.auth.show();
      this.auth.message.set('Security check failed. Sign in again, then retry. Your application text is unchanged.');
    }
    this.backendStatus.set(error.status === 0 ? 'Cannot connect to backend' : 'Backend connected');
  }

  // Report clipboard success or provide a manual-copy fallback.
  async copyDraft(field: 'cvDraft' | 'motivationLetterDraft'): Promise<void> {
    const value = this.preview()?.[field];
    if (value === undefined || this.isLoading()) return;
    try {
      await navigator.clipboard.writeText(value);
      if (this.preview()?.[field] === value) this.copyStatus.update(current => ({ ...current, [field]: 'Copied to clipboard.' }));
    } catch {
      this.copyStatus.update(current => ({ ...current, [field]: 'Copy failed. Select the document text and copy it manually.' }));
    }
  }
}
