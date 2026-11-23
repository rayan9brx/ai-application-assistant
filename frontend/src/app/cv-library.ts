import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { CvApi, CvInput } from './cv-api';
import { CvFlow } from './cv-flow';
import { CvTemplateId } from './cv-templates';

/**
 * Saving the CV checker's work to the account. Only signed-in users can use the checker, and
 * every new score is saved automatically: the first one creates the CV, later ones add to its
 * history. Signing out clears the checker on this device.
 */
@Injectable({ providedIn: 'root' })
export class CvLibrary {
  private readonly flow = inject(CvFlow);
  private readonly api = inject(CvApi);
  private readonly auth = inject(AuthService);

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
        if (this.auth.signedIn()) void this.save();
        else this.state.set('idle');
      });
    });
    // "Start over" (or deleting the CV) detaches the checker from the saved CV.
    effect(() => {
      if (!this.flow.savedCvId()) untracked(() => this.state() === 'saved' && this.state.set('idle'));
    });
    this.auth.onChange((event) => {
      if (event === 'SIGNED_OUT') {
        this.flow.reset();
        this.state.set('idle');
        this.savedRun = null;
      }
    });
  }

  /** Saves (or updates) the CV, plus its current score unless the text changed since. */
  save(): Promise<boolean> {
    this.running ??= this.doSave().finally(() => (this.running = null));
    return this.running;
  }

  /**
   * Picks a template for the checker's CV. A CV already in the account keeps its saved text and
   * only gets the new template, so unsaved edits stay unsaved.
   */
  async setTemplate(template: CvTemplateId): Promise<void> {
    this.flow.setTemplate(template);
    await this.running;
    const id = this.flow.savedCvId();
    if (!id || !this.auth.signedIn()) return;
    try {
      const saved = await this.api.get(id);
      if (saved.template === template) return;
      await this.api.update(id, {
        title: saved.title,
        content: saved.content,
        jobDescription: saved.jobDescription,
        template,
      });
    } catch (error) {
      // Deleted elsewhere: the next save creates it again, with this template.
      if (error instanceof HttpErrorResponse && error.status === 404) return;
      this.state.set('error');
      this.error.set(CvFlow.message(error, 'Your template choice couldn’t be saved.'));
    }
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
        template: this.flow.template(),
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
