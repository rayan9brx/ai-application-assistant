import { Component, effect, inject, signal } from '@angular/core';
import { CvChange, CvFlow } from './cv-flow';

type Decision = 'pending' | 'accepted' | 'rejected' | 'missing';

/** Proposed tailoring changes for the job description, each with Accept / Reject. */
@Component({
  selector: 'app-tailor-panel',
  template: `
    @if (flow.tailoring(); as tailoring) {
      @if (!tailoring.changes.length) {
        <p class="empty">
          Your CV already fits this job well; we didn’t find lines worth rewriting.
        </p>
      }
      <ol class="changes" role="list">
        @for (change of tailoring.changes; track change.original; let i = $index) {
          <li class="change" [attr.data-decision]="decisions()[i]">
            <p class="section">{{ change.section }}</p>
            <p class="before">{{ change.original }}</p>
            <p class="after">{{ change.replacement }}</p>
            <p class="why">{{ change.reason }}</p>
            @switch (decisions()[i]) {
              @case ('accepted') {
                <p class="status ok"><span aria-hidden="true">✓</span> Applied</p>
              }
              @case ('rejected') {
                <p class="status">Rejected</p>
              }
              @case ('missing') {
                <p class="status warn">This line changed in your CV, so it wasn’t applied.</p>
              }
              @default {
                <div class="actions">
                  <button class="cta cta-small" type="button" (click)="accept(i, change)">
                    Accept
                  </button>
                  <button class="cta cta-small cta-secondary" type="button" (click)="reject(i)">
                    Reject
                  </button>
                </div>
              }
            }
          </li>
        }
      </ol>
      @if (tailoring.notes.length) {
        <div class="notes">
          <p class="notes-title">Check these yourself</p>
          <ul>
            @for (note of tailoring.notes; track note) {
              <li>{{ note }}</li>
            }
          </ul>
        </div>
      }
    }
  `,
  styleUrl: './tailor-panel.scss',
})
export class TailorPanel {
  readonly flow = inject(CvFlow);
  readonly decisions = signal<Decision[]>([]);

  constructor() {
    // A new set of proposals starts undecided.
    effect(() => this.decisions.set((this.flow.tailoring()?.changes ?? []).map(() => 'pending')));
  }

  accept(index: number, change: CvChange): void {
    this.decide(
      index,
      this.flow.applyChange(change.original, change.replacement) ? 'accepted' : 'missing',
    );
  }

  reject(index: number): void {
    this.decide(index, 'rejected');
  }

  private decide(index: number, decision: Decision): void {
    this.decisions.update((all) => all.map((current, i) => (i === index ? decision : current)));
  }
}
