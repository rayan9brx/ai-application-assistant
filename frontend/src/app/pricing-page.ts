import { Component, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { BillingToggle } from './billing-toggle';
import { ComparisonTable } from './comparison-table';
import { Faq } from './faq';
import { PricingCard } from './pricing-card';
import { Billing, COMPARISON, FAQ, PLANS, yearlySaving } from './pricing-config';

@Component({
  selector: 'app-pricing-page',
  imports: [BillingToggle, ComparisonTable, Faq, PricingCard],
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.scss',
})
export class PricingPage {
  readonly billing = signal<Billing>('monthly');
  readonly plans = PLANS;
  readonly comparison = COMPARISON;
  readonly faq = FAQ;
  readonly saving = yearlySaving();
  readonly startHref = inject(AuthService).startHref;
}
