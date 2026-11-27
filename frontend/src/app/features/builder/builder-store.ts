import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  BuilderContent,
  BuilderDesign,
  SUMMARY_MAX,
  SectionKind,
  cleanLineBreaks,
  emptyContent,
  fromCvText,
  normalizeContent,
  replaceInContent,
  toCvText,
} from '../../core/cv-builder';
import { CvApi } from '../../core/cv-api';
import { CvTemplateId } from '../../core/cv-templates';
import { CvChange, CvFix, CvFlow, CvIssue, CvScore, CvTailoring } from '../../core/cv-flow';

export type BuilderTab = 'content' | 'design' | 'analyze' | 'match' | 'cover';
export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
/** Where the editor should jump to, e.g. from an Analyzer issue. */
export interface FocusTarget {
  kind: SectionKind | 'contact';
  /** Changes on every request, so the same target can be focused twice. */
  seq: number;
}

const AUTOSAVE_MS = 1000;
export const UNTITLED = 'Untitled CV';
/** /builder/new creates an empty CV and then shows it at /builder/<id>. */
export const NEW_CV = 'new';

/**
 * State of one CV in the builder: the structured content, the design, autosave (1 s after the
 * last change) and the AI calls, which go through CvFlow's endpoints with the generated text.
 */
@Injectable()
export class BuilderStore {
  private readonly api = inject(CvApi);
  private readonly flow = inject(CvFlow);

  readonly id = signal('');
  readonly loaded = signal(false);
  readonly loadError = signal('');
  readonly title = signal(UNTITLED);
  readonly content = signal<BuilderContent>(emptyContent());
  readonly jobDescription = signal('');
  readonly text = computed(() => toCvText(this.content()));
  readonly design = computed(() => this.content().design);

  readonly saveState = signal<SaveState>('idle');
  readonly error = signal('');
  readonly tab = signal<BuilderTab>('content');
  readonly focus = signal<FocusTarget | null>(null);

  readonly analysis = signal<CvScore | null>(null);
  /** The text and job description the analysis was run on; null for one loaded from history. */
  private readonly analysisInput = signal<{ text: string; job: string } | null>(null);
  readonly analysisStale = computed(() => {
    const input = this.analysisInput();
    return !!this.analysis() && (!input || input.text !== this.text() || input.job !== this.jobDescription());
  });
  readonly analyzing = signal(false);
  readonly dismissed = signal<ReadonlySet<string>>(new Set());
  readonly openIssues = computed(() =>
    (this.analysis()?.issues ?? []).filter((issue) => !this.dismissed().has(issueKey(issue))),
  );

  readonly tailoring = signal<CvTailoring | null>(null);
  readonly tailoringBusy = signal(false);
  readonly applied = signal<ReadonlySet<CvChange>>(new Set());

  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private dirty = false;

  async load(id: string): Promise<void> {
    this.id.set(id);
    this.loaded.set(false);
    this.loadError.set('');
    this.error.set('');
    this.saveState.set('idle');
    this.analysisInput.set(null);
    this.dismissed.set(new Set());
    this.tailoring.set(null);
    this.applied.set(new Set());
    try {
      const [saved, history] = await Promise.all([this.api.get(id), this.api.history(id).catch(() => [])]);
      const raw = saved.content.builder;
      // A CV saved by the checker (or uploaded) has only text: build the sections from it.
      const loaded =
        normalizeContent(raw, saved.template) ??
        (saved.content.text?.trim() ? fromCvText(saved.content.text, saved.template) : emptyContent(saved.template));
      // Text saved before line breaks were joined on paste gets the same cleanup now.
      const content = cleanLineBreaks(loaded);
      this.title.set(saved.title || UNTITLED);
      this.content.set(content);
      this.jobDescription.set(saved.jobDescription ?? '');
      this.analysis.set(history[0]?.result ?? null);
      this.loaded.set(true);
      // Store the structure right away, so the next visit doesn't parse the text again.
      if (!raw || content !== loaded) this.markDirty();
    } catch (error) {
      this.loadError.set(
        error instanceof HttpErrorResponse && error.status === 404
          ? 'This CV doesn’t exist any more.'
          : CvFlow.message(error, 'This CV couldn’t be opened.'),
      );
    }
  }

  /** Creates an empty CV in the account; returns its id, or null (with loadError set). */
  async create(template: CvTemplateId): Promise<string | null> {
    this.loaded.set(false);
    this.loadError.set('');
    try {
      const cv = await this.api.create({
        title: UNTITLED,
        content: { text: '', builder: emptyContent(template) },
        jobDescription: null,
        template,
      });
      return cv.id;
    } catch (error) {
      this.loadError.set(CvFlow.message(error, 'A new CV couldn’t be created.'));
      return null;
    }
  }

