import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { AuthService } from './auth.service';
import { prefersReducedMotion } from './in-view';
import { Logo } from './logo';
import { ScoreGauge } from './score-gauge';
import { ScoreRing } from './score-ring';
import { SkillPill } from './skill-pill';

type DemoTabId = 'checker' | 'fixes' | 'tailor' | 'dashboard';

interface DemoTab {
  id: DemoTabId;
  label: string;
  icon: string;
  /** Section highlighted in the toolbar nav while this tab is open. */
  section: string;
  /** How long (ms) the tab shows its spinner before its animation settles. */
  workingUntil: number;
}

/** A run of CV text; `mark` names a spot the side panel can highlight. */
interface Segment {
  text: string;
  mark?: string;
}

/** Simple 24×24 stroke icons. */
const ICONS = {
  home: 'M3 11l9-7 9 7 M5 10v10h5v-6h4v6h5V10',
  checker: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 14l2 2 4-4',
  fixes:
    'M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  tailor:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  dashboard: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 12h2 M18 12h2 M12 4v2 M12 18v2 M6.3 6.3l1.4 1.4 M16.3 16.3l1.4 1.4 M6.3 17.7l1.4-1.4 M16.3 7.7l1.4-1.4',
  plus: 'M12 5v14 M5 12h14',
  share: 'M12 15V3 M7 8l5-5 5 5 M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  spacing: 'M4 6h16 M4 12h16 M4 18h16',
  template: 'M4 4h16v16H4z M4 9h16 M9 9v11',
  wand: 'M15 4V2 M15 10V8 M11 6h2 M17 6h2 M3 21l12-12',
} as const;

/** Each tab runs on a 7-second timeline; everything animated is derived from elapsed time. */
const DURATION = 7000;

const parse = (source: string): Segment[] =>
  source
    .split(/(\[[^\]]+\])/)
    .filter(Boolean)
    .map((part) => {
      const match = /^\[([^|\]]+)\|([^\]]+)\]$/.exec(part);
      return match ? { text: match[1], mark: match[2] } : { text: part };
    });

const WEAK_BULLET = 'Worked on the company website';
const FIXED_BULLET = 'Redesigned 12 product pages in React, improving mobile conversion by 22%';
/** The real Lumen Labs bullet; the AI Fixes tab swaps in WEAK_BULLET so it has something to rewrite. */
const ORIGINAL_BULLET = 'Maintained the company website and internal tools with JavaScript and PHP';

/** Marks use `[text|id id…]`; ids are the anchors the Checker and Tailor tabs highlight. */
const CV = {
  contact: [
    'Berlin, Germany',
    'jordan.avery@email.com',
    '+49 151 2345 6789',
    'linkedin.com/in/jordanavery',
    'github.com/jordanavery',
  ],
  summary: parse(
    'Frontend developer with 4+ years of experience building fast, accessible web applications with [React|react nextjs], Angular and [TypeScript|ts]. Focused on clean UI, [performance|perf] and measurable business impact. Experienced in [agile teams|scrum] and close collaboration with designers and product managers.',
  ),
  jobs: [
    {
      role: 'Frontend Developer',
      company: 'Northpine GmbH',
      place: 'Berlin',
      dates: '03/2022 – Present',
      bullets: [
        parse('Rebuilt the checkout flow in [React|react] and [TypeScript|ts], increasing conversion by 18%'),
        parse('Reduced [page load time|vitals] by 40% through code splitting, lazy loading and image optimization'),
        parse('Led the migration of 120+ components to TypeScript, cutting runtime errors by 35%'),
        parse('Built a [shared component library|storybook] used by 4 product teams'),
        parse('Mentored 2 junior developers and introduced code review guidelines'),
      ],
    },
    {
      role: 'Junior Web Developer',
      company: 'Brightfield Digital',
      place: 'Hamburg',
      dates: '08/2020 – 02/2022',
      bullets: [
        parse('Developed 15+ responsive landing pages for marketing campaigns with Angular'),
        parse('Introduced [automated UI tests|cicd testing] with Cypress, reducing production bugs by 30%'),
        parse('Integrated [REST APIs|rest] for a customer dashboard used by 10,000+ users'),
        parse('Collaborated with UX designers to improve accessibility to [WCAG 2.1 AA|wcag]'),
      ],
    },
    {
      role: 'Working Student, Web Development',
      company: 'Lumen Labs',
      place: 'Berlin',
      dates: '10/2018 – 07/2020',
      bullets: [null, parse('Automated weekly reporting, saving the team ~5 hours per week')],
    },
  ],
  projects: [
    { name: 'TaskFlow', text: 'Open-source Kanban app (Angular, Firebase) · 300+ GitHub stars' },
    { name: 'WeatherNow', text: 'PWA with offline support (React, Service Workers)' },
  ],
  education: {
    degree: 'B.Sc. Computer Science',
    school: 'Technische Universität Berlin',
    dates: '2016 – 2020',
    note: 'Thesis: Performance optimization of single-page applications (Grade: 1.7)',
  },
  skills: [
    { label: 'Frontend', text: 'React, Angular, TypeScript, JavaScript, HTML, CSS, Tailwind CSS' },
    { label: 'Tools', text: 'Git, Jest, Cypress, Webpack, Vite, Figma, Jira' },
    { label: 'Backend & APIs', text: 'REST, GraphQL, Node.js, basic Spring Boot' },
  ],
  languages: 'German (native) · English (C1) · French (B1)',
  certifications: 'AWS Certified Cloud Practitioner (2023) · Google UX Design Certificate (2022)',
};

