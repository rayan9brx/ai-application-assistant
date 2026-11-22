import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApi, AdminRange, AdminStats, KeyCount, countryName, flag } from './admin-api';
import { AdminLineChart } from './admin-line-chart';
import { CvFlow } from './cv-flow';
import { ONBOARDING_ANSWER_LABELS } from './onboarding-options';

const RANGES: { id: AdminRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
];

/** Overview tab: KPIs, visitors/sign-ups chart, top lists, devices and the conversion funnel. */
@Component({
  selector: 'app-admin-overview',
  imports: [AdminLineChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="ranges" role="group" aria-label="Date range">
        @for (r of ranges; track r.id) {
          <button type="button" [attr.aria-pressed]="range() === r.id" (click)="load(r.id)">{{ r.label }}</button>
        }
      </div>
      @if (loading()) { <span class="muted" role="status">Loading…</span> }
    </div>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    @if (stats(); as s) {
      <ul class="kpis" role="list">
        <li><span>Visitors</span><strong>{{ n(s.kpis.visitors) }}</strong><small>unique per day</small></li>
        <li><span>Page views</span><strong>{{ n(s.kpis.pageViews) }}</strong></li>
        <li><span>New sign-ups</span><strong>{{ n(s.kpis.signups) }}</strong></li>
        <li><span>Active users</span><strong>{{ n(s.kpis.activeUsers) }}</strong><small>logged in or scored</small></li>
        <li><span>CVs scored</span><strong>{{ n(s.kpis.cvsScored) }}</strong></li>
        <li><span>Average score</span><strong>{{ s.kpis.averageScore ?? '–' }}</strong></li>
        <li><span>AI calls</span><strong>{{ n(s.kpis.aiCalls) }}</strong>
          <small>{{ n(s.kpis.inputTokens) }} in · {{ n(s.kpis.outputTokens) }} out tokens</small></li>
        <li><span>Est. AI cost</span><strong>{{ usd(s.kpis.aiCostUsd) }}</strong><small>at list prices</small></li>
      </ul>

      <section class="panel chart" aria-labelledby="chart-title">
        <h2 id="chart-title">Visitors and sign-ups per day</h2>
        <app-admin-line-chart [series]="s.series" />
      </section>

      <section class="panel" aria-labelledby="funnel-title">
        <h2 id="funnel-title">Conversion funnel</h2>
        <ol class="funnel">
          @for (step of funnel(); track step.label) {
            <li>
              <span class="step-label">{{ step.label }}</span>
              <span class="step-bar"><span [style.width.%]="step.width"></span></span>
              <span class="step-value">{{ n(step.value) }}</span>
              <span class="step-rate">{{ step.rate }}</span>
            </li>
          }
        </ol>
      </section>

      <div class="grid">
        <section class="panel" aria-labelledby="pages-title">
          <h2 id="pages-title">Top pages <span class="muted">views</span></h2>
          @if (!s.topPages.length) { <p class="muted">No page views yet.</p> }
          <ul class="bars" role="list">
            @for (row of s.topPages; track row.key) {
              <li><span class="ellipsis" [title]="row.key">{{ row.key }}</span>
                <span class="bar"><span [style.width.%]="share(row, s.topPages)"></span></span><b>{{ n(row.count) }}</b></li>
            }
          </ul>
        </section>

        <section class="panel" aria-labelledby="countries-title">
          <h2 id="countries-title">Top countries <span class="muted">visitors</span></h2>
          @if (!s.topCountries.length) { <p class="muted">No visitors yet.</p> }
          <table>
            <tbody>
              @for (row of s.topCountries; track row.key) {
                <tr>
                  <td><span class="flag" aria-hidden="true">{{ flag(row.key) || '🌐' }}</span>{{ country(row.key) }}</td>
                  <td class="num">{{ n(row.count) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        <section class="panel" aria-labelledby="referrers-title">
          <h2 id="referrers-title">Top referrers <span class="muted">visitors</span></h2>
          @if (!s.topReferrers.length) { <p class="muted">No referrals yet; direct visits aren't listed.</p> }
          <ul class="bars" role="list">
            @for (row of s.topReferrers; track row.key) {
              <li><span class="ellipsis" [title]="row.key">{{ row.key }}</span>
                <span class="bar"><span [style.width.%]="share(row, s.topReferrers)"></span></span><b>{{ n(row.count) }}</b></li>
            }
          </ul>
        </section>

        <section class="panel" aria-labelledby="devices-title">
          <h2 id="devices-title">Mobile vs desktop <span class="muted">visitors</span></h2>
          @if (devices(); as d) {
            <div class="split" role="img" [attr.aria-label]="d.mobile + '% mobile, ' + d.desktop + '% desktop'">
              <span class="mobile" [style.width.%]="d.mobile"></span><span class="desktop" [style.width.%]="d.desktop"></span>
            </div>
            <p class="split-legend"><span><i class="mobile"></i>Mobile {{ d.mobile }}%</span>
              <span><i class="desktop"></i>Desktop {{ d.desktop }}%</span></p>
          } @else {
            <p class="muted">No visitors yet.</p>
          }
        </section>

        <section class="panel" aria-labelledby="onboarding-title">
          <h2 id="onboarding-title">Onboarding answers <span class="muted">users, all time</span></h2>
          @if (!s.onboardingAnswers.length) { <p class="muted">No answers yet.</p> }
          <ul class="bars" role="list">
            @for (row of onboarding(); track row.key) {
              <li><span class="ellipsis" [title]="row.label">{{ row.label }}</span>
                <span class="bar"><span [style.width.%]="share(row, onboarding())"></span></span><b>{{ n(row.count) }}</b></li>
            }
          </ul>
        </section>
      </div>
    }
  `,
  styleUrls: ['./admin.scss', './admin-overview.scss'],
})
export class AdminOverview {
  private readonly api = inject(AdminApi);
  readonly ranges = RANGES;
  readonly range = signal<AdminRange>('30d');
  readonly stats = signal<AdminStats | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly flag = flag;
  readonly country = (code: string) => countryName(code || null);
  private request = 0;

  readonly funnel = computed(() => {
    const f = this.stats()?.funnel;
    if (!f) return [];
    const top = Math.max(1, f.visitors);
    const rate = (value: number, of: number) => (of ? `${Math.round((value / of) * 1000) / 10}%` : '–');
    return [
      { label: 'Visitors', value: f.visitors, width: 100, rate: '' },
      { label: 'Sign-ups', value: f.signups, width: (f.signups / top) * 100, rate: rate(f.signups, f.visitors) },
      { label: 'First CV scored', value: f.firstScored, width: (f.firstScored / top) * 100, rate: rate(f.firstScored, f.signups) },
    ];
  });

  /** Every answer in a fixed order, with zero counts, once anyone has answered. */
  readonly onboarding = computed(() => {
    const rows = this.stats()?.onboardingAnswers ?? [];
    if (!rows.length) return [];
    return Object.entries(ONBOARDING_ANSWER_LABELS).map(([key, label]) => ({
      key,
      label,
      count: rows.find((r) => r.key === key)?.count ?? 0,
    }));
  });

  readonly devices = computed(() => {
    const rows = this.stats()?.devices ?? [];
    const mobile = rows.find((r) => r.key === 'mobile')?.count ?? 0;
    const desktop = rows.find((r) => r.key === 'desktop')?.count ?? 0;
    if (!mobile && !desktop) return null;
    const m = Math.round((mobile / (mobile + desktop)) * 100);
    return { mobile: m, desktop: 100 - m };
  });

  constructor() {
    void this.load('30d');
  }

  async load(range: AdminRange): Promise<void> {
    this.range.set(range);
    this.loading.set(true);
    this.error.set('');
    const id = ++this.request;
    try {
      const stats = await this.api.stats(range);
      if (id === this.request) this.stats.set(stats);
    } catch (error) {
      if (id === this.request) this.error.set(CvFlow.message(error, 'The statistics couldn’t be loaded.'));
    } finally {
      if (id === this.request) this.loading.set(false);
    }
  }

  share(row: KeyCount, rows: KeyCount[]): number {
    return (row.count / Math.max(1, ...rows.map((r) => r.count))) * 100;
  }

  n(value: number): string {
    return new Intl.NumberFormat('en').format(value);
  }

  usd(value: number): string {
    return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(value);
  }
}
