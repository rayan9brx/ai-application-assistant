import { Component, DestroyRef, computed, inject, signal } from '@angular/core';

export interface ShowcaseFeature {
  id: string;
  title: string;
  /** First sentence, rendered in white. */
  lead: string;
  /** Remaining copy, rendered in gray. */
  rest: string;
  href: string;
}

export interface ScoreCategory {
  label: string;
  score: number;
}

/** How long each feature stays active before the showcase advances. */
export const SHOWCASE_INTERVAL_MS = 6000;

export const SHOWCASE_FEATURES: readonly ShowcaseFeature[] = [
  {
    id: 'build',
    title: 'Build',
    lead: 'Start from the experience you already have.',
    rest: 'Bring your CV and the job description into one workspace, then review and edit every line before you download.',
    href: '#application-details',
  },
  {
    id: 'score',
    title: 'Score',
    lead: 'Know exactly where you stand.',
    rest: "The ApplyCraft Score breaks down your CV section by section. No guessing what's weak. You see it, then fix it.",
    href: '#about',
  },
  {
    id: 'target',
    title: 'Target',
    lead: 'Fit every application to the role.',
    rest: 'Compare your CV with the job description and see which of your real skills to bring forward. Nothing is invented.',
    href: '#about',
  },
];

/**
 * Illustrative sample data for the score card. There is no scoring backend yet;
 * replace this with a real analysis response once one exists.
 */
export const SAMPLE_SCORE: { overall: number; verdict: string; categories: readonly ScoreCategory[] } = {
  overall: 58,
  verdict: 'Needs improvement',
  categories: [
    { label: 'Content', score: 54 },
    { label: 'Format', score: 82 },
    { label: 'Optimization', score: 38 },
    { label: 'Best Practices', score: 63 },
    { label: 'Application Ready', score: 51 },
  ],
};

const GAUGE = { cx: 100, cy: 100, r: 80 };
const RING_RADIUS = 15;

@Component({
  selector: 'app-showcase',
  templateUrl: './showcase.html',
  styleUrl: './showcase.scss',
})
export class Showcase {
  readonly features = SHOWCASE_FEATURES;
  readonly score = SAMPLE_SCORE;
  readonly intervalMs = SHOWCASE_INTERVAL_MS;
  readonly ringRadius = RING_RADIUS;
  readonly ringCircumference = 2 * Math.PI * RING_RADIUS;
  readonly gaugePath = `M${GAUGE.cx - GAUGE.r} ${GAUGE.cy} A${GAUGE.r} ${GAUGE.r} 0 0 1 ${GAUGE.cx + GAUGE.r} ${GAUGE.cy}`;
  readonly knob = Showcase.gaugePoint(SAMPLE_SCORE.overall);

  /** Users who ask for reduced motion get no auto-advance. */
  readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly active = signal(0);
  /** Bumped on every switch so the progress bar re-renders and its animation restarts. */
  readonly cycle = signal(0);
  readonly userPaused = signal(false);
  private readonly hovered = signal(false);
  private readonly focused = signal(false);
  readonly paused = computed(
    () => this.reducedMotion || this.userPaused() || this.hovered() || this.focused(),
  );

  private timer?: ReturnType<typeof setTimeout>;
  private remaining = SHOWCASE_INTERVAL_MS;
  private startedAt = 0;

  constructor() {
    this.sync();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  static gaugePoint(score: number): { x: number; y: number } {
    const angle = Math.PI * (1 - Math.min(100, Math.max(0, score)) / 100);
    return { x: GAUGE.cx + GAUGE.r * Math.cos(angle), y: GAUGE.cy - GAUGE.r * Math.sin(angle) };
  }

  ringOffset(score: number): number {
    return this.ringCircumference * (1 - score / 100);
  }

  ringTone(score: number): 'low' | 'mid' | 'high' {
    return score < 50 ? 'low' : score < 75 ? 'mid' : 'high';
  }

  /** Switch immediately and give the new feature a full interval. */
  select(index: number): void {
    this.active.set(index);
    this.cycle.update((c) => c + 1);
    this.remaining = SHOWCASE_INTERVAL_MS;
    this.stopTimer();
    this.sync();
  }

  togglePause(): void {
    this.userPaused.update((p) => !p);
    this.sync();
  }

  setHovered(value: boolean): void {
    this.hovered.set(value);
    this.sync();
  }

  onFocusIn(): void {
    this.focused.set(true);
    this.sync();
  }

  onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (host.contains(event.relatedTarget as Node | null)) return;
    this.focused.set(false);
    this.sync();
  }

  private sync(): void {
    if (this.paused()) {
      if (this.timer === undefined) return;
      this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt));
      this.stopTimer();
    } else if (this.timer === undefined) {
      this.startedAt = Date.now();
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.select((this.active() + 1) % this.features.length);
      }, this.remaining);
    }
  }

  private stopTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
