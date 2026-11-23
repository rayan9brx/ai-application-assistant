import { Component, computed, inject, input } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { CHECK_HREF, SIGNUP_HREF } from '../../core/menu-config';
import { CheckIcon } from '../../shared/check-icon';
import { Billing, Plan, formatEuro } from './pricing-config';

@Component({
  selector: 'app-pricing-card',
  imports: [CheckIcon],
  templateUrl: './pricing-card.html',
  styleUrl: './pricing-card.scss',
  host: { '[class.highlighted]': '!!plan().highlight' },
})
export class PricingCard {
  readonly plan = input.required<Plan>();
  readonly billing = input<Billing>('monthly');
  private readonly auth = inject(AuthService);
  /** Guests always go to sign-up first; signed-in users go straight on. */
  readonly href = computed(() => {
    const href = this.plan().cta.href;
    if (href === SIGNUP_HREF) return this.auth.signedIn() ? '/dashboard' : SIGNUP_HREF;
    return href === CHECK_HREF ? this.auth.gate(CHECK_HREF) : href;
  });

  /** The big number, its suffix and the short line under it for the chosen billing period. */
  readonly display = computed(() => {
    const price = this.plan().price;
    switch (price.kind) {
      case 'free':
        return { amount: formatEuro(0), suffix: '', note: 'Free forever, no credit card' };
      case 'once':
        return {
          amount: formatEuro(price.amount),
          suffix: 'one-time',
          note: 'Pay once, no subscription',
        };
      case 'subscription':
        return this.billing() === 'yearly'
          ? {
              amount: formatEuro(price.yearlyPerMonth),
              suffix: '/month',
              note: `Billed ${formatEuro(price.yearlyTotal)} per year`,
            }
          : { amount: formatEuro(price.monthly), suffix: '/month', note: 'Billed monthly' };
    }
  });
}
