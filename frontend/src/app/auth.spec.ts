import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from './auth';

describe('Session accounts', () => {
  let auth: Auth;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/';
  });

  // Resolve requests issued after promise continuations without arbitrary sleeps.
  async function respond(url: string, body: object = {}): Promise<void> {
    await vi.waitFor(() => http.expectOne(url).flush(body));
  }

  it('bootstraps CSRF and restores only the server-provided identity', async () => {
    const pending = auth.initialize();
    await respond('/api/auth/csrf');
    await respond('/api/auth/me', { email: 'person@example.test' });
    await pending;
    expect(auth.user()?.email).toBe('person@example.test');
    expect(auth.ready()).toBe(true);
  });

  it('registers with XSRF, clears passwords, and reports duplicate registration', async () => {
    document.cookie = 'XSRF-TOKEN=test-token; Path=/';
    auth.show('register');
    auth.email = ' Person@Example.test ';
    auth.password = 'Long password Grüße';
    let pending = auth.submit();
    await respond('/api/auth/csrf');
    await vi.waitFor(() => {
      const request = http.expectOne('/api/auth/register');
      expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('test-token');
      expect(request.request.body).toEqual({ email: 'person@example.test', password: 'Long password Grüße' });
      request.flush({}, { status: 201, statusText: 'Created' });
    });
    await pending;
    expect(auth.password).toBe('');
    expect(auth.mode()).toBe('login');
    expect(auth.message()).toContain('Account created');
    auth.show('register');
    auth.password = 'Long password Grüße';
    pending = auth.submit();
    await respond('/api/auth/csrf');
    await vi.waitFor(() => http.expectOne('/api/auth/register').flush({}, { status: 409, statusText: 'Conflict' }));
    await pending;
    expect(auth.error()).toContain('Unable to register');
    expect(auth.password).toBe('');
  });

  it('uses form login, refreshes CSRF, and invalidates the session on logout', async () => {
    auth.show();
    auth.email = 'person@example.test';
    auth.password = 'Long password Grüße';
    let pending = auth.submit();
    await respond('/api/auth/csrf');
    await vi.waitFor(() => {
      const request = http.expectOne('/api/auth/login');
      expect(request.request.body.get('email')).toBe('person@example.test');
      request.flush({});
    });
    await respond('/api/auth/csrf');
    await respond('/api/auth/me', { email: 'person@example.test' });
    await pending;
    expect(auth.open()).toBe(false);
    expect(auth.user()?.email).toBe('person@example.test');
    expect(auth.password).toBe('');
    pending = auth.logout();
    await respond('/api/auth/csrf');
    await respond('/api/auth/logout');
    await respond('/api/auth/csrf');
    await pending;
    expect(auth.user()).toBeNull();
    expect(auth.message()).toContain('Signed out');
  });

  it('keeps generic login errors and rejects invalid registration before sending', async () => {
    auth.show('register');
    auth.email = 'invalid';
    auth.password = 'short';
    await auth.submit();
    expect(auth.error()).toContain('valid email');
    auth.show();
    auth.email = 'person@example.test';
    auth.password = 'wrong';
    const pending = auth.submit();
    await respond('/api/auth/csrf');
    await vi.waitFor(() => http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' }));
    await pending;
    expect(auth.error()).toBe('Invalid email or password.');
    expect(auth.user()).toBeNull();
    expect(auth.password).toBe('');
  });
});
