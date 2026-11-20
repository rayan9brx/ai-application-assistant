import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { CvApi, CvSummary, SavedAnalysis } from './cv-api';
import { CvFlow } from './cv-flow';
import { Navigation } from './navigation';

/** /dashboard: the user's saved CVs with their latest score and score history. */
@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly api = inject(CvApi);
  private readonly flow = inject(CvFlow);
  private readonly navigation = inject(Navigation);
  readonly auth = inject(AuthService);

  readonly cvs = signal<CvSummary[] | null>(null);
  readonly error = signal('');
  readonly busyId = signal<string | null>(null);
  readonly confirmDelete = signal<string | null>(null);
  readonly openHistory = signal<string | null>(null);
  readonly history = signal<Record<string, SavedAnalysis[]>>({});

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set('');
    try {
      this.cvs.set(await this.api.list());
    } catch (error) {
      this.error.set(CvFlow.message(error, 'Your CVs couldn’t be loaded. Please refresh.'));
      this.cvs.set(this.cvs() ?? []);
    }
  }

  /** Loads the CV and its latest score into the checker. */
  async open(cv: CvSummary): Promise<void> {
    await this.act(cv.id, async () => {
      const [saved, runs] = await Promise.all([this.api.get(cv.id), this.api.history(cv.id)]);
      this.flow.loadSaved(
        saved.id,
        saved.content.text ?? '',
        saved.jobDescription ?? '',
        runs[0]?.result ?? null,
        runs[1]?.overallScore ?? null,
      );
      await this.navigation.go('/check');
      // A CV saved without a score has nothing to show yet: score it now (saved to its history).
      if (!runs[0]) void this.flow.startWithText(saved.content.text ?? '');
    }, 'This CV couldn’t be opened.');
  }

  async duplicate(cv: CvSummary): Promise<void> {
    await this.act(cv.id, async () => {
      await this.api.duplicate(cv.id);
      await this.load();
    }, 'This CV couldn’t be duplicated.');
  }

  async remove(cv: CvSummary): Promise<void> {
    await this.act(cv.id, async () => {
      await this.api.remove(cv.id);
      if (this.flow.savedCvId() === cv.id) this.flow.savedCvId.set(null);
      this.confirmDelete.set(null);
      this.cvs.update((list) => list?.filter((item) => item.id !== cv.id) ?? null);
    }, 'This CV couldn’t be deleted.');
  }

  async toggleHistory(cv: CvSummary): Promise<void> {
    if (this.openHistory() === cv.id) return this.openHistory.set(null);
    this.openHistory.set(cv.id);
    await this.act(cv.id, async () => {
      const runs = await this.api.history(cv.id);
      this.history.update((all) => ({ ...all, [cv.id]: runs }));
    }, 'The score history couldn’t be loaded.');
  }

  scoreClass(score: number | null): string {
    return score === null ? 'none' : score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
  }

  private async act(id: string, action: () => Promise<void>, fallback: string): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(CvFlow.message(error, fallback));
    } finally {
      this.busyId.set(null);
    }
  }
}
