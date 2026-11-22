import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { prefersReducedMotion } from './in-view';
import { ScoreGauge } from './score-gauge';
import { ScoreRing } from './score-ring';
import { SkillPill } from './skill-pill';

type DemoTabId = 'checker' | 'fixes' | 'tailor' | 'dashboard';

interface DemoTab {
  id: DemoTabId;
  label: string;
  icon: string;
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
} as const;

const AUTOPLAY_MS = 5000;

/** Homepage "product demo window": a fake desktop app that cycles through what ApplyCraft does. */
@Component({
  selector: 'app-demo-window',
  imports: [ScoreGauge, ScoreRing, SkillPill],
  templateUrl: './demo-window.html',
  styleUrls: ['./demo-window.scss', './demo-window-panels.scss'],
  host: { '[style.--demo-duration]': "autoplayMs + 'ms'" },
})
export class DemoWindow {
  readonly icons = ICONS;
  readonly autoplayMs = AUTOPLAY_MS;
  readonly autoplay = !prefersReducedMotion();

  readonly tabs: DemoTab[] = [
    { id: 'checker', label: 'CV Checker', icon: ICONS.checker },
    { id: 'fixes', label: 'AI Fixes', icon: ICONS.fixes },
    { id: 'tailor', label: 'Tailor to Job', icon: ICONS.tailor },
    { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  ];
  readonly sidebar = [
    { key: 'home', icon: ICONS.home },
    ...this.tabs.map((tab) => ({ key: tab.id, icon: tab.icon })),
  ];

  readonly active = signal(0);
  /** Bumped whenever the timer restarts, so the progress line re-mounts and starts from zero. */
  readonly cycle = signal(0);
  readonly hovered = signal(false);
  readonly fixDecision = signal<'accepted' | 'rejected' | null>(null);

  private readonly tabBar = viewChild.required<ElementRef<HTMLElement>>('tabBar');

  readonly categories = [
    { label: 'Content', value: 71 },
    { label: 'Format', value: 58 },
    { label: 'Keywords', value: 44 },
    { label: 'Impact', value: 66 },
  ];
  readonly missingKeywords = [
    'Design systems',
    'A/B testing',
    'Figma prototyping',
    'Accessibility (WCAG)',
    'Stakeholder management',
  ];
  readonly issues = [
    { title: 'Weak action verb', where: 'Experience · Northpine', severity: 'High' },
    { title: 'No measurable result', where: 'Experience · Brightfield', severity: 'High' },
    { title: 'Passive voice', where: 'Summary', severity: 'Medium' },
    { title: 'Vague skills list', where: 'Skills', severity: 'Low' },
  ];
  readonly criteria = [
    { label: 'Hard skills', value: 92 },
    { label: 'Keywords', value: 88 },
    { label: 'Experience', value: 85 },
    { label: 'Soft skills', value: 79 },
    { label: 'Education', value: 100 },
  ];
  readonly savedCvs = [
    { title: 'Senior Product Designer – Lumen Labs', score: 89, edited: '2 hours ago' },
    { title: 'UX Lead – Northpine', score: 74, edited: 'Yesterday' },
    { title: 'Design Systems – Halcyon Studio', score: 62, edited: 'Nov 14' },
    { title: 'General CV', score: 55, edited: 'Oct 30' },
  ];

  /** Switches tab and restarts the 5-second timer. */
  select(index: number): void {
    this.active.set(index);
    this.cycle.update((c) => c + 1);
    this.revealTab(index);
  }

  /** Called when the progress line finishes filling. */
  advance(): void {
    if (!this.autoplay) return;
    this.select((this.active() + 1) % this.tabs.length);
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
