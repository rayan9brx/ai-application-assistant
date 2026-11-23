import { Component, computed, input } from '@angular/core';
import { CvScore } from '../../core/cv-flow';
import { ParsedField, ParsedFieldRow } from '../../shared/parsed-field-row';
import { ScoreGauge } from '../../shared/score-gauge';
import { ScoreRing } from '../../shared/score-ring';
import { scoreTone } from '../../core/score-tone';
import { SkillPill } from '../../shared/skill-pill';

const CATEGORY_LABELS: [keyof CvScore['categories'], string][] = [
  ['content', 'Content'],
  ['format', 'Format'],
  ['optimization', 'Optimization'],
  ['bestPractices', 'Best Practices'],
  ['applicationReady', 'Application Ready'],
];
const FIELD_LABELS: [keyof CvScore['fields'], string][] = [
  ['name', 'Name'],
  ['contact', 'Contact Info'],
  ['experience', 'Experience'],
  ['education', 'Education'],
  ['skills', 'Skills'],
];

/** The real score, shown with the same gauge, rings, rows and pills as the landing page. */
@Component({
  selector: 'app-score-report',
  imports: [ParsedFieldRow, ScoreGauge, ScoreRing, SkillPill],
  templateUrl: './score-report.html',
  styleUrl: './score-report.scss',
})
export class ScoreReport {
  readonly score = input.required<CvScore>();
  readonly previous = input<number | null>(null);

  readonly categories = computed(() =>
    CATEGORY_LABELS.map(([key, label]) => ({ label, value: this.score().categories[key] })),
  );
  readonly fields = computed<ParsedField[]>(() =>
    FIELD_LABELS.map(([key, label]) => {
      const field = this.score().fields[key];
      return {
        label,
        detected: field.detected,
        value: field.detail || (field.detected ? 'Detected' : 'Not found'),
      };
    }),
  );
  readonly delta = computed(() => {
    const previous = this.previous();
    return previous === null ? null : this.score().overall - previous;
  });
  readonly matchTone = computed(() => scoreTone(this.score().jobMatch?.matchPercent ?? 0));
}
