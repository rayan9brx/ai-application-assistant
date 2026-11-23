import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { routes } from '../app.routes';
import { safeNext } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { CvFlow, CvScore } from './cv-flow';
import { CvLibrary, titleFor } from './cv-library';

/** Stands in for Supabase: tests flip the session and fire auth events by hand. */
class FakeAuth {
  readonly session = signal<Session | null>(null);
  readonly signedIn = computed(() => !!this.session());
  readonly user = computed(() => this.session()?.user ?? null);
  readonly displayName = computed(() => 'Test User');
  readonly recovering = signal(false);
  private listeners: ((event: AuthChangeEvent, session: Session | null) => void)[] = [];
  whenReady = () => Promise.resolve();
  onChange(listener: (event: AuthChangeEvent, session: Session | null) => void) {
    this.listeners.push(listener);
  }
  accessToken = async () => this.session()?.access_token ?? null;
  signOut = async () => this.emit('SIGNED_OUT', null);
  emit(event: AuthChangeEvent, session: Session | null) {
    this.session.set(session);
    this.listeners.forEach((listener) => listener(event, session));
  }
}

const SESSION = { access_token: 'token-a', user: { id: 'user-a' } } as unknown as Session;

const SCORE: CvScore = {
  overall: 64,
  label: 'Good',
  categories: { content: 60, format: 70, optimization: 55, bestPractices: 70, applicationReady: 65 },
  fields: {
    name: { detected: true, detail: '' },
    contact: { detected: true, detail: '' },
    experience: { detected: true, detail: '' },
    education: { detected: true, detail: '' },
    skills: { detected: true, detail: '' },
  },
  issues: [],
};

describe('Auth', () => {
  let auth: FakeAuth;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  it('only accepts same-site paths after log-in', () => {
    expect(safeNext('/check')).toBe('/check');
    expect(safeNext('//evil.example')).toBe('/dashboard');
    expect(safeNext('/\\evil.example')).toBe('/dashboard');
    expect(safeNext('https://evil.example')).toBe('/dashboard');
    expect(safeNext(null)).toBe('/dashboard');
  });

  it('sends guests from protected pages to log-in, and lets signed-in users through', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    expect(router.url).toBe('/login?next=%2Fdashboard');
    await router.navigateByUrl('/settings');
    expect(router.url).toBe('/login?next=%2Fsettings');

    auth.session.set(SESSION);
    await router.navigateByUrl('/settings');
    expect(router.url).toBe('/settings');
    // Signed-in users skip the log-in page.
    await router.navigateByUrl('/login?next=%2Fcheck');
    expect(router.url).toBe('/check');
  });

  it('adds the access token to API calls only', async () => {
    const client = TestBed.inject(HttpClient);
    auth.session.set(SESSION);
    void firstValueFrom(client.get('/api/cvs'));
    void firstValueFrom(client.get('https://elsewhere.example/data'));
    await Promise.resolve();
    await Promise.resolve();
    expect(http.expectOne('/api/cvs').request.headers.get('Authorization')).toBe('Bearer token-a');
    expect(http.expectOne('https://elsewhere.example/data').request.headers.has('Authorization')).toBe(false);
  });

  it('saves the guest’s CV automatically after sign-up, then adds new scores to it', async () => {
    const flow = TestBed.inject(CvFlow);
    const library = TestBed.inject(CvLibrary);
    const router = TestBed.inject(Router);
    flow.cvText.set('Taylor Brooks\nFrontend Developer');
    flow.score.set(SCORE);

    await library.requestSave();
    expect(router.url).toBe('/signup?next=%2Fcheck&save=1');
    http.expectNone('/api/cvs');

    auth.emit('SIGNED_IN', SESSION);
    await vi.waitFor(() => http.expectOne({ method: 'POST', url: '/api/cvs' }).flush(
      { id: 'cv-1', title: 'Taylor Brooks', content: { text: '' }, jobDescription: null },
      { status: 201, statusText: 'Created' },
    ));
    const saved = await vi.waitFor(() => http.expectOne({ method: 'POST', url: '/api/cvs/cv-1/analyses' }));
    expect(saved.request.body.result.overall).toBe(64);
    saved.flush({}, { status: 201, statusText: 'Created' });
    await vi.waitFor(() => expect(library.state()).toBe('saved'));
    expect(flow.savedCvId()).toBe('cv-1');

    // A re-score of the saved CV is stored in its history.
    flow.scoreRuns.update((runs) => runs + 1);
    TestBed.tick();
    await vi.waitFor(() => http.expectOne({ method: 'GET', url: '/api/cvs/cv-1' }).flush(
      { id: 'cv-1', title: 'My title', content: { text: '' }, jobDescription: null },
    ));
    const update = await vi.waitFor(() => http.expectOne({ method: 'PUT', url: '/api/cvs/cv-1' }));
    expect(update.request.body.title).toBe('My title');
    update.flush({});
    await vi.waitFor(() =>
      http.expectOne({ method: 'POST', url: '/api/cvs/cv-1/analyses' }).flush({}),
    );

    // Signing out clears the checker on this device.
    auth.emit('SIGNED_OUT', null);
    expect(flow.cvText()).toBe('');
    expect(flow.savedCvId()).toBeNull();
    http.verify();
  });

  it('uses the CV’s first line as its title', () => {
    expect(titleFor('\n  Taylor Brooks  \nDeveloper')).toBe('Taylor Brooks');
    expect(titleFor('   ')).toBe('Untitled CV');
    expect(titleFor('x'.repeat(100)).length).toBe(78);
  });
});
