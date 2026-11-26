import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CvApi, CvSummary } from '../../core/cv-api';
import { CvFlow, JobTailoring, MAX_FILE_BYTES } from '../../core/cv-flow';
import { CvTemplateId, DEFAULT_TEMPLATE } from '../../core/cv-templates';
import { Navigation } from '../../core/navigation';
import { JOB_LINK, PromptRouter } from '../../core/prompt-router';
import { ScoreTone, scoreTone } from '../../core/score-tone';
import { UsageStore } from '../../core/usage-store';
import { CheckIcon } from '../../shared/check-icon';
import { CvSheet } from '../../shared/cv-sheet';
import { ScoreRing } from '../../shared/score-ring';

type Step = 'input' | 'working' | 'review' | 'saved';
type Decision = 'pending' | 'accepted' | 'rejected';
type Section = JobTailoring['changes'][number]['section'];

const UPLOAD = 'upload';
const MIN_JOB = 50;
const PROGRESS = ['Reading the job ad…', 'Matching your experience…', 'Rewriting…'];
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'title', label: 'Target title' },
  { id: 'summary', label: 'Summary' },
  { id: 'bullets', label: 'Bullet points' },
  { id: 'skills', label: 'Skills order' },
];

/**
 * /tailor: pick a base CV and a job ad on one screen → review the AI's changes one by one next
 * to a live preview and save the result as a new CV (the base CV is never changed). The AI may only
 * rephrase, reorder and emphasize; missing requirements are listed, never added.
 */
@Component({
  selector: 'app-tailor-page',
  imports: [CvSheet, CheckIcon, ScoreRing],
  templateUrl: './tailor-page.html',
  styleUrl: './tailor-page.scss',
})
export class TailorPage {
  private readonly api = inject(CvApi);
  private readonly flow = inject(CvFlow);
  private readonly navigation = inject(Navigation);
  readonly usage = inject(UsageStore);
  /** ?cv=<id> (the builder's "Create tailored version") preselects that CV. */
  readonly cv = input<string>();

  readonly upload = UPLOAD;
  readonly minJob = MIN_JOB;
  readonly step = signal<Step>('input');
  readonly progress = signal(0);
  readonly progressText = computed(() => PROGRESS[Math.min(this.progress(), PROGRESS.length - 1)]);
  readonly error = signal('');

  // Step 1
  readonly cvs = signal<CvSummary[] | null>(null);
  readonly baseId = signal('');
  readonly file = signal<File | null>(null);
  readonly fileError = signal('');
  readonly dragging = signal(false);
  readonly hasBase = computed(() => (this.baseId() === UPLOAD ? !!this.file() : !!this.baseId()));
  readonly jobMode = signal<'text' | 'link'>('text');
  readonly jobText = signal('');
  readonly jobLink = signal('');
  readonly fetching = signal(false);
  readonly linkNote = signal('');
  readonly company = signal('');
  readonly jobTitle = signal('');
  readonly canTailor = computed(
    () =>
      this.jobText().trim().length >= MIN_JOB &&
      this.hasBase() &&
      this.usage.aiUsesLeft() !== 0,
  );

