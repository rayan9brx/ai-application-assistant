import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CvApi, CvInput } from './cv-api';
import { CvFlow } from './cv-flow';

const PENDING_KEY = 'applycraft.pending-save.v1';

/**
 * Saving the CV checker's work to the account. Guests who press Save are sent to sign up;
 * the CV is saved automatically once they are signed in. After that, every new score of a
 * saved CV is added to its history. Signing out clears the checker on this device.
 */
@Injectable({ providedIn: 'root' })
export class CvLibrary {
  private readonly flow = inject(CvFlow);
  private readonly api = inject(CvApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly state = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly error = signal('');
  private running: Promise<boolean> | null = null;
  /** The scoring run whose result is already in the saved CV's history. */
  private savedRun: { id: string; run: number } | null = null;

  constructor() {
    let seenRuns = untracked(this.flow.scoreRuns);
    effect(() => {
      const runs = this.flow.scoreRuns();
      if (runs === seenRuns) return;
      seenRuns = runs;
      untracked(() => {
        if (this.flow.savedCvId() && this.auth.signedIn()) void this.save();
        else this.state.set('idle');
      });
    });
    // "Start over" (or deleting the CV) detaches the checker from the saved CV.
    effect(() => {
      if (!this.flow.savedCvId()) untracked(() => this.state() === 'saved' && this.state.set('idle'));
    });
    this.auth.onChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.flow.reset();
        this.state.set('idle');
        this.savedRun = null;
      } else if (session) {
        void this.savePending();
      }
    });
    void this.auth.whenReady().then(() => this.savePending());
  }

  /** The checker's Save button. */
  async requestSave(): Promise<void> {
    if (!this.auth.signedIn()) {
      try {
        localStorage.setItem(PENDING_KEY, '1');
      } catch {
        /* Without storage the user can still press Save again after signing up. */
      }
      await this.router.navigate(['/signup'], { queryParams: { next: '/check', save: 1 } });
      return;
    }
    await this.save();
  }

  /** Saves (or updates) the CV, plus its current score unless the text changed since. */
  save(): Promise<boolean> {
    this.running ??= this.doSave().finally(() => (this.running = null));
    return this.running;
  }

  private async doSave(): Promise<boolean> {
    const text = this.flow.cvText();
    if (!text.trim()) return false;
    this.state.set('saving');
    this.error.set('');
    try {
      const input: CvInput = {
        title: titleFor(text),
        content: { text },
        jobDescription: this.flow.jobDescription().trim() || null,
      };
      let id = this.flow.savedCvId();
      if (id) {
        try {
          // Keep the title the CV has in the account (e.g. a duplicate's "(copy)").
          const existing = await this.api.get(id);
          await this.api.update(id, { ...input, title: existing.title });
        } catch (error) {
          if (!(error instanceof HttpErrorResponse && error.status === 404)) throw error;
          id = null; // Deleted elsewhere: save it as a new CV.
        }
      }
      if (!id) {
        id = (await this.api.create(input)).id;
        this.flow.savedCvId.set(id);
      }
      const score = this.flow.score();
      const run = this.flow.scoreRuns();
      const already = this.savedRun?.id === id && this.savedRun.run === run;
      if (score && !this.flow.stale() && !already) {
        await this.api.saveAnalysis(id, score);
        this.savedRun = { id, run };
      }
      this.state.set('saved');
      return true;
    } catch (error) {
      this.state.set('error');
      this.error.set(CvFlow.message(error, 'Saving failed. Please try again.'));
      return false;
    }
  }

  private async savePending(): Promise<void> {
    let pending = false;
    try {
      pending = localStorage.getItem(PENDING_KEY) === '1';
      if (pending && this.auth.signedIn()) localStorage.removeItem(PENDING_KEY);
    } catch {
      return;
    }
    if (pending && this.auth.signedIn() && this.flow.cvText().trim()) await this.save();
  }
}

/** The first line of a CV is usually the person's name; it makes a good default title. */
export function titleFor(text: string): string {
  const first = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!first) return 'Untitled CV';
  return first.length > 80 ? first.slice(0, 77) + '…' : first;
}
