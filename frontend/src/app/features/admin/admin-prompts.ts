import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApi, PromptInsights } from './admin-api';
import { CvFlow } from '../../core/cv-flow';
import { PromptRoute } from '../../core/prompt-router';

const ROUTES: { key: PromptRoute; label: string }[] = [
  { key: 'score', label: 'Score / ATS check' },
  { key: 'tailor', label: 'Tailor to a job' },
  { key: 'fix', label: 'Fix / improve' },
  { key: 'build', label: 'Build a new CV' },
  { key: 'other', label: 'Other' },
];

/** "What users ask for": smart-prompt requests per detected route and the 20 latest. */
@Component({
  selector: 'app-admin-prompts',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <span class="muted">Last 90 days · {{ n(insights()?.total ?? 0) }} prompts · texts cut to 300 characters</span>
      @if (loading()) { <span class="muted" role="status">Loading…</span> }
    </div>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    @if (insights(); as s) {
      <div class="grid">
        <section class="panel" aria-labelledby="ask-routes-title">
          <h2 id="ask-routes-title">What users ask for <span class="muted">prompts per route</span></h2>
          @if (!s.total) { <p class="muted">No prompts yet.</p> }
          @else {
            <ul class="bars" role="list">
              @for (row of rows(); track row.key) {
                <li><span class="ellipsis">{{ row.label }}</span>
                  <span class="bar"><span [style.width.%]="(row.count / max()) * 100"></span></span><b>{{ n(row.count) }}</b></li>
              }
            </ul>
          }
        </section>

        <section class="panel" aria-labelledby="ask-recent-title">
          <h2 id="ask-recent-title">Latest prompts <span class="muted">newest first</span></h2>
          @if (!s.recent.length) { <p class="muted">No prompts yet.</p> }
          @else {
            <ol class="recent" role="list">
              @for (p of s.recent; track $index) {
                <li>
                  <p class="prompt-text">{{ p.text || '(file only, no text)' }}</p>
                  <p class="meta">
                    <span class="badge">{{ label(p.route) }}</span>
                    <span>{{ p.signedIn ? 'Signed in' : 'Guest' }}</span>
                    <span>{{ p.createdAt | date: 'short' }}</span>
                  </p>
                </li>
              }
            </ol>
          }
        </section>
      </div>
    }
  `,
  styleUrls: ['./admin.scss', './admin-overview.scss'],
  styles: `
    .recent { display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
    .recent li { padding-bottom: var(--space-3); border-bottom: 1px solid var(--border); }
    .recent li:last-child { padding-bottom: 0; border-bottom: 0; }
    .prompt-text { font-size: var(--text-sm); overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: 4px; color: var(--text-secondary); font-size: 12px; }
    @media (max-width: 860px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class AdminPrompts {
  private readonly api = inject(AdminApi);
  readonly insights = signal<PromptInsights | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  /** Every route, with zero counts, in a fixed order. */
  readonly rows = computed(() => {
    const counts = this.insights()?.routes ?? [];
    return ROUTES.map((r) => ({ ...r, count: counts.find((c) => c.key === r.key)?.count ?? 0 }));
  });
  readonly max = computed(() => Math.max(1, ...this.rows().map((r) => r.count)));

  constructor() {
    this.api.prompts().then(
      (insights) => {
        this.insights.set(insights);
        this.loading.set(false);
      },
      (error) => {
        this.error.set(CvFlow.message(error, 'The prompts couldn’t be loaded.'));
        this.loading.set(false);
      },
    );
  }

  label(route: string): string {
    return ROUTES.find((r) => r.key === route)?.label ?? route;
  }

  n(value: number): string {
    return new Intl.NumberFormat('en').format(value);
  }
}
