import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CvData, CvPreview } from './cv-preview';
import { ScoreGauge } from './score-gauge';
import { ScoreRing } from './score-ring';
import { CHECK_HREF } from './menu-config';

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
    href: CHECK_HREF,
  },
  {
    id: 'score',
    title: 'Score',
    lead: 'Know exactly where you stand.',
    rest: "The Rezumo Score breaks down your CV section by section. No guessing what's weak. You see it, then fix it.",
    href: CHECK_HREF,
  },
  {
    id: 'target',
    title: 'Target',
    lead: 'Fit every application to the role.',
    rest: 'Compare your CV with the job description and see which of your real skills to bring forward. Nothing is invented.',
    href: CHECK_HREF,
  },
];

/**
 * Illustrative sample data for the score card. There is no scoring backend yet;
 * replace this with a real analysis response once one exists.
 */
export const SAMPLE_SCORE: {
  overall: number;
  verdict: string;
  categories: readonly ScoreCategory[];
} = {
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

/** Fictional CV shown next to the sample score card. */
export const SAMPLE_CV: CvData = {
  name: 'Jordan Ellis',
  title: 'Marketing Coordinator',
  contact: 'jordan.ellis@example.com · Berlin, Germany · linkedin.com/in/jordan-ellis-example',
  summary:
    'Marketing coordinator with four years of experience planning campaigns for B2B software brands. Comfortable working across content, events and analytics.',
  roles: [
    {
      title: 'Marketing Coordinator',
      org: 'Brightline Software',
      dates: '2022 – Present',
      bullets: [
        {
          text: 'Planned and launched 12 email campaigns, lifting the average open rate from 21% to 29%.',
        },
        { text: 'Responsible for social media.', flagged: true },
        { text: 'Coordinated three trade-show booths with a team of five.' },
      ],
    },
    {
      title: 'Marketing Assistant',
      org: 'Harbor & Pine Agency',
      dates: '2020 – 2022',
      bullets: [
        { text: 'Helped with various marketing tasks for clients.', flagged: true },
        { text: 'Wrote weekly performance reports for eight client accounts.' },
        { text: 'Worked on the company website.', flagged: true },
      ],
    },
  ],
  education: {
    degree: 'B.A. Media & Communication',
    school: 'Lakeside University',
    dates: '2016 – 2020',
  },
  skills: 'HubSpot · Google Analytics · Copywriting · Canva · Event planning · A/B testing',
};

@Component({
  selector: 'app-showcase',
  imports: [CvPreview, ScoreGauge, ScoreRing],
  templateUrl: './showcase.html',
  styleUrl: './showcase.scss',
})
export class Showcase {
  readonly features = SHOWCASE_FEATURES;
  readonly score = SAMPLE_SCORE;
  readonly cv = SAMPLE_CV;
  readonly intervalMs = SHOWCASE_INTERVAL_MS;

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
