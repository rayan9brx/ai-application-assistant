import { Profile } from './cv-api';

/**
 * Usage limits per plan, shown in the app sidebar's usage card. Change them here.
 * null means unlimited. Display limits, except the Free AI limit on /tailor, which the backend
 * enforces too (app.limits.free-ai-uses-per-month; keep both equal).
 */
export interface PlanLimits {
  /** Saved CVs. */
  cvs: number | null;
  /** AI requests (score, fix, tailor) per calendar month. */
  aiUsesPerMonth: number | null;
}

export const PLAN_LIMITS: Record<Profile['plan'], PlanLimits> = {
  free: { cvs: 3, aiUsesPerMonth: 20 },
  pro: { cvs: null, aiUsesPerMonth: null },
  lifetime: { cvs: null, aiUsesPerMonth: null },
};
