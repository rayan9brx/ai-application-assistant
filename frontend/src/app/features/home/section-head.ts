import { Component, input } from '@angular/core';

/** The same pill + headline (+ optional line) above every homepage section. */
@Component({
  selector: 'app-section-head',
  template: `
    <p class="pill-badge">{{ pill() }}</p>
    @if (title()) {
      <h2 class="section-title" [id]="headingId()">{{ title() }}</h2>
    }
    <ng-content />
  `,
  styles: `
    :host { display: grid; justify-items: center; gap: 16px; margin-bottom: 48px; text-align: center; }
    .section-title { max-width: 22ch; }
    :host ::ng-deep p:not(.pill-badge) { max-width: 60ch; color: var(--text-secondary); font-size: var(--text-lg); line-height: 1.55; text-wrap: pretty; }
    @media (max-width: 640px) { :host { margin-bottom: 32px; } }
  `,
})
export class SectionHead {
  readonly pill = input.required<string>();
  readonly title = input('');
  readonly headingId = input<string | null>(null);
}
