import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, signupUrl } from './auth.service';
import { Navigation } from './navigation';

/** Where a smart-prompt request goes. Mirrors the check constraint on prompt_logs.route. */
export type PromptRoute = 'score' | 'tailor' | 'fix' | 'build' | 'other';

/** A submitted prompt, waiting for the page it was routed to (survives a log-in in this tab). */
export interface PromptIntent {
  route: PromptRoute;
  text: string;
  file: File | null;
}

export const PROMPT_LOG_MAX = 300;

/* Keywords in English and German. Prefixes (no trailing \b) also match inflected forms. */
const TAILOR = /\b(tailor|customi[sz]e|job ad|job description|job posting|anpass|zuschneid|stellenanzeige|stellenausschreibung|stellenbeschreibung)/i;
const SCORE = /\b(score|check|ats\b|rate|rating|grade|review|bewert|prüf|pruef|überprüf|test)/i;
const FIX = /\b(fix|improve|bullet|stronger|rewrite|weak|polish|verbesser|optimier|überarbeit|stärker)/i;
const BUILD = /\b(build|create|new\b|from scratch|erstell|neue?[nrms]?\b|schreib)/i;
const JOB = /\b(job|stelle|position|role|vacancy|bewerb)/i;
/** Phrases that show up in job ads but rarely in a request. */
const JOB_AD = /(responsibilities|requirements|qualifications|what you('|’)ll do|we offer|about (the role|us)|nice to have|aufgaben|anforderungen|ihr profil|dein profil|wir bieten|\([mwfd]\/[mwfd]\/[mwfd]\))/i;

/** Long or ad-like text is a pasted job ad, not a request. */
export function looksLikeJobAd(text: string): boolean {
  const t = text.trim();
  return t.length >= 300 || (t.length >= 120 && JOB_AD.test(t));
}

/** Keyword routing, first match wins; no AI involved. */
export function detectRoute(text: string): PromptRoute {
  const t = text.trim();
  if (!t) return 'score';
  if (looksLikeJobAd(t) || TAILOR.test(t)) return 'tailor';
  if (SCORE.test(t)) return 'score';
  if (FIX.test(t)) return 'fix';
  if (BUILD.test(t)) return 'build';
  if (JOB.test(t)) return 'tailor';
  return 'other';
}

/**
 * Routes a smart-prompt request to an existing page and logs it (truncated) for the admin
 * insights. A guest signs up first; the prompt and file wait here in memory.
 */
@Injectable({ providedIn: 'root' })
export class PromptRouter {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(Navigation);
  private pending: PromptIntent | null = null;

  async submit(text: string, file: File | null): Promise<boolean> {
    const route = detectRoute(text);
    this.pending = { route, text: text.trim(), file };
    this.log(text, route);
    const target = destination(route, !!file);
    try {
      return await this.navigation.go(this.auth.signedIn() ? target : signupUrl(target));
    } catch {
      return false;
    }
  }

  /** Returns the waiting prompt once, then forgets it. */
  take(): PromptIntent | null {
    const intent = this.pending;
    this.pending = null;
    return intent;
  }

  /** Fire and forget: insights must never block or break the request. */
  private log(text: string, route: PromptRoute): void {
    const body = { text: text.trim().slice(0, PROMPT_LOG_MAX), route };
    firstValueFrom(this.http.post('/api/prompts', body)).catch(() => undefined);
  }
}

function destination(route: PromptRoute, hasFile: boolean): string {
  switch (route) {
    case 'tailor':
      return '/check?focus=job';
    // An attached file is the CV they mean: score it, the report lists the fixes.
    case 'fix':
      return hasFile ? '/check' : '/builder/latest?tab=analyze';
    case 'build':
      return '/builder/new';
    default:
      return '/check';
  }
}
