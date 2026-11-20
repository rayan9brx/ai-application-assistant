import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { MENU_ITEMS } from './menu-config';
import { Navigation } from './navigation';
import { ServicesMenu } from './services-menu';

const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );

describe('ServicesMenu', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(ServicesMenu);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const trigger = root.querySelector<HTMLButtonElement>('.trigger')!;
    const render = () => {
      fixture.detectChanges();
      TestBed.tick();
    };
    return { fixture, root, trigger, render };
  };
  afterEach(() => document.body.replaceChildren());

  it('renders every configured item as a link, plus View all', () => {
    const { root, trigger } = setup();
    const items = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[app-menu-item]'));
    expect(items.map((a) => a.querySelector('.title')!.textContent!.trim())).toEqual(
      MENU_ITEMS.map(
        (item) => item.title + (item.soon ? ' Soon' : item.badge ? ` ${item.badge}` : ''),
      ),
    );
    expect(items.map((a) => a.getAttribute('href'))).toEqual(MENU_ITEMS.map((item) => item.href));
    expect(root.querySelector('.view-all')!.getAttribute('href')).toBe('/tools');
    expect(trigger.getAttribute('aria-controls')).toBe(root.querySelector('.panel')!.id);
  });

  it('toggles on click and closes on Escape and outside clicks', () => {
    const { trigger, render } = setup();
    trigger.click();
    render();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    key(trigger, 'Escape');
    render();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    render();
    document.body.click();
    render();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens with ArrowDown and moves focus with arrow, Home and End keys', () => {
    const { root, trigger, render } = setup();
    const links = () => Array.from(root.querySelectorAll<HTMLAnchorElement>('.panel a'));
    key(trigger, 'ArrowDown');
    render();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(links()[0]);

    key(links()[0], 'ArrowDown');
    expect(document.activeElement).toBe(links()[1]);
    key(links()[1], 'End');
    expect(document.activeElement).toBe(links().at(-1));
    key(links().at(-1)!, 'ArrowDown');
    expect(document.activeElement).toBe(links()[0]);
    key(links()[0], 'ArrowUp');
    expect(document.activeElement).toBe(links().at(-1));
  });

  it('closes after a link is followed', () => {
    const { root, trigger, render } = setup();
    trigger.click();
    render();
    root
      .querySelector<HTMLAnchorElement>('a[app-menu-item]')!
      .addEventListener('click', (e) => e.preventDefault());
    root.querySelector<HTMLAnchorElement>('a[app-menu-item]')!.click();
    render();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('App routes', () => {
  const start = location.href;
  afterEach(() => history.replaceState(null, '', start));

  it('shows the tools page and a coming-soon page for placeholder tools', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding())] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const navigation = TestBed.inject(Navigation);
    const go = async (url: string) => {
      await navigation.go(url);
      fixture.detectChanges();
      await fixture.whenStable();
    };

    await go('/tools');
    const main: HTMLElement = fixture.nativeElement.querySelector('main');
    expect(main.querySelector('h1')!.textContent).toContain('All tools');
    expect(main.querySelectorAll('a[app-menu-item]').length).toBe(MENU_ITEMS.length);

    await go('/tools/cv-checker');
    expect(main.querySelector('h1')!.textContent).toContain('CV Checker is on its way');
    expect(document.title).toContain('CV Checker');

    await go('/');
    expect(main.querySelector('app-hero')).not.toBeNull();
  });
});
