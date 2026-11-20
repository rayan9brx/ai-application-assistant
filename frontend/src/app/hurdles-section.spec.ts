import { TestBed } from '@angular/core/testing';
import { HURDLES, SAMPLE_ATS_SCORE, SAMPLE_JOBS } from './hurdles-config';
import { HurdlesSection } from './hurdles-section';
import { Stepper } from './stepper';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

describe('HurdlesSection', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(HurdlesSection);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders every hurdle from the config in a zig-zag with its CTA', async () => {
    const root = await render();
    const steps = Array.from(root.querySelectorAll('app-hurdle-step'));
    expect(steps.map((s) => text(s.querySelector('h3')))).toEqual(HURDLES.map((h) => h.title));
    expect(steps.map((s) => s.classList.contains('reversed'))).toEqual([false, true, false]);
    expect(steps.map((s) => s.querySelector('.step-cta')!.getAttribute('href'))).toEqual([
      '/tools/job-search',
      '/tools/ai-cv-builder',
      '/#get-started',
    ]);
    expect(steps[0].querySelectorAll('.benefits li').length).toBe(3);
  });

  // jsdom has no IntersectionObserver, so every visual shows its final state straight away.
  it('shows the final state of each visual when it cannot animate', async () => {
    const root = await render();
    expect(
      Array.from(root.querySelectorAll('app-hurdle-step'), (s) => s.classList.contains('visible')),
    ).toEqual([true, true, true]);
    expect(Array.from(root.querySelectorAll('app-job-match-mock .match'), text)).toEqual(
      SAMPLE_JOBS.map((job) => `${job.match}% match`),
    );
    expect(root.querySelector('app-bullet-rewrite-mock .mock')!.classList).toContain('rewritten');
    expect(text(root.querySelector('app-ats-score-mock .number'))).toBe(`${SAMPLE_ATS_SCORE.to}%`);
    expect(root.querySelectorAll('app-ats-score-mock li.missing').length).toBe(0);
    expect(root.querySelector('app-ats-score-mock app-score-ring')!.getAttribute('data-tone')).toBe(
      'high',
    );
  });
});

describe('Stepper', () => {
  it('marks reached steps and the current one, and links to each step', () => {
    const fixture = TestBed.createComponent(Stepper);
    fixture.componentRef.setInput('steps', HURDLES);
    fixture.componentRef.setInput('active', 1);
    fixture.componentRef.setInput('fill', 0.75);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const items = Array.from(root.querySelectorAll('li'));
    expect(items.map((li) => li.classList.contains('reached'))).toEqual([true, true, false]);
    expect(Array.from(root.querySelectorAll('a'), (a) => a.getAttribute('href'))).toEqual(
      HURDLES.map((h) => `#${h.id}`),
    );
    expect(root.querySelector('[aria-current="step"]')!.getAttribute('href')).toBe('#hurdle-02');
    expect(root.querySelector<HTMLElement>('.fill')!.style.getPropertyValue('--fill')).toBe('0.75');
  });
});
