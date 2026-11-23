import { Component, input, output } from '@angular/core';
import { CV_TEMPLATES, CvTemplateId } from './cv-templates';
import { CvSheet } from './cv-sheet';

let nextId = 0;

/** Choose a CV template: radio buttons with a small thumbnail of the CV in each template. */
@Component({
  selector: 'app-template-picker',
  imports: [CvSheet],
  template: `
    <fieldset>
      <legend class="sr-only">Template</legend>
      @for (template of templates; track template.id) {
        <label class="option" [class.selected]="value() === template.id">
          <input
            class="sr-only"
            type="radio"
            [name]="name"
            [value]="template.id"
            [checked]="value() === template.id"
            (change)="valueChange.emit(template.id)"
          />
          <app-cv-sheet class="thumb" [text]="text()" [template]="template.id" crop="1 / 1" [decorative]="true" />
          <span class="option-name">{{ template.name }}</span>
        </label>
      }
    </fieldset>
  `,
  styles: `
    :host { display: block; }
    fieldset { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; border: 0; }
    .option { display: grid; gap: 6px; padding: 6px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); cursor: pointer; transition: border-color .15s, box-shadow .15s; }
    .option:hover { border-color: var(--primary-200); }
    .option.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .option:has(input:focus-visible) { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
    .thumb { border: 1px solid var(--border); border-radius: 6px; pointer-events: none; }
    .option-name { font-size: var(--text-sm); font-weight: 600; text-align: center; }
    .selected .option-name { color: var(--accent); }
    @media (max-width: 420px) { fieldset { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class TemplatePicker {
  /** The CV text shown in the thumbnails. */
  readonly text = input.required<string>();
  readonly value = input.required<CvTemplateId>();
  readonly valueChange = output<CvTemplateId>();
  readonly templates = CV_TEMPLATES;
  readonly name = `template-picker-${nextId++}`;
}
