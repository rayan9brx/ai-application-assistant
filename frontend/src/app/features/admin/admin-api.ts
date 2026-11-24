import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Mirrors AdminService's records on the backend. */
export type AdminRange = 'today' | '7d' | '30d' | 'all';

export interface AdminKpis {
  visitors: number;
  pageViews: number;
  signups: number;
  activeUsers: number;
  cvsScored: number;
  averageScore: number | null;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
}
export interface DayPoint {
  day: string;
  visitors: number;
  signups: number;
}
export interface KeyCount {
  key: string;
  count: number;
}
export interface AdminStats {
  range: string;
  from: string;
  kpis: AdminKpis;
  series: DayPoint[];
  topPages: KeyCount[];
  topCountries: KeyCount[];
  topReferrers: KeyCount[];
  devices: KeyCount[];
  funnel: { visitors: number; signups: number; firstScored: number };
}
/** All time. answered[i] / skippedAt[i] are for step i + 1; answers is keyed by DB column. */
export interface AdminOnboardingStats {
  started: number;
  completed: number;
  skipped: number;
  answered: number[];
  skippedAt: number[];
  answers: Record<string, KeyCount[]>;
}
export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  country: string | null;
  plan: string;
  role: string;
  cvCount: number;
}
export interface AdminCv {
  id: string;
  ownerEmail: string | null;
  title: string;
  createdAt: string;
  lastScore: number | null;
}
export interface AdminCvContent {
  id: string;
  ownerEmail: string | null;
  title: string;
  content: { text?: string };
  jobDescription: string | null;
  createdAt: string;
}
export interface AuditEntry {
  id: number;
  createdAt: string;
  adminEmail: string | null;
  cvId: string | null;
  cvTitle: string | null;
  ownerEmail: string | null;
  reason: string;
}

/** /api/admin/**; the backend answers 403 unless the signed-in user is an admin. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  stats(range: AdminRange): Promise<AdminStats> {
    return this.get('/api/admin/stats', { range });
  }
  onboarding(): Promise<AdminOnboardingStats> {
    return this.get('/api/admin/onboarding', {});
  }
  users(q: string, page: number): Promise<AdminPage<AdminUser>> {
    return this.get('/api/admin/users', { q, page });
  }
  cvs(q: string, page: number): Promise<AdminPage<AdminCv>> {
    return this.get('/api/admin/cvs', { q, page });
  }
  /** Saved to the audit log on the server before the content is returned. */
  viewCv(id: string, reason: string): Promise<AdminCvContent> {
    return firstValueFrom(
      this.http.post<AdminCvContent>(`/api/admin/cvs/${encodeURIComponent(id)}/view`, { reason }),
    );
  }
  /** Every page view between the two yyyy-mm-dd dates, inclusive. */
  deletePageViews(from: string, to: string): Promise<{ deleted: number }> {
    return firstValueFrom(
      this.http.delete<{ deleted: number }>('/api/admin/page-views', { params: new HttpParams({ fromObject: { from, to } }) }),
    );
  }
  audit(page: number): Promise<AdminPage<AuditEntry>> {
    return this.get('/api/admin/audit', { page });
  }

  private get<T>(url: string, params: Record<string, string | number>): Promise<T> {
    return firstValueFrom(this.http.get<T>(url, { params: new HttpParams({ fromObject: params }) }));
  }
}

/** 🇩🇪 from "DE"; empty for unknown codes. */
export function flag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function countryName(code: string | null | undefined): string {
  if (!code) return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
