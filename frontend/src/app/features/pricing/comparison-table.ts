import { Component, input } from '@angular/core';
import { CheckIcon } from '../../shared/check-icon';
import { ComparisonRow, Plan } from './pricing-config';

/** Feature × plan table. Scrolls horizontally on narrow screens, feature column stays put. */
@Component({
  selector: 'app-comparison-table',
  imports: [CheckIcon],
  templateUrl: './comparison-table.html',
  styleUrl: './comparison-table.scss',
})
export class ComparisonTable {
  readonly plans = input.required<readonly Plan[]>();
  readonly rows = input.required<readonly ComparisonRow[]>();

  isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }
}
