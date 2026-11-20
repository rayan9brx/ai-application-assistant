import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Mirrors the backend's CvAnalysis records. */
export interface CvField {
  detected: boolean;
  detail: string;
}
export interface CvIssue {
  section: string;
  problem: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}
export interface CvScore {
  overall: number;
  label: 'Needs improvement' | 'Good' | 'Excellent';
  categories: {
    content: number;
    format: number;
    optimization: number;
    bestPractices: number;
    applicationReady: number;
  };
  fields: Record<'name' | 'contact' | 'experience' | 'education' | 'skills', CvField>;
  jobMatch?: { matchPercent: number; matchedKeywords: string[]; missingKeywords: string[] };
  issues: CvIssue[];
}
export interface CvFix {
  original: string;
  replacement: string;
  explanation: string;
  needsUserInput: boolean;
  found: boolean;
}
export interface CvChange {
  section: string;
  original: string;
  replacement: string;
  reason: string;
}
export interface CvTailoring {
  changes: CvChange[];
  notes: string[];
}

export type FlowPhase = 'input' | 'reading' | 'scoring' | 'results';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const STORAGE_KEY = 'applycraft.cv-check.v1';

/** What survives a page refresh. */
interface SavedFlow {
  cvText: string;
  jobDescription: string;
  score: CvScore;
  previousOverall: number | null;
  stale: boolean;
  tailoring: CvTailoring | null;
  savedCvId?: string | null;
}

/**
 * State and server calls for Upload → Score → Fix → Download. The server is stateless: it parses
 * and analyses each request in memory and keeps nothing, so all state lives here in the browser.
 * Results are mirrored to localStorage (this device only) so a refresh doesn't lose progress;
 * "Start over" clears them. Signed-in users can also save the CV to their account (CvLibrary).
 */
@Injectable({ providedIn: 'root' })
export class CvFlow {
  private readonly http = inject(HttpClient);

  readonly phase = signal<FlowPhase>('input');
  readonly cvText = signal('');
  readonly jobDescription = signal('');
  readonly score = signal<CvScore | null>(null);
  readonly previousOverall = signal<number | null>(null);
  /** True once the text changed after the last score. */
  readonly stale = signal(false);
  readonly error = signal('');
  readonly busy = signal<'rescore' | 'tailor' | 'download' | null>(null);
  readonly tailoring = signal<CvTailoring | null>(null);
  /** The saved CV this text belongs to, when it was saved to or opened from the account. */
  readonly savedCvId = signal<string | null>(null);
  /** Counts successful scoring runs (not restores), so saving can follow each new score. */
  readonly scoreRuns = signal(0);

  constructor() {
    this.restore();
    effect(() => {
      const score = this.score();
      const saved: SavedFlow | null = score
        ? {
            cvText: this.cvText(),
            jobDescription: this.jobDescription(),
            score,
            previousOverall: this.previousOverall(),
            stale: this.stale(),
            tailoring: this.tailoring(),
            savedCvId: this.savedCvId(),
          }
        : null;
      try {
        if (saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* Storage can be full or blocked (private mode); the flow still works without it. */
      }
    });
  }

  async startWithFile(file: File): Promise<void> {
    this.error.set('');
    if (file.size > MAX_FILE_BYTES) {
      this.error.set('Your file must be 5 MB or smaller.');
      return;
    }
    this.phase.set('reading');
    try {
      const data = new FormData();
      data.append('file', file);
      const { text } = await this.post<{ text: string }>('/api/cv/extract', data);
      this.cvText.set(text);
    } catch (error) {
      this.fail(error, 'We couldn’t read this file. Try another one or paste your CV text.');
      return;
    }
    await this.runScore('scoring');
  }

  async startWithText(text: string): Promise<void> {
    this.error.set('');
    this.cvText.set(text.replace(/\r\n?/g, '\n').trim());
    await this.runScore('scoring');
  }

  async rescore(): Promise<void> {
    if (this.busy()) return;
    await this.runScore('rescore');
  }

  /** Asks the AI to fix one issue; the caller shows the proposal and applies it on Accept. */
  fix(issue: CvIssue): Promise<CvFix> {
    return this.post<CvFix>('/api/cv/fix', {
      cvText: this.cvText(),
      jobDescription: this.jobDescription() || null,
      issue: { section: issue.section, problem: issue.problem, suggestion: issue.suggestion },
    });
  }

  async tailor(): Promise<void> {
    if (this.busy() || !this.jobDescription().trim()) return;
    this.busy.set('tailor');
    this.error.set('');
    try {
      this.tailoring.set(
        await this.post<CvTailoring>('/api/cv/tailor', {
          cvText: this.cvText(),
          jobDescription: this.jobDescription(),
        }),
      );
    } catch (error) {
      this.error.set(CvFlow.message(error, 'Tailoring failed. Please try again.'));
    } finally {
      this.busy.set(null);
    }
  }

  /** Replaces the first occurrence of `original`; false if the user has since edited it away. */
  applyChange(original: string, replacement: string): boolean {
    const text = this.cvText();
    const at = text.indexOf(original);
    if (at < 0) return false;
    this.setText(text.slice(0, at) + replacement + text.slice(at + original.length));
    return true;
  }

  setText(text: string): void {
    this.cvText.set(text);
    this.stale.set(true);
  }

  async download(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('download');
    this.error.set('');
    try {
      const blob = await firstValueFrom(
        this.http.post(
          '/api/documents/export',
          { documentType: 'cv', text: this.cvText() },
          { responseType: 'blob' },
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: 'cv.pdf' });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      // Errors come back as a JSON blob from the export endpoint.
      let message = 'The PDF couldn’t be created. Please try again.';
      if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
        try {
          message = JSON.parse(await error.error.text()).message ?? message;
        } catch {
          /* keep the default */
        }
      }
      this.error.set(message);
    } finally {
      this.busy.set(null);
    }
  }

