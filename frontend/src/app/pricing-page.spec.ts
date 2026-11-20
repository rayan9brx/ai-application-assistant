import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { Navigation } from './navigation';
import { COMPARISON, FAQ, PLANS, formatEuro, yearlySaving } from './pricing-config';
import { PricingPage } from './pricing-page';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

describe('pricing config', () => {
  it('formats euros the German way and derives the yearly saving', () => {
    expect(formatEuro(9.99)).toBe('9,99 €');
    expect(formatEuro(83.88)).toBe('83,88 €');
    expect(formatEuro(49)).toBe('49 €');
    expect(yearlySaving()).toBe(30);
  });
});

describe('PricingPage', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(PricingPage);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };
  const proPrice = (root: HTMLElement) =>
    text(root.querySelector('#plan-pro')!.closest('article')!.querySelector('.price'));
  const proNote = (root: HTMLElement) =>
    text(root.querySelector('#plan-pro')!.closest('article')!.querySelector('.note'));

  it('renders one card per plan with its features and switches Pro prices with the toggle', () => {
    const { fixture, root } = setup();
    expect(root.querySelectorAll('app-pricing-card').length).toBe(PLANS.length);
    const highlighted = Array.from(root.querySelectorAll('app-pricing-card.highlighted'), (card) =>
      text(card.querySelector('h2')),
    );
    expect(highlighted).toEqual(['Pro']);
    expect(proPrice(root)).toBe('9,99 € /month');
    expect(proNote(root)).toBe('Billed monthly');

    const [monthly, yearly] = Array.from(
      root.querySelectorAll<HTMLButtonElement>('app-billing-toggle button'),
    );
    expect(monthly.getAttribute('aria-pressed')).toBe('true');
    expect(text(yearly)).toBe('Yearly Save 30%');
    yearly.click();
    fixture.detectChanges();
    expect(yearly.getAttribute('aria-pressed')).toBe('true');
    expect(monthly.getAttribute('aria-pressed')).toBe('false');
    expect(proPrice(root)).toBe('6,99 € /month');
    expect(proNote(root)).toBe('Billed 83,88 € per year');
    // One-time and free prices don't depend on billing.
    expect(
      text(root.querySelector('#plan-lifetime')!.closest('article')!.querySelector('.price')),
    ).toBe('49 € one-time');
  });

  it('labels comparison cells for screen readers', () => {
    const { root } = setup();
    const rows = root.querySelectorAll('app-comparison-table tbody tr');
    expect(rows.length).toBe(COMPARISON.length);
    const cvRow = Array.from(rows).find(
      (row) => text(row.querySelector('th')) === 'ATS keyword scanner',
    )!;
    expect(Array.from(cvRow.querySelectorAll('td'), text)).toEqual([
      'Not included',
      'Included',
      'Included',
    ]);
  });

  it('expands and collapses FAQ answers with aria-expanded', () => {
    const { fixture, root } = setup();
    const buttons = root.querySelectorAll<HTMLButtonElement>('app-faq button');
    expect(buttons.length).toBe(FAQ.length);
    const first = buttons[0];
    const answer = root.querySelector('#' + first.getAttribute('aria-controls'))!;
    expect(answer.getAttribute('aria-labelledby')).toBe(first.id);
    expect(first.getAttribute('aria-expanded')).toBe('false');
    first.click();
    fixture.detectChanges();
    expect(first.getAttribute('aria-expanded')).toBe('true');
    first.click();
    fixture.detectChanges();
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Pricing route', () => {
  const start = location.href;
  afterEach(() => history.replaceState(null, '', start));

  it('renders the pricing page and marks the nav link as current', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding())] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Navigation).go('/pricing');
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('main app-pricing-page')).not.toBeNull();
    const current = Array.from(root.querySelectorAll('nav a[aria-current="page"]'), text);
    expect(current).toEqual(['Pricing', 'Pricing']);
    expect(document.title).toBe('Pricing — ApplyCraft');
  });
});
