import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApi, AdminOnboardingStats } from './admin-api';
import { CvFlow } from './cv-flow';
import { ONBOARDING_STEPS } from './onboarding-options';

interface Row {
  key: string;
  label: string;
  count: number;
}

/** Onboarding tab: completion, drop-off per step and the count per option of every question. */
@Component({
  selector: 'app-admin-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <span class="muted">All time</span>
      @if (loading()) { <span class="muted" role="status">Loading…</span> }
    </div>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    @if (stats(); as s) {
      <ul class="kpis" role="list">
        <li><span>Started</span><strong>{{ n(s.started) }}</strong><small>answered at least one step</small></li>
        <li><span>Completed</span><strong>{{ n(s.completed) }}</strong><small>{{ rate(s.completed, s.started) }} of started</small></li>
        <li><span>Skipped</span><strong>{{ n(s.skipped) }}</strong><small>{{ rate(s.skipped, s.started) }} of started</small></li>
      </ul>

      <section class="panel" aria-labelledby="dropoff-title">
        <h2 id="dropoff-title">Drop-off per step <span class="muted">users who answered · skipped here</span></h2>
        <ol class="funnel">
          @for (step of dropOff(); track step.label) {
            <li>
              <span class="step-label" [title]="step.title">{{ step.label }}</span>
              <span class="step-bar"><span [style.width.%]="step.width"></span></span>
              <span class="step-value">{{ n(step.value) }}</span>
              <span class="step-rate">{{ step.skipped ? n(step.skipped) + ' skipped' : '' }}</span>
            </li>
          }
        </ol>
      </section>

      <div class="grid">
        @for (q of questions(); track q.title) {
          <section class="panel" [attr.aria-label]="q.title">
            <h2>{{ q.title }} <span class="muted">{{ q.unit }}</span></h2>
            @if (!q.total) { <p class="muted">No answers yet.</p> }
            @else {
              <ul class="bars" role="list">
                @for (row of q.rows; track row.key) {
                  <li><span class="ellipsis" [title]="row.label">{{ row.label }}</span>
                    <span class="bar"><span [style.width.%]="(row.count / q.max) * 100"></span></span><b>{{ n(row.count) }}</b></li>
                }
              </ul>
            }
          </section>
        }
      </div>
    }
  `,
  styleUrls: ['./admin.scss', './admin-overview.scss'],
})
export class AdminOnboarding {
  private readonly api = inject(AdminApi);
  readonly stats = signal<AdminOnboardingStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly dropOff = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const top = Math.max(1, s.started);
    return ONBOARDING_STEPS.map((step, i) => ({
      label: `${i + 1}. ${step.short}`,
      title: step.title,
      value: s.answered[i] ?? 0,
      skipped: s.skippedAt[i] ?? 0,
      width: ((s.answered[i] ?? 0) / top) * 100,
    }));
  });

  /** Every option in the flow's order, with zero counts; locations as the top typed values. */
  readonly questions = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return ONBOARDING_STEPS.map((step) => {
      const counts = s.answers[step.column] ?? [];
      const rows: Row[] =
        step.kind === 'chips'
          ? counts.map((c) => ({ key: c.key, label: c.key, count: c.count }))
          : step.options.map((o) => ({
              key: o.key,
              label: o.label,
              count: counts.find((c) => c.key === o.key)?.count ?? 0,
            }));
      return {
        title: step.short,
        unit: step.kind === 'single' || step.kind === 'pills' ? 'users' : 'mentions',
        rows,
        total: rows.reduce((sum, r) => sum + r.count, 0),
        max: Math.max(1, ...rows.map((r) => r.count)),
      };
    });
  });

  constructor() {
    this.api.onboarding().then(
      (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      (error) => {
        this.error.set(CvFlow.message(error, 'The onboarding statistics couldn’t be loaded.'));
        this.loading.set(false);
      },
    );
  }

  rate(value: number, of: number): string {
    return of ? `${Math.round((value / of) * 1000) / 10}%` : '–';
  }

  n(value: number): string {
    return new Intl.NumberFormat('en').format(value);
  }
}
