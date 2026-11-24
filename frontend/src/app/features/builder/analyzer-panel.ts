import { Component, inject } from '@angular/core';
import { SectionKind, kindForHeading, sectionInfo } from '../../core/cv-builder';
import { CvIssue, CvScore } from '../../core/cv-flow';
import { ScoreGauge } from '../../shared/score-gauge';
import { ScoreRing } from '../../shared/score-ring';
import { BuilderStore } from './builder-store';

const CATEGORIES: { key: keyof CvScore['categories']; label: string }[] = [
  { key: 'content', label: 'Content' },
  { key: 'format', label: 'Format' },
  { key: 'optimization', label: 'Optimization' },
  { key: 'bestPractices', label: 'Best practices' },
  { key: 'applicationReady', label: 'Application ready' },
];

/** The ATS analysis of the builder's current content; an issue jumps to its section. */
@Component({
  selector: 'app-analyzer-panel',
  imports: [ScoreGauge, ScoreRing],
  template: `
    @let score = store.analysis();
    <section class="card head">
      <div>
        <h3>ATS analysis</h3>
        @if (!score) {
          <p class="muted">Check how recruiters and applicant tracking systems will read this CV.</p>
        } @else if (store.analysisStale()) {
          <p class="muted">Your CV changed since this analysis. Run it again to see the current score.</p>
        } @else {
          <p class="muted">Up to date with your latest changes.</p>
        }
      </div>
      <button type="button" class="accept" [disabled]="store.analyzing()" (click)="store.analyze()">
        {{ store.analyzing() ? 'Analyzing…' : score ? 'Run again' : 'Analyze my CV' }}
      </button>
    </section>

    @if (score) {
      <section class="card overview" [class.stale]="store.analysisStale()">
        <div class="gauge">
          <app-score-gauge [score]="score.overall" />
          <p class="label">{{ score.label }}</p>
        </div>
        <ul class="rings" role="list">
          @for (category of categories; track category.key) {
            <li>
              <app-score-ring class="ring" [value]="score.categories[category.key]" />
              <span>{{ category.label }}</span>
              <span class="sr-only">{{ score.categories[category.key] }} out of 100</span>
            </li>
          }
        </ul>
      </section>

      <section class="card">
        <h3>Issues <span class="muted">({{ store.openIssues().length }} open)</span></h3>
        <ul class="issues" role="list">
          @for (issue of store.openIssues(); track issue.section + issue.problem) {
            <li class="issue">
              <button type="button" class="issue-main" (click)="jump(issue)">
                <span class="pill" [class.bad]="issue.severity === 'high'" [class.warn]="issue.severity === 'medium'"
                  [class.good]="issue.severity === 'low'">{{ issue.severity }}</span>
                <span class="issue-text">
                  <strong>{{ issue.section }}</strong>
                  <span>{{ issue.problem }}</span>
                  <span class="muted">{{ issue.suggestion }}</span>
                </span>
                <span class="go" aria-hidden="true">Go to {{ target(issue).label }} →</span>
              </button>
              <button type="button" class="icon small" aria-label="Mark as done" title="Mark as done" (click)="store.dismiss(issue)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
              </button>
            </li>
          } @empty {
            <li class="muted">No open issues. Nice work!</li>
          }
        </ul>
      </section>
    }
  `,
  styleUrls: ['./builder-panels.scss'],
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .head > div { display: grid; gap: 4px; }
    .overview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); align-items: center; gap: 16px; }
    .overview.stale { opacity: .7; }
    .gauge { display: grid; justify-items: center; gap: 2px; }
    .label { color: var(--text-secondary); font-size: var(--text-sm); font-weight: 600; }
    .rings { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
    .rings li { display: grid; justify-items: center; gap: 6px; color: var(--text-secondary); font-size: 12px; text-align: center; }
    .ring { --ring-font: 13px; width: 52px; height: 52px; }
    .issues { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
    .issue { display: flex; align-items: flex-start; gap: 6px; }
    .issue-main { flex: 1; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; justify-items: start; gap: 4px 10px; min-height: 0; padding: 10px 12px; border: 1px solid var(--border); background: var(--surface-muted); text-align: left; font-weight: 400; }
    .issue-main:hover { border-color: var(--accent); }
    .issue-text { display: grid; gap: 2px; font-size: var(--text-sm); }
    .pill { text-transform: capitalize; }
    .go { grid-column: 2; color: var(--accent); font-size: 12px; font-weight: 600; }
    @media (max-width: 560px) { .overview { grid-template-columns: 1fr; } }
  `,
})
export class AnalyzerPanel {
  readonly store = inject(BuilderStore);
  readonly categories = CATEGORIES;

  target(issue: CvIssue): { kind: SectionKind | 'contact'; label: string } {
    const text = `${issue.section} ${issue.problem}`;
    if (/contact|e-?mail|phone|linkedin|address|name/i.test(issue.section)) {
      return { kind: 'contact', label: 'Contact Information' };
    }
    const kind = kindForHeading(issue.section) ?? kindForHeading(text) ?? 'summary';
    return { kind, label: sectionInfo(kind).label };
  }

  jump(issue: CvIssue): void {
    this.store.jumpTo(this.target(issue).kind);
  }
}
