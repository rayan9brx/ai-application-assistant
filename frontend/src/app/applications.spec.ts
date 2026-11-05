import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { SavedApplication } from './applications';

describe('Saved applications', () => {
  let fixture: ComponentFixture<App>;
  let app: App;
  let http: HttpTestingController;
  const saved: SavedApplication = {
    id: 'f375eddf-f860-4f39-b63c-d6253b54cbb0', version: 0, jobTitle: 'Developer', company: 'Example',
    language: 'German', sourceCv: 'Source CV', jobDescription: 'Vacancy', includeLetter: true,
    motivation: 'Reason', editedCv: 'Edited CV', editedLetter: 'Edited letter', demo: true,
    createdAt: '2026-11-05T12:00:00Z', updatedAt: '2026-11-05T12:00:00Z',
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(App); app = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/csrf').flush({});
    http.expectOne('/api/health').flush({ status: 'ok' });
    await vi.waitFor(() => http.expectOne('/api/auth/me').flush({ email: 'owner@example.test' }));
    await vi.waitFor(() => expect(app.auth.ready()).toBe(true));
    fixture.detectChanges();
    Object.assign(app, { cvText: 'Source CV', jobText: 'Vacancy', jobTitle: 'Developer', company: 'Example',
      language: 'German', includeLetter: true, motivation: 'Reason' });
    app.preview.set({ demo: true, notice: 'Demo', cvDraft: 'Edited CV', motivationLetterDraft: 'Edited letter', demoActions: [] });
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('saves current editors, prevents duplicate saves, and keeps edits made during the request unsaved', () => {
    app.saveApplication(); app.saveApplication();
    const request = http.expectOne('/api/applications');
    expect(request.request.body.editedCv).toBe('Edited CV');
    expect(request.request.body.editedLetter).toBe('Edited letter');
    expect(request.request.body.userId).toBeUndefined();
    app.editDraft('cvDraft', 'Edited while saving');
    request.flush(saved);
    expect(app.preview()?.cvDraft).toBe('Edited while saving');
    expect(app.hasUnsavedChanges()).toBe(true);
    app.saveApplication();
    const update = http.expectOne(`/api/applications/${saved.id}`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.version).toBe(0);
    expect(update.request.body.editedCv).toBe('Edited while saving');
    update.flush({ ...saved, version: 1, editedCv: 'Edited while saving' });
    expect(app.hasUnsavedChanges()).toBe(false);
    expect(app.storageMessage()).toContain('saved');
  });

  it('preserves work on failures, session expiry and version conflict', () => {
    for (const status of [500, 401, 409]) {
      app.auth.user.set({ email: 'owner@example.test' });
      app.saveApplication();
      http.expectOne('/api/applications').flush({}, { status, statusText: 'Failure' });
      expect(app.preview()?.cvDraft).toBe('Edited CV');
      expect(app.cvText).toBe('Source CV');
      expect(app.storageBusy()).toBe(false);
      expect(app.storageError()).toBeTruthy();
      expect(app.hasUnsavedChanges()).toBe(true);
      if (status === 401) expect(app.auth.open()).toBe(true);
      if (status === 409) expect(app.storageError()).toContain('changed elsewhere');
    }
  });

  it('confirms replacing unsaved work and reopens every stored field without regeneration', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    app.openApplication(saved);
    http.expectOne(`/api/applications/${saved.id}`).flush({ ...saved, sourceCv: 'Other CV' });
    expect(app.cvText).toBe('Source CV');
    confirm.mockReturnValue(true);
    app.openApplication(saved);
    http.expectOne(`/api/applications/${saved.id}`).flush({ ...saved, sourceCv: 'Other CV' });
    expect(app.cvText).toBe('Other CV');
    expect(app.jobText).toBe('Vacancy');
    expect(app.preview()?.motivationLetterDraft).toBe('Edited letter');
    expect(app.language).toBe('German');
    expect(app.hasUnsavedChanges()).toBe(false);
    expect(app.preview()?.notice).toContain('demo');
  });

  it('preserves current work on a failed reopen and validates before saving', () => {
    app.openApplication(saved);
    http.expectOne(`/api/applications/${saved.id}`).flush({}, { status: 404, statusText: 'Missing' });
    expect(app.preview()?.cvDraft).toBe('Edited CV');
    app.company = '';
    app.saveApplication();
    expect(app.storageError()).toContain('Enter');
    app.company = 'Example';
    app.editDraft('cvDraft', 'x'.repeat(60001));
    app.saveApplication();
    expect(app.storageError()).toContain('60,000');
  });

  it('reopens an intentionally empty edited CV without regenerating source text', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    app.openApplication(saved);
    http.expectOne(`/api/applications/${saved.id}`).flush({ ...saved, editedCv: '', editedLetter: null });
    expect(app.preview()?.cvDraft).toBe('');
    expect(app.preview()?.motivationLetterDraft).toBeUndefined();
    expect(app.cvText).toBe('Source CV');
    expect(app.hasUnsavedChanges()).toBe(false);
  });

  it('lists metadata pages and confirms versioned deletion', () => {
    app.listApplications(1);
    http.expectOne('/api/applications?page=1&size=10').flush({ items: [saved], page: 1, size: 10, total: 11 });
    expect(app.applicationList()?.items[0].company).toBe('Example');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    app.deleteApplication(saved);
    http.expectNone(`/api/applications/${saved.id}?version=0`);
    confirm.mockReturnValue(true);
    app.deleteApplication(saved);
    const request = http.expectOne(`/api/applications/${saved.id}?version=0`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'Deleted' });
    http.expectOne('/api/applications?page=0&size=10').flush({ items: [], page: 0, size: 10, total: 10 });
    expect(app.preview()?.cvDraft).toBe('Edited CV');
    expect(app.storageMessage()).toContain('deleted');
  });

  it('retains editor contents and saved identity when deletion conflicts', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    app.activeApplication.set(saved);
    app.deleteApplication(saved);
    http.expectOne(`/api/applications/${saved.id}?version=0`).flush({}, { status: 409, statusText: 'Conflict' });
    expect(app.activeApplication()?.id).toBe(saved.id);
    expect(app.preview()?.cvDraft).toBe('Edited CV');
  });

  it('clears private data on logout and discards a late save response', () => {
    app.saveApplication();
    const pending = http.expectOne('/api/applications');
    app.auth.user.set(null); app.auth.logoutCount.update(value => value + 1);
    fixture.detectChanges();
    pending.flush(saved);
    expect(app.cvText).toBe('');
    expect(app.jobText).toBe('');
    expect(app.preview()).toBeNull();
    expect(app.activeApplication()).toBeNull();
    expect(app.applicationList()).toBeNull();
    expect(app.hasUnsavedChanges()).toBe(false);
  });

  it('preserves work on expiry, clears it when another account signs in, and ignores late lists', () => {
    app.listApplications();
    const pending = http.expectOne('/api/applications?page=0&size=10');
    app.auth.requireLogin(); fixture.detectChanges();
    expect(app.cvText).toBe('Source CV');
    expect(app.preview()?.cvDraft).toBe('Edited CV');
    app.auth.user.set({ email: 'other@example.test' }); fixture.detectChanges();
    pending.flush({ items: [saved], page: 0, size: 10, total: 1 });
    expect(app.applicationList()).toBeNull();
    expect(app.cvText).toBe('');
    expect(app.preview()).toBeNull();
  });

  it('warns before leaving unsaved work and confirms starting a separate draft', () => {
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    app.warnBeforeLeaving(event);
    expect(event.defaultPrevented).toBe(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    app.newApplication(); expect(app.cvText).toBe('Source CV');
    confirm.mockReturnValue(true);
    app.newApplication(); expect(app.hasUnsavedChanges()).toBe(false);
    expect(app.activeApplication()).toBeNull();
  });

  it('renders draft metadata and current save state', () => {
    app.applicationsOpen.set(true);
    app.applicationList.set({ items: [saved], page: 0, size: 10, total: 1 });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Example — Developer');
    expect(text).toContain('German · Updated');
    expect(text).toContain('Unsaved changes');
    expect(text).toContain('Demo draft');
  });
});