  reset(): void {
    this.phase.set('input');
    this.cvText.set('');
    this.jobDescription.set('');
    this.score.set(null);
    this.previousOverall.set(null);
    this.stale.set(false);
    this.error.set('');
    this.busy.set(null);
    this.tailoring.set(null);
    this.savedCvId.set(null);
  }

  /** Opens a CV from the account, with its latest score when it has one. */
  loadSaved(id: string, text: string, jobDescription: string, score: CvScore | null, previous: number | null): void {
    this.reset();
    this.savedCvId.set(id);
    this.cvText.set(text);
    this.jobDescription.set(jobDescription);
    if (score) {
      this.score.set(score);
      this.previousOverall.set(previous);
      this.phase.set('results');
    }
  }

  private async runScore(mode: 'scoring' | 'rescore'): Promise<void> {
    if (mode === 'scoring') this.phase.set('scoring');
    else this.busy.set('rescore');
    const previous = mode === 'rescore' ? (this.score()?.overall ?? null) : null;
    try {
      const score = await this.post<CvScore>('/api/cv/score', {
        cvText: this.cvText(),
        jobDescription: this.jobDescription() || null,
      });
      // Only compare once the new score is in, so "since your last score" never shows early.
      this.previousOverall.set(previous);
      this.score.set(score);
      this.stale.set(false);
      this.phase.set('results');
      this.scoreRuns.update((runs) => runs + 1);
    } catch (error) {
      this.fail(error, 'Scoring failed. Please try again.', mode === 'rescore');
    } finally {
      this.busy.set(null);
    }
  }

  /** On a first-run failure go back to the input step; on a re-score keep the results. */
  private fail(error: unknown, fallback: string, keepResults = false): void {
    this.error.set(CvFlow.message(error, fallback));
    if (!keepResults) this.phase.set('input');
  }

  private post<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(url, body));
  }

  /** Bring back results from an earlier visit; ignore anything malformed. */
  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as SavedFlow | null;
      if (!saved || typeof saved.cvText !== 'string' || typeof saved.score?.overall !== 'number')
        return;
      this.cvText.set(saved.cvText);
      this.jobDescription.set(saved.jobDescription ?? '');
      this.score.set(saved.score);
      this.previousOverall.set(saved.previousOverall ?? null);
      this.stale.set(!!saved.stale);
      this.tailoring.set(saved.tailoring ?? null);
      this.savedCvId.set(typeof saved.savedCvId === 'string' ? saved.savedCvId : null);
      this.phase.set('results');
    } catch {
      /* Blocked or corrupt storage: start fresh. */
    }
  }

  static message(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0)
        return 'We can’t reach the server. Check your connection and try again.';
      if (typeof error.error?.message === 'string') return error.error.message;
    }
    return fallback;
  }
}
