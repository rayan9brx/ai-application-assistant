import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './auth.service';
import { CvCheckPage } from './cv-check-page';
import { itemBySlug } from './menu-config';
import { FAQ, PLANS } from './pricing-config';
import { UploadBar } from './upload-bar';

/** Signed-out (or signed-in) stand-in for Supabase; no network. */
class FakeAuth {
  readonly session = signal<Session | null>(null);
  readonly signedIn = computed(() => !!this.session());
  readonly user = computed(() => this.session()?.user ?? null);
  readonly displayName = computed(() => 'Test User');
  readonly recovering = signal(false);
  whenReady = () => Promise.resolve();
  onChange() {}
  accessToken = async () => null;
  signOut = async () => this.session.set(null);
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Homepage links', () => {
  const start = location.href;
  let auth: FakeAuth;

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: AuthService, useValue: auth },
      ],
    });
  });
  afterEach(() => history.replaceState(null, '', start));

  async function renderHome() {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('has no dead links: every link reaches a real page or an anchor on the page', async () => {
    const root = await renderHome();
    const router = TestBed.inject(Router);
    const hrefs = [...new Set(Array.from(root.querySelectorAll('a[href]'), (a) => a.getAttribute('href')!))];
    expect(hrefs.length).toBeGreaterThan(15);

    // Anchors first, while the homepage is still rendered.
    for (const href of hrefs) {
      expect(href, `external or placeholder link: ${href}`).not.toMatch(/^(mailto:|https?:)|example\.com/);
      expect(href, 'empty anchor').not.toBe('#');
      const url = new URL(href, location.origin);
      if (url.hash) expect(root.querySelector(url.hash), `missing anchor ${href}`).not.toBeNull();
      if (url.pathname.startsWith('/tools/')) {
        expect(itemBySlug(url.pathname.slice('/tools/'.length)), `unknown tool ${href}`).toBeDefined();
      }
    }
    for (const href of hrefs) {
      const url = new URL(href, location.origin);
      // The router's catch-all sends unknown paths back to "/"; a real page keeps its own path
      // (or, for pages that need an account, redirects to log-in).
      await router.navigateByUrl(url.pathname + url.search);
      const landed = new URL(router.url, location.origin).pathname;
      if (url.pathname !== '/') {
        expect(landed === url.pathname || landed === '/login', `${href} landed on ${router.url}`).toBe(true);
      }
    }
  });

  it('sends the main calls to action into the CV Checker', async () => {
    const root = await renderHome();
    const hrefOf = (label: string) =>
      Array.from(root.querySelectorAll('a'))
        .filter((a) => text(a).startsWith(label))
        .map((a) => a.getAttribute('href'));
    expect(hrefOf('Try it free')).toEqual(['/check']);
    expect(hrefOf('Build my CV for free')).toEqual(['/check']);
    expect(hrefOf('Check my CV for free')).toEqual(['/check', '/check']);
    expect(hrefOf('Score my CV')).toEqual(['/check']);
    expect(hrefOf('Start for free')).toEqual(['/check']);
    expect(text(root)).not.toContain('PLACEHOLDER');
  });

  it('labels every demo with sample data as an example', async () => {
    const root = await renderHome();
    for (const section of ['app-showcase', 'app-problem-section', 'app-hurdles-section']) {
      const badges = Array.from(root.querySelectorAll(`${section} .example-badge`), text);
      expect(badges.length, section).toBeGreaterThan(0);
      expect(badges.every((b) => b === 'Example'), section).toBe(true);
    }
    expect(root.querySelectorAll('app-hurdles-section .example-badge').length).toBe(3);
  });

  it('shows the avatar menu instead of Log in / Try it free once signed in', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    const header = () => fixture.nativeElement.querySelector('.header-actions') as HTMLElement;
    expect(text(header())).toContain('Log in');

    auth.session.set({ access_token: 't', user: { id: 'u', user_metadata: {} } } as unknown as Session);
    fixture.detectChanges();
    expect(header().querySelector('.avatar')).not.toBeNull();
    expect(text(header())).not.toContain('Log in');
    expect(text(header())).not.toContain('Try it free');
    expect(text(fixture.nativeElement.querySelector('app-site-footer'))).toContain('Dashboard');
  });
});

describe('Pricing buttons', () => {
  it('starts the checker for Free and sends paid plans to sign-up (no payments yet)', () => {
    expect(Object.fromEntries(PLANS.map((p) => [p.id, p.cta.href]))).toEqual({
      free: '/check',
      pro: '/signup',
      lifetime: '/signup',
    });
    expect(FAQ.some((item) => item.link)).toBe(false);
  });
});

describe('Home upload bar', () => {
  const drop = (file: File) => {
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
    return event;
  };

  it('submits a valid file as soon as it is dropped, and never an invalid one', () => {
    const fixture = TestBed.createComponent(UploadBar);
    fixture.componentRef.setInput('autoSubmit', true);
    const submitted: string[] = [];
    fixture.componentInstance.submitted.subscribe((file) => submitted.push(file.name));
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.upload-bar') as HTMLElement;

    bar.dispatchEvent(drop(new File(['x'], 'photo.png', { type: 'image/png' })));
    expect(submitted).toEqual([]);
    bar.dispatchEvent(drop(new File(['PK'], 'cv.docx')));
    expect(submitted).toEqual(['cv.docx']);
  });
});

describe('CV Checker privacy text', () => {
  it('tells guests nothing is stored, and signed-in users where saved CVs live', () => {
    const auth = new FakeAuth();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
    const fixture = TestBed.createComponent(CvCheckPage);
    fixture.detectChanges();
    const lede = () => text(fixture.nativeElement.querySelector('.intro .lede'));
    expect(lede()).toContain('Your CV is never stored.');

    auth.session.set({ access_token: 't', user: { id: 'u' } } as unknown as Session);
    fixture.detectChanges();
    expect(lede()).toContain('Saved CVs are stored securely in the EU and can be deleted anytime.');
    expect(lede()).not.toContain('never stored');
  });
});
