import { Component, computed, inject, signal } from '@angular/core';
import { CvChange } from '../../core/cv-flow';
import { ScoreRing } from '../../shared/score-ring';
import { BuilderStore } from './builder-store';

/** Paste a job description, see the match and the keywords, and tailor the CV with AI. */
@Component({
  selector: 'app-job-matcher-panel',
  imports: [ScoreRing],
  template: `
    @let match = jobMatch();
    <section class="card tailored">
      <div>
        <h3>Applying for a specific job?</h3>
        <p class="muted">Keep this CV as it is and make a tailored copy for the job ad, with every change for you to review.</p>
      </div>
      <a class="cta cta-small" [href]="'/tailor?cv=' + store.id()">Create tailored version ✨</a>
    </section>

    <section class="card">
      <label>
        <span>Job description</span>
        <textarea rows="8" maxlength="15000" placeholder="Paste the job ad here…" [value]="store.jobDescription()"
          (input)="store.setJobDescription(value($event))"></textarea>
      </label>
      <div class="row">
        <button type="button" class="accept" [disabled]="!store.jobDescription().trim() || store.analyzing()"
          (click)="store.analyze()">
          {{ store.analyzing() ? 'Checking…' : match ? 'Check match again' : 'Check match' }}
        </button>
        <button type="button" class="ai" [disabled]="!store.jobDescription().trim() || store.tailoringBusy()"
          (click)="store.tailor()">
          {{ store.tailoringBusy() ? 'Tailoring…' : '✨ Tailor with AI' }}
        </button>
      </div>
    </section>

    @if (match) {
      <section class="card match" [class.stale]="store.analysisStale()">
        <div class="percent">
          <app-score-ring class="ring" [value]="match.matchPercent" suffix="%" />
          <div>
            <h3>Job match</h3>
            <p class="muted">
              {{ store.analysisStale() ? 'Your CV or the job changed since this check.' : 'How well your real experience covers the job’s requirements.' }}
            </p>
          </div>
        </div>
        <div class="keywords">
          <h4>Matched keywords</h4>
          <ul role="list">
            @for (word of match.matchedKeywords; track word) {
              <li class="pill good">{{ word }}</li>
            } @empty {
              <li class="muted">None yet</li>
            }
          </ul>
        </div>
        <div class="keywords">
          <h4>Missing keywords</h4>
          <ul role="list">
            @for (word of match.missingKeywords; track word) {
              <li class="pill bad">{{ word }}</li>
            } @empty {
              <li class="muted">None — great coverage</li>
            }
          </ul>
          <p class="muted">Add a missing keyword only if it’s really true for you.</p>
        </div>
      </section>
    }

    @if (store.tailoring(); as tailoring) {
      <section class="card">
        <h3>Suggested changes</h3>
        <ul class="changes" role="list">
          @for (change of tailoring.changes; track $index) {
            <li class="change">
              <p class="section">{{ change.section }}</p>
              <p class="before"><span class="sr-only">Before: </span>{{ change.original }}</p>
              <p class="after"><span class="sr-only">After: </span>{{ change.replacement }}</p>
              <p class="muted">{{ change.reason }}</p>
              @if (store.applied().has(change)) {
                <span class="pill good">Applied ✓</span>
              } @else if (missing().has(change)) {
                <span class="pill warn">This line changed in the editor; edit it by hand.</span>
              } @else {
                <button type="button" class="plain" (click)="apply(change)">Apply</button>
              }
            </li>
          } @empty {
            <li class="muted">No changes needed — your CV already fits this job well.</li>
          }
        </ul>
        @if (tailoring.notes.length) {
          <h4>Notes</h4>
          <ul class="notes">
            @for (note of tailoring.notes; track $index) {
              <li>{{ note }}</li>
            }
          </ul>
        }
      </section>
    }
  `,
  styleUrls: ['./builder-panels.scss'],
  styles: `
    .card { display: grid; gap: 12px; }
    .tailored { justify-items: start; border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: var(--accent-soft); }
    .tailored h3 { margin-bottom: 4px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; }
    .row .ai { min-height: 34px; padding: 6px 14px; font-size: var(--text-sm); }
    .match.stale { opacity: .7; }
    .percent { display: flex; align-items: center; gap: 14px; }
    .ring { --ring-font: 14px; width: 64px; height: 64px; }
    .percent div { display: grid; gap: 2px; }
    h4 { margin: 0 0 6px; color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .keywords ul { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 6px; padding: 0; list-style: none; }
    .changes { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .change { display: grid; justify-items: start; gap: 6px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-muted); font-size: var(--text-sm); }
    .section { color: var(--text-secondary); font-size: 12px; font-weight: 600; }
    .before { color: var(--text-muted); text-decoration: line-through; }
    .after { color: var(--text); }
    .notes { display: grid; gap: 4px; margin: 0; padding-left: 18px; color: var(--text-secondary); font-size: var(--text-sm); }
  `,
})
export class JobMatcherPanel {
  readonly store = inject(BuilderStore);
  readonly missing = signal<ReadonlySet<CvChange>>(new Set());
  readonly jobMatch = computed(() => {
    const match = this.store.analysis()?.jobMatch;
    return match && (match.matchedKeywords.length || match.missingKeywords.length || match.matchPercent) ? match : null;
  });

  value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  apply(change: CvChange): void {
    if (!this.store.applyChange(change)) this.missing.update((set) => new Set(set).add(change));
  }
}
