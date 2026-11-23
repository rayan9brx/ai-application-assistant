import { Component, input } from '@angular/core';

export interface StepperStep {
  id: string;
  number: string;
  stepLabel: string;
}

/**
 * Progress line through the hurdles: horizontal and sticky on desktop, a vertical rail beside
 * the steps on mobile. The parent feeds it scroll progress; it only draws.
 */
@Component({
  selector: 'app-stepper',
  template: `
    <nav class="stepper" aria-label="The 3 hurdles">
      <div class="track" aria-hidden="true">
        <span class="fill" [style.--fill]="fill()" [style.--progress]="progress()"></span>
      </div>
      <ol role="list">
        @for (step of steps(); track step.id; let i = $index) {
          <li [class.reached]="i <= active()" [style.--pos]="positions()[i] ?? 0">
            <a [href]="'#' + step.id" [attr.aria-current]="i === active() ? 'step' : null">
              <span class="number">{{ step.number }}</span>
              <span class="name">{{ step.stepLabel }}</span>
            </a>
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './stepper.scss',
})
export class Stepper {
  readonly steps = input.required<readonly StepperStep[]>();
  /** 0–1 along the horizontal line, where each node sits at an equal share. */
  readonly fill = input(0);
  /** 0–1 down the vertical rail, matched to where the steps really are. */
  readonly progress = input(0);
  /** Each step's top as a 0–1 fraction of the rail (vertical layout only). */
  readonly positions = input<readonly number[]>([]);
  /** Index of the step being read, or -1 before the first. */
  readonly active = input(-1);
}