/** CV Checker: missing keywords, highlighted at the CV phrase each one belongs next to. */
const MISSING = [
  { label: 'Next.js', anchor: 'nextjs' },
  { label: 'Scrum', anchor: 'scrum' },
  { label: 'Core Web Vitals', anchor: 'vitals' },
  { label: 'Storybook', anchor: 'storybook' },
  { label: 'CI/CD', anchor: 'cicd' },
];
const missingAt = (i: number) => 1600 + i * 500;

/** Tailor to Job: required skills that flip from missing to matched, highlighted where the CV proves them. */
const REQUIRED = [
  { label: 'React', anchor: 'react' },
  { label: 'TypeScript', anchor: 'ts' },
  { label: 'Unit testing', anchor: 'testing' },
  { label: 'Accessibility', anchor: 'wcag' },
  { label: 'Performance', anchor: 'perf' },
  { label: 'REST APIs', anchor: 'rest' },
];
const flipAt = (i: number) => 1800 + i * 420;

/** AI Fixes timeline (ms). */
const FIX = { cursorIn: 200, select: 1100, write: 1300, type: 2500, typed: 4500, applied: 4700 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - (1 - v) ** 3;
const easeInOut = (v: number) => (v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2);

/** Homepage "product demo window": a fake desktop app that cycles through what ApplyCraft does. */
@Component({
  selector: 'app-demo-window',
  imports: [DecimalPipe, Logo, NgTemplateOutlet, ScoreGauge, ScoreRing, SkillPill],
  templateUrl: './demo-window.html',
  styleUrls: ['./demo-window.scss', './demo-window-cv.scss', './demo-window-panels.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoWindow {
  readonly startHref = inject(AuthService).startHref;
  readonly icons = ICONS;
  readonly cv = CV;
  readonly weakBullet = WEAK_BULLET;
  readonly originalBullet = ORIGINAL_BULLET;
  readonly fixedBullet = FIXED_BULLET;
  readonly autoplay = !prefersReducedMotion();

  readonly tabs: DemoTab[] = [
    { id: 'checker', label: 'CV Checker', icon: ICONS.checker, section: 'Contact', workingUntil: 4000 },
    { id: 'fixes', label: 'AI Fixes', icon: ICONS.fixes, section: 'Experience', workingUntil: FIX.applied },
    { id: 'tailor', label: 'Tailor to Job', icon: ICONS.tailor, section: 'Skills', workingUntil: 4400 },
    { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, section: 'Summary', workingUntil: 2200 },
  ];
  readonly sidebar = [
    { key: 'home', icon: ICONS.home },
    ...this.tabs.map((tab) => ({ key: tab.id, icon: tab.icon })),
  ];
  readonly sections = ['Contact', 'Experience', 'Projects', 'Education', 'Skills', 'Summary'];

  readonly active = signal(0);
  /** Milliseconds into the active tab's timeline. Reduced motion pins it to the end state. */
  readonly elapsed = signal(this.autoplay ? 0 : DURATION);
  readonly hovered = signal(false);

  readonly tab = computed(() => this.tabs[this.active()]);
  readonly progress = computed(() => clamp(this.elapsed() / DURATION));

  // ---- CV Checker ----
  readonly categories = [
    { label: 'Content', value: 71 },
    { label: 'Format', value: 58 },
    { label: 'Keywords', value: 44 },
    { label: 'Impact', value: 66 },
  ];
  readonly missing = MISSING;
  readonly score = computed(() => Math.round(62 * this.ease(0, 1800)));
  readonly ringScale = computed(() => this.ease(300, 1400));

  // ---- AI Fixes ----
  readonly upNext = [
    { title: 'No measurable result', where: 'Developed 15+ responsive landing pages…', severity: 'Medium' },
    { title: 'Missing keyword: CI/CD', where: 'Skills', severity: 'Medium' },
    { title: 'Summary could be shorter', where: 'Summary', severity: 'Low' },
  ];
  readonly fixStage = computed(() => {
    const t = this.elapsed();
    if (t < FIX.select) return 'idle';
    if (t < FIX.type) return 'writing';
    if (t < FIX.typed) return 'typing';
    return 'done';
  });
  readonly typed = computed(() =>
    FIXED_BULLET.slice(0, Math.round(FIXED_BULLET.length * clamp((this.elapsed() - FIX.type) / (FIX.typed - FIX.type)))),
  );
  /** The first Lumen Labs bullet: its real text, except in AI Fixes where it starts weak and gets rewritten. */
  readonly bulletState = computed<'original' | 'weak' | 'target' | 'fixed'>(() => {
    if (this.tab().id !== 'fixes') return 'original';
    const t = this.elapsed();
    return t >= FIX.applied ? 'fixed' : t >= FIX.select ? 'target' : 'weak';
  });
  readonly cursor = computed(() => {
    const t = this.elapsed();
    const p = easeInOut(clamp((t - FIX.cursorIn) / (FIX.select - FIX.cursorIn - 100)));
    const fade = t < 400 ? clamp((t - FIX.cursorIn) / 200) : 1 - clamp((t - 5200) / 300);
    return {
      transform: `translate(${(1 - p) * 220}px, ${(1 - p) * 150}px)`,
      opacity: fade,
      clicking: t >= FIX.select && t < FIX.select + 350,
    };
  });

  // ---- Tailor to Job ----
  readonly required = REQUIRED;
  readonly criteria = [
    { label: 'React', value: 96 },
    { label: 'TypeScript', value: 92 },
    { label: 'Testing', value: 74 },
    { label: 'Accessibility', value: 68 },
  ];
  readonly match = computed(() => Math.round(47 + 42 * this.ease(600, 3000)));

  // ---- Dashboard ----
  readonly savedCvs = [
    { title: 'Frontend – Lumen Labs', edited: '2h ago', status: 'Interviewing', from: 62, score: 89 },
    { title: 'General CV', edited: 'yesterday', status: 'Draft', from: 62, score: 62 },
    { title: 'Werkstudent – Voltaris Energy', edited: '3 days ago', status: 'Applied', from: 78, score: 78 },
    { title: 'Internship 2025', edited: 'last week', status: 'Applied', from: 71, score: 71 },
  ];
  readonly toastIn = computed(() => this.elapsed() >= 900);

  private readonly tabBar = viewChild.required<ElementRef<HTMLElement>>('tabBar');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.autoplay) return;
      let inView = true;
      const observer =
        typeof IntersectionObserver === 'undefined'
          ? null
          : new IntersectionObserver(([entry]) => (inView = entry.isIntersecting), { threshold: 0.15 });
      observer?.observe(this.host.nativeElement);

      let frame = 0;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(now - last, 100);
        last = now;
        if (inView && !this.hovered()) {
          const next = this.elapsed() + dt;
          if (next >= DURATION) this.select((this.active() + 1) % this.tabs.length);
          else this.elapsed.set(next);
        }
        frame = requestAnimationFrame(tick);
      };
      zone.runOutsideAngular(() => (frame = requestAnimationFrame(tick)));
      destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
      });
    });
  }

  /** 0 → 1 eased between `start` and `start + duration` on the active tab's timeline. */
  ease(start: number, duration: number): number {
    return easeOut(clamp((this.elapsed() - start) / duration));
  }

  after(ms: number): boolean {
    return this.elapsed() >= ms;
  }

  working(index: number): boolean {
    return this.autoplay && index === this.active() && this.elapsed() < this.tabs[index].workingUntil;
  }

  /** Highlight for a marked CV spot: yellow while the checker lists it, green once tailoring matches it. */
  markTone(mark: string | undefined): 'warn' | 'ok' | null {
    if (!mark) return null;
    const ids = mark.split(' ');
    const id = this.tab().id;
    if (id === 'checker') {
      const i = MISSING.findIndex((k) => ids.includes(k.anchor));
      return i >= 0 && this.after(missingAt(i)) ? 'warn' : null;
    }
    if (id === 'tailor') {
      const i = REQUIRED.findIndex((k) => ids.includes(k.anchor));
      return i >= 0 && this.after(flipAt(i)) ? 'ok' : null;
    }
    return null;
  }

  missingShown(index: number): boolean {
    return this.after(missingAt(index));
  }

  matched(index: number): boolean {
    return this.after(flipAt(index));
  }

  cardScore(cv: { from: number; score: number }): number {
    return Math.round(cv.from + (cv.score - cv.from) * this.ease(1000, 1200));
  }

  /** Switches tab and restarts its timeline. */
  select(index: number): void {
    this.active.set(index);
    this.elapsed.set(this.autoplay ? 0 : DURATION);
    this.revealTab(index);
  }

  /** Arrow keys move between tabs, following the WAI-ARIA tabs pattern. */
  onTabKey(event: KeyboardEvent): void {
    const count = this.tabs.length;
    const moves: Record<string, number> = {
      ArrowRight: (this.active() + 1) % count,
      ArrowLeft: (this.active() - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.select(next);
    this.tabBar().nativeElement.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  /** Scrolls only the tab strip (never the page) so the active tab stays visible on mobile. */
  private revealTab(index: number): void {
    const bar = this.tabBar().nativeElement;
    if (bar.scrollWidth <= bar.clientWidth) return;
    const tab = bar.querySelectorAll<HTMLElement>('[role="tab"]')[index];
    if (!tab) return;
    bar.scrollTo({
      left: tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2,
      behavior: this.autoplay ? 'smooth' : 'auto',
    });
  }
}