  /** Applies a change to a copy of the content and schedules the autosave. */
  update(change: (content: BuilderContent) => void): void {
    const next = structuredClone(this.content());
    change(next);
    this.content.set(next);
    this.markDirty();
  }

  setDesign<K extends keyof BuilderDesign>(key: K, value: BuilderDesign[K]): void {
    this.update((content) => (content.design[key] = value));
  }

  setTitle(title: string): void {
    this.title.set(title.slice(0, 200));
    this.markDirty();
  }

  setJobDescription(job: string): void {
    this.jobDescription.set(job.slice(0, 15000));
    this.tailoring.set(null);
    this.markDirty();
  }

  markDirty(): void {
    this.dirty = true;
    this.saveState.set('pending');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), AUTOSAVE_MS);
  }

  /** Forgets unsaved changes, e.g. after the CV was deleted. */
  discard(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.dirty = false;
    this.saveState.set('idle');
  }

  /** Saves now if anything changed (also used when leaving the page). */
  async save(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.saving;
    if (!this.dirty || !this.id()) return;
    this.dirty = false;
    this.saveState.set('saving');
    this.saving = this.api
      .update(this.id(), {
        title: this.title().trim() || UNTITLED,
        content: { text: this.text(), builder: this.content() },
        jobDescription: this.jobDescription().trim() || null,
        template: this.design().template,
      })
      .then(
        () => this.saveState.set(this.dirty ? 'pending' : 'saved'),
        (error) => {
          this.dirty = true;
          this.saveState.set('error');
          this.error.set(CvFlow.message(error, 'Your changes couldn’t be saved. We’ll try again.'));
        },
      )
      .finally(() => (this.saving = null));
    await this.saving;
  }

  jumpTo(kind: SectionKind | 'contact'): void {
    this.tab.set('content');
    this.focus.set({ kind, seq: (this.focus()?.seq ?? 0) + 1 });
  }

  /** Runs the ATS analysis on the current content (with the job description, if any). */
  async analyze(): Promise<void> {
    if (this.analyzing()) return;
    const text = this.text();
    const job = this.jobDescription();
    this.analyzing.set(true);
    this.error.set('');
    try {
      const score = await this.flow.scoreText(text, job);
      this.analysis.set(score);
      this.analysisInput.set({ text, job });
      this.dismissed.set(new Set());
      // Keep the dashboard's score and the history in step with the builder.
      void this.api.saveAnalysis(this.id(), score).catch(() => undefined);
    } catch (error) {
      this.error.set(CvFlow.message(error, 'The analysis failed. Please try again.'));
    } finally {
      this.analyzing.set(false);
    }
  }

  dismiss(issue: CvIssue): void {
    this.dismissed.update((set) => new Set(set).add(issueKey(issue)));
  }

  /** Asks the fix endpoint for a stronger, truthful version of one line of the CV. */
  improve(sectionLabel: string, line: string, summary = false): Promise<CvFix> {
    if (summary) {
      return this.flow.fixText(this.text(), this.jobDescription(), {
        section: sectionLabel,
        problem: `This summary could be shorter and more focused: "${line.slice(0, 1200)}"`,
        suggestion:
          `Rewrite this exact summary as at most 2 lines on the CV: no more than ${SUMMARY_MAX} characters, ` +
          'one or two sentences, leading with the most relevant experience. Use only facts already in the CV.',
      });
    }
    return this.flow.fixText(this.text(), this.jobDescription(), {
      section: sectionLabel,
      problem: `This line could be clearer and more results-focused: "${line.slice(0, 800)}"`,
      suggestion:
        'Rewrite only this exact line: start with a strong action verb, keep it to one sentence and state the result. ' +
        'Use only facts already in the CV; where a number would help but is not given, use a bracketed placeholder.',
    });
  }

  async tailor(): Promise<void> {
    if (this.tailoringBusy() || !this.jobDescription().trim()) return;
    this.tailoringBusy.set(true);
    this.error.set('');
    try {
      this.tailoring.set(await this.flow.tailorText(this.text(), this.jobDescription()));
      this.applied.set(new Set());
    } catch (error) {
      this.error.set(CvFlow.message(error, 'Tailoring failed. Please try again.'));
    } finally {
      this.tailoringBusy.set(false);
    }
  }

  /** Applies a tailoring change; false when the line was edited since. */
  applyChange(change: CvChange): boolean {
    const next = structuredClone(this.content());
    if (!replaceInContent(next, change.original, change.replacement)) return false;
    this.content.set(next);
    this.markDirty();
    this.applied.update((set) => new Set(set).add(change));
    return true;
  }

  async exportPdf(): Promise<void> {
    this.error.set('');
    await this.flow.exportPdf(this.text(), this.design().template);
  }
}

const issueKey = (issue: CvIssue) => `${issue.section}|${issue.problem}`;
