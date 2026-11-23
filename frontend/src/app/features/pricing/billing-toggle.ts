import { Component, input, model } from '@angular/core';
import { Billing } from './pricing-config';

/** Monthly / Yearly pill switch made of two toggle buttons (aria-pressed). */
@Component({
  selector: 'app-billing-toggle',
  template: `
    <div class="toggle" role="group" aria-label="Billing period">
      <button
        type="button"
        [attr.aria-pressed]="billing() === 'monthly'"
        (click)="billing.set('monthly')"
      >
        Monthly
      </button>
      <button
        type="button"
        [attr.aria-pressed]="billing() === 'yearly'"
        (click)="billing.set('yearly')"
      >
        Yearly
        @if (saving()) {
          <span class="saving">Save {{ saving() }}%</span>
        }
      </button>
    </div>
  `,
  styleUrl: './billing-toggle.scss',
})
export class BillingToggle {
  readonly billing = model<Billing>('monthly');
  readonly saving = input(0);
}
