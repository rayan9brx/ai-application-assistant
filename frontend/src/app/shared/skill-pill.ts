import { Component, input } from '@angular/core';

export type SkillTone = 'matched' | 'missing';

@Component({
  selector: 'li[app-skill-pill]',
  template: `<span aria-hidden="true">{{ tone() === 'matched' ? '✓' : '✗' }}</span> {{ label() }}`,
  styleUrl: './skill-pill.scss',
  host: { '[class.missing]': "tone() === 'missing'" },
})
export class SkillPill {
  readonly label = input.required<string>();
  readonly tone = input.required<SkillTone>();
}