  // Step 2
  readonly result = signal<JobTailoring | null>(null);
  readonly baseText = signal('');
  readonly template = signal<CvTemplateId>(DEFAULT_TEMPLATE);
  readonly decisions = signal<Decision[]>([]);
  /** The base text with every accepted change applied; conflicts are changes whose line is gone. */
  readonly applied = computed(() => {
    let text = this.baseText();
    const conflicts = new Set<number>();
    const decisions = this.decisions();
    this.result()?.changes.forEach((change, i) => {
      if (decisions[i] !== 'accepted') return;
      const at = text.indexOf(change.original);
      if (at < 0) conflicts.add(i);
      else text = text.slice(0, at) + change.replacement + text.slice(at + change.original.length);
    });
    return { text, conflicts };
  });
  readonly groups = computed(() => {
    const changes = this.result()?.changes ?? [];
    return SECTIONS.map((s) => ({
      ...s,
      items: changes.map((change, index) => ({ change, index })).filter((c) => c.change.section === s.id),
    })).filter((g) => g.items.length);
  });
  readonly acceptedCount = computed(
    () => this.decisions().filter((d, i) => d === 'accepted' && !this.applied().conflicts.has(i)).length,
  );
  readonly pendingCount = computed(() => this.decisions().filter((d) => d === 'pending').length);
  /** The AI's estimate, in proportion to the changes accepted so far. */
  readonly matchNow = computed(() => {
    const r = this.result();
    if (!r) return 0;
    const total = r.changes.length;
    return total ? Math.round(r.matchBefore + ((r.matchAfter - r.matchBefore) * this.acceptedCount()) / total) : r.matchBefore;
  });
  /** Job keywords that an accepted change brings into a line where they weren't before. */
  readonly keywords = computed(() => {
    const r = this.result();
    if (!r) return { added: [], matched: [], missing: [] };
    const decisions = this.decisions();
    const lower = (s: string) => s.toLowerCase();
    const added = r.matchedKeywords.filter((k) =>
      r.changes.some(
        (c, i) =>
          decisions[i] === 'accepted' && lower(c.replacement).includes(lower(k)) && !lower(c.original).includes(lower(k)),
      ),
    );
    return { added, matched: r.matchedKeywords.filter((k) => !added.includes(k)), missing: r.missingKeywords };
  });

  // Step 3
  readonly saveTitle = computed(() => {
    const name = `${this.company().trim()} ${this.jobTitle().trim()}`.trim();
    return (name ? `CV – ${name}` : 'CV – Tailored').slice(0, 200);
  });
  readonly saving = signal(false);
  readonly savedId = signal<string | null>(null);
  readonly downloading = signal(false);

