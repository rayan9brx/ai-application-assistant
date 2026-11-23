import { Component, inject, input, signal } from '@angular/core';
import { CvFix, CvFlow, CvIssue } from '../../core/cv-flow';

type State = 'idle' | 'loading' | 'proposal' | 'accepted' | 'rejected';

/** One issue from the score with "Fix with AI" → Accept / Reject. */
@Component({
  selector: 'app-issue-card',
  templateUrl: './issue-card.html',
  styleUrl: './issue-card.scss',
})
export class IssueCard {
  private readonly flow = inject(CvFlow);
  readonly issue = input.required<CvIssue>();
  readonly state = signal<State>('idle');
  readonly fix = signal<CvFix | null>(null);
  readonly error = signal('');
  readonly copied = signal(false);

  async askAi(): Promise<void> {
    this.state.set('loading');
    this.error.set('');
    try {
      this.fix.set(await this.flow.fix(this.issue()));
      this.state.set('proposal');
    } catch (error) {
      this.error.set(CvFlow.message(error, 'The AI fix failed. Please try again.'));
      this.state.set('idle');
    }
  }

  accept(): void {
    const fix = this.fix();
    if (!fix) return;
    if (this.flow.applyChange(fix.original, fix.replacement)) {
      this.state.set('accepted');
    } else {
      this.fix.set({ ...fix, found: false });
      this.error.set(
        'This text has changed in your CV. Copy the suggestion and paste it in yourself.',
      );
    }
  }

  reject(): void {
    this.state.set('rejected');
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.fix()?.replacement ?? '');
      this.copied.set(true);
    } catch {
      this.error.set('Copy failed. Select the text and copy it yourself.');
    }
  }
}
