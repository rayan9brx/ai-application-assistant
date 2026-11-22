import { Injectable, computed, inject, signal } from '@angular/core';
import { CvApi, Profile, Usage } from './cv-api';
import { PLAN_LIMITS } from './plan-limits';

export interface UsageMeter {
  label: string;
  used: number;
  /** null: unlimited. */
  limit: number | null;
  /** 0–100, for the progress bar. */
  percent: number;
}

/** The sidebar's usage card: the plan from /api/me and the counts from /api/me/usage. */
@Injectable({ providedIn: 'root' })
export class UsageStore {
  private readonly api = inject(CvApi);
  readonly plan = signal<Profile['plan'] | null>(null);
  readonly usage = signal<Usage | null>(null);
  private pending: Promise<void> | null = null;

  readonly meters = computed<UsageMeter[]>(() => {
    const usage = this.usage();
    const plan = this.plan();
    if (!usage || !plan) return [];
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const meter = (label: string, used: number, limit: number | null): UsageMeter => ({
      label,
      used,
      limit,
      percent: limit ? Math.min(100, (used / limit) * 100) : 0,
    });
    return [
      meter('CVs', usage.cvs, limits.cvs),
      meter('AI uses this month', usage.aiUsesThisMonth, limits.aiUsesPerMonth),
    ];
  });

  /** Reloads both; overlapping calls share one request. Failures keep the last numbers. */
  refresh(): Promise<void> {
    this.pending ??= Promise.all([this.api.me(), this.api.usage()])
      .then(([profile, usage]) => {
        this.plan.set(profile.plan);
        this.usage.set(usage);
      })
      .catch(() => undefined)
      .finally(() => (this.pending = null));
    return this.pending;
  }

  reset(): void {
    this.plan.set(null);
    this.usage.set(null);
  }
}