  constructor() {
    void this.usage.refresh();
    const timer = setInterval(() => {
      if (this.step() === 'working') this.progress.update((p) => p + 1);
    }, 4000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    this.api.list().then(
      (cvs) => this.cvs.set([...cvs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
      () => this.cvs.set([]),
    );
    // Preselect ?cv=, else the most recently edited CV.
    effect(() => {
      const cvs = this.cvs();
      const wanted = this.cv();
      if (!cvs) return;
      untracked(() => {
        if (this.baseId() === UPLOAD && this.file()) return;
        const pick = cvs.find((c) => c.id === wanted) ?? cvs[0];
        this.baseId.set(pick ? pick.id : '');
      });
    });
    this.applyPrompt();
  }

  /** A request from the smart prompt box: a link is read, a pasted ad fills the field, a file is the base CV. */
  private applyPrompt(): void {
    const intent = inject(PromptRouter).take();
    if (!intent) return;
    if (intent.file) {
      this.baseId.set(UPLOAD);
      this.file.set(intent.file);
    }
    const link = intent.text.match(JOB_LINK)?.[0];
    if (link) {
      this.jobMode.set('link');
      this.jobLink.set(link);
      void this.loadLink();
    } else if (intent.text.length >= MIN_JOB) {
      this.jobText.set(intent.text);
    }
  }

  // Step 1

  setBase(value: string): void {
    this.baseId.set(value);
    this.error.set('');
  }

  pickFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.useFile(file);
  }

  dragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.useFile(file);
  }

  /** Checks the file, shows it as the first card and selects it. */
  private useFile(file: File): void {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      this.fileError.set(`“${file.name}” isn’t a PDF or Word (.docx) file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.fileError.set(`“${file.name}” is larger than 5 MB.`);
      return;
    }
    this.fileError.set('');
    this.file.set(file);
    this.setBase(UPLOAD);
  }

  /** "2h ago", "3 days ago"… */
  ago(value: string): string {
    const seconds = Math.round((Date.parse(value) - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  /** Reads the ad behind the link into the text field; on failure asks to paste the text. */
  async loadLink(): Promise<void> {
    const link = this.jobLink().trim();
    if (!link || this.fetching()) return;
    this.fetching.set(true);
    this.linkNote.set('');
    try {
      const ad = await this.flow.jobAd(link);
      this.jobText.set(ad.text);
      if (!this.company().trim()) this.company.set(ad.company);
      if (!this.jobTitle().trim()) this.jobTitle.set(ad.jobTitle);
      this.linkNote.set('Loaded from the link. Check that the text is the job ad.');
    } catch (error) {
      this.linkNote.set(
        CvFlow.message(error, 'We couldn’t read the job ad from this link. Copy the ad’s text and paste it instead.'),
      );
    } finally {
      this.fetching.set(false);
      this.jobMode.set('text');
    }
  }

  async tailor(): Promise<void> {
    if (!this.canTailor() || this.step() === 'working') return;
    this.error.set('');
    this.progress.set(0);
    this.step.set('working');
    try {
      const { text, template } = await this.loadBase();
      const result = await this.flow.tailorJob(text, this.jobText().trim());
      this.baseText.set(text);
      this.template.set(template);
      if (!this.company().trim()) this.company.set(result.company);
      if (!this.jobTitle().trim()) this.jobTitle.set(result.jobTitle);
      this.result.set(result);
      this.decisions.set(result.changes.map(() => 'pending'));
      this.step.set('review');
      scrollTo({ top: 0 });
    } catch (error) {
      this.error.set(CvFlow.message(error, 'Tailoring failed. Please try again.'));
      this.step.set('input');
    } finally {
      void this.usage.refresh();
    }
  }

  private async loadBase(): Promise<{ text: string; template: CvTemplateId }> {
    const file = this.file();
    if (this.baseId() === UPLOAD && file) return { text: await this.flow.extract(file), template: this.flow.template() };
    const saved = await this.api.get(this.baseId());
    return { text: saved.content.text, template: saved.template };
  }

  // Step 2

  decide(index: number, decision: Decision): void {
    this.decisions.update((all) => all.map((d, i) => (i === index ? decision : d)));
  }

  acceptAll(): void {
    this.decisions.update((all) => all.map((d) => (d === 'rejected' ? d : 'accepted')));
  }

  sectionLabel(section: Section): string {
    return SECTIONS.find((s) => s.id === section)?.label ?? section;
  }

  tone(score: number): ScoreTone {
    return scoreTone(score);
  }

  // Step 3

  /** Saves the tailored text as a new CV with the job ad; the base CV stays as it was. */
  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await this.api.create({
        title: this.saveTitle(),
        content: { text: this.applied().text },
        jobDescription: this.jobText().trim().slice(0, 15000),
        template: this.template(),
        tailoring: {
          company: this.company().trim().slice(0, 120) || null,
          jobTitle: this.jobTitle().trim().slice(0, 160) || null,
          matchScore: this.matchNow(),
        },
      });
      this.savedId.set(saved.id);
      this.step.set('saved');
    } catch (error) {
      this.error.set(CvFlow.message(error, 'Your CV couldn’t be saved. Please try again.'));
    } finally {
      this.saving.set(false);
    }
  }

  openBuilder(): void {
    const id = this.savedId();
    if (id) void this.navigation.go(`/builder/${id}`);
  }

  async download(): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.error.set('');
    try {
      await this.flow.exportPdf(this.applied().text, this.template());
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.downloading.set(false);
    }
  }

  startOver(): void {
    this.result.set(null);
    this.decisions.set([]);
    this.savedId.set(null);
    this.jobText.set('');
    this.jobLink.set('');
    this.company.set('');
    this.jobTitle.set('');
    this.linkNote.set('');
    this.error.set('');
    this.step.set('input');
    scrollTo({ top: 0 });
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }
}
