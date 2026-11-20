import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SHOWCASE_INTERVAL_MS, Showcase } from './showcase';
import { ScoreGauge } from './score-gauge';

describe('Showcase', () => {
  let fixture: ComponentFixture<Showcase>;
  let showcase: Showcase;
  const expanded = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll('.feature-toggle') as NodeListOf<HTMLElement>,
    ).map((b) => b.getAttribute('aria-expanded'));

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Showcase);
    showcase = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('auto-advances every interval and wraps around', () => {
    expect(expanded()).toEqual(['true', 'false', 'false']);
    vi.advanceTimersByTime(SHOWCASE_INTERVAL_MS);
    fixture.detectChanges();
    expect(expanded()).toEqual(['false', 'true', 'false']);
    vi.advanceTimersByTime(SHOWCASE_INTERVAL_MS * 2);
    expect(showcase.active()).toBe(0);
  });

  it('switches immediately on click and resets the timer', () => {
    vi.advanceTimersByTime(4000);
    (fixture.nativeElement.querySelectorAll('.feature-toggle')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(expanded()).toEqual(['false', 'false', 'true']);
    vi.advanceTimersByTime(SHOWCASE_INTERVAL_MS - 1);
    expect(showcase.active()).toBe(2);
    vi.advanceTimersByTime(1);
    expect(showcase.active()).toBe(0);
  });

  it('pauses and resumes with the remaining time', () => {
    vi.advanceTimersByTime(2000);
    showcase.togglePause();
    vi.advanceTimersByTime(SHOWCASE_INTERVAL_MS * 3);
    expect(showcase.active()).toBe(0);
    showcase.togglePause();
    vi.advanceTimersByTime(3999);
    expect(showcase.active()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(showcase.active()).toBe(1);
  });

  it('places the gauge knob on the arc for the score', () => {
    const start = ScoreGauge.point(0);
    expect(start.x).toBeCloseTo(20);
    expect(start.y).toBeCloseTo(100);
    const top = ScoreGauge.point(50);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(20);
  });
});
