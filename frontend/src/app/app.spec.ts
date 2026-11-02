import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

 describe('Demo preview', () => {
  let app: App;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] });
    app = TestBed.createComponent(App).componentInstance;
    http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:8080/api/health').flush({ status: 'ok' });
    Object.assign(app, { cvText: '  CV\n', jobText: 'Job', jobTitle: 'Developer', company: 'Company' });
  });
  afterEach(() => http.verify());

  it('sends every field, prevents duplicate requests, and displays both document flows', () => {
    for (const language of ['English', 'German']) {
      for (const includeLetter of [false, true]) {
        Object.assign(app, { language, includeLetter, motivation: 'My reason' });
        app.analyze();
        app.analyze();
        app.updateSource('company', 'Blocked change');
        expect(app.company).toBe('Company');
        const request = http.expectOne('http://localhost:8080/api/analyze');
        expect(request.request.body).toEqual({ cvText: '  CV\n', jobText: 'Job', jobTitle: 'Developer', company: 'Company', language, includeLetter, motivation: 'My reason' });
        request.flush({ demo: true, notice: 'Demo', cvDraft: '  CV\n', ...(includeLetter ? { motivationLetterDraft: 'Template' } : {}), demoActions: [] });
        expect(app.preview()?.cvDraft).toBe('  CV\n');
        expect(app.preview()?.motivationLetterDraft).toBe(includeLetter ? 'Template' : undefined);
      }
    }
    expect(app.backendStatus()).toBe('Backend connected');
  });

  it('warns before discarding edits and preserves sources when cancelled', () => {
    app.analyze();
    http.expectOne('http://localhost:8080/api/analyze').flush({ demo: true, notice: 'Demo', cvDraft: 'CV', demoActions: [] });
    app.editDraft('cvDraft', 'Edited');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    app.updateSource('company', 'New');
    expect(app.company).toBe('Company');
    expect(app.preview()?.cvDraft).toBe('Edited');
    confirm.mockReturnValue(true);
    app.updateSource('company', 'New');
    expect(app.preview()).toBeNull();
    confirm.mockRestore();
  });

  it('validates inputs and recovers after backend failure', () => {
    app.includeLetter = true;
    expect(app.canContinue()).toBe(false);
    app.motivation = 'Reason';
    app.language = 'French';
    expect(app.canContinue()).toBe(false);
    app.language = 'English';
    app.jobTitle = 'x'.repeat(151);
    expect(app.canContinue()).toBe(false);
    app.jobTitle = 'Developer';
    app.analyze();
    http.expectOne('http://localhost:8080/api/analyze').flush({}, { status: 400, statusText: 'Bad request' });
    expect(app.isLoading()).toBe(false);
    expect(app.analysisError()).toContain('rejected');
  });

  it('reports clipboard success and failure', async () => {
    app.preview.set({ demo: true, notice: 'Demo', cvDraft: 'Edited CV', demoActions: [] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await app.copyDraft('cvDraft');
    expect(writeText).toHaveBeenCalledWith('Edited CV');
    expect(app.copyStatus().cvDraft).toContain('Copied');
    writeText.mockRejectedValue(new Error('Denied'));
    await app.copyDraft('cvDraft');
    expect(app.copyStatus().cvDraft).toContain('Copy failed');
  });
  // Simulate selecting a file without relying on a native file-picker dialog.
  function selectPdf(size = 12): HTMLInputElement {
    return { files: [new File(['x'.repeat(size)], 'cv.pdf', { type: 'application/pdf' })], value: 'cv.pdf' } as unknown as HTMLInputElement;
  }

  it('extracts into the editable CV and blocks source changes and analysis while uploading', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const input = selectPdf();
    app.uploadCv(input);
    expect(input.value).toBe('');
    expect(app.isExtracting()).toBe(true);
    expect(app.canContinue()).toBe(false);
    app.analyze();
    app.updateSource('cvText', 'Blocked change');
    app.uploadCv(selectPdf());
    expect(app.cvText).toBe('  CV\n');
    const request = http.expectOne('http://localhost:8080/api/cv/extract');
    expect(request.request.body instanceof FormData).toBe(true);
    expect(request.request.body.get('file').name).toBe('cv.pdf');
    request.flush({ text: 'Extracted CV' });
    expect(app.cvText).toBe('Extracted CV');
    expect(app.isExtracting()).toBe(false);
    expect(app.uploadMessage()).toContain('No AI tailoring');
    confirm.mockRestore();
  });

  it('preserves text and edited previews on failure or replacement cancellation', () => {
    app.analyze();
    http.expectOne('http://localhost:8080/api/analyze').flush({ demo: true, notice: 'Demo', cvDraft: 'CV', demoActions: [] });
    app.editDraft('cvDraft', 'Edited');
    app.uploadCv(selectPdf());
    http.expectOne('http://localhost:8080/api/cv/extract').flush({ message: 'Scanned PDFs are not supported yet.' }, { status: 422, statusText: 'Unprocessable Entity' });
    expect(app.cvText).toBe('  CV\n');
    expect(app.preview()?.cvDraft).toBe('Edited');
    expect(app.uploadError()).toContain('Scanned PDFs');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    app.uploadCv(selectPdf());
    http.expectOne('http://localhost:8080/api/cv/extract').flush({ text: 'Extracted CV' });
    expect(app.cvText).toBe('  CV\n');
    confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
    app.uploadCv(selectPdf());
    http.expectOne('http://localhost:8080/api/cv/extract').flush({ text: 'Extracted CV' });
    expect(app.cvText).toBe('  CV\n');
    expect(app.preview()?.cvDraft).toBe('Edited');
    expect(app.uploadMessage()).toBe('');
    confirm.mockRestore();
  });

  it('handles empty and oversized files and network errors without erasing the CV', () => {
    app.uploadCv(selectPdf(0));
    expect(app.uploadError()).toContain('empty');
    app.uploadCv(selectPdf(5 * 1024 * 1024 + 1));
    expect(app.uploadError()).toContain('5 MB');
    app.uploadCv(selectPdf());
    http.expectOne('http://localhost:8080/api/cv/extract').error(new ProgressEvent('error'));
    expect(app.uploadError()).toContain('backend connection');
    expect(app.cvText).toBe('  CV\n');
    expect(app.isExtracting()).toBe(false);
  });

  it('fills an empty CV without replacement confirmation and clears outdated previews', () => {
    app.analyze();
    http.expectOne('http://localhost:8080/api/analyze').flush({ demo: true, notice: 'Demo', cvDraft: 'CV', demoActions: [] });
    app.cvText = '';
    const confirm = vi.spyOn(window, 'confirm');
    app.uploadCv(selectPdf());
    http.expectOne('http://localhost:8080/api/cv/extract').flush({ text: 'Extracted CV' });
    expect(confirm).not.toHaveBeenCalled();
    expect(app.cvText).toBe('Extracted CV');
    expect(app.preview()).toBeNull();
    app.updateSource('cvText', 'Manually revised CV');
    expect(app.uploadMessage()).toBe('');
    confirm.mockRestore();
  });

  it('exports the latest edits as a blob and releases download URLs without losing drafts', () => {
    vi.useFakeTimers();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:demo');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    app.preview.set({ demo: true, notice: 'Demo', cvDraft: 'Original', motivationLetterDraft: 'Original letter', demoActions: [] });
    app.editDraft('cvDraft', 'Latest edited CV: Grüße');
    app.editDraft('motivationLetterDraft', 'Latest letter edit');
    for (const field of ['cvDraft', 'motivationLetterDraft'] as const) {
      app.downloadPdf(field);
      expect(app.exporting()).toBe(field);
      expect(app.canExport(field)).toBe(false);
      app.downloadPdf(field);
      const request = http.expectOne('http://localhost:8080/api/documents/export');
      expect(request.request.responseType).toBe('blob');
      expect(request.request.body).toEqual({ documentType: field === 'cvDraft' ? 'cv' : 'motivationLetter', text: app.preview()![field] });
      request.flush(new Blob(['%PDF-1.7 test'], { type: 'application/pdf' }));
      expect(app.exporting()).toBeNull();
      expect(app.exportStatus()[field]).toContain('download started');
      vi.runAllTimers();
    }
    expect(revokeUrl).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(2);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(app.preview()?.cvDraft).toBe('Latest edited CV: Grüße');
    expect(app.preview()?.motivationLetterDraft).toBe('Latest letter edit');
    createUrl.mockRestore(); revokeUrl.mockRestore(); click.mockRestore();
    vi.useRealTimers();
  });

  it('rejects empty documents and preserves edits after blob errors', async () => {
    app.preview.set({ demo: true, notice: 'Demo', cvDraft: '  ', demoActions: [] });
    expect(app.canExport('cvDraft')).toBe(false);
    expect(app.canExport('motivationLetterDraft')).toBe(false);
    app.downloadPdf('cvDraft');
    app.editDraft('cvDraft', 'Current edit');
    app.downloadPdf('cvDraft');
    http.expectOne('http://localhost:8080/api/documents/export').flush(
      new Blob([JSON.stringify({ message: 'Unsupported symbols. Please review.' })], { type: 'application/json' }),
      { status: 422, statusText: 'Unprocessable Content' });
    await vi.waitFor(() => expect(app.exporting()).toBeNull());
    expect(app.exportError().cvDraft).toContain('Unsupported symbols');
    expect(app.preview()?.cvDraft).toBe('Current edit');
    app.downloadPdf('cvDraft');
    http.expectOne('http://localhost:8080/api/documents/export').error(new ProgressEvent('error'));
    await vi.waitFor(() => expect(app.exporting()).toBeNull());
    expect(app.exportError().cvDraft).toContain('backend connection');
    expect(app.preview()?.cvDraft).toBe('Current edit');
  });

});
