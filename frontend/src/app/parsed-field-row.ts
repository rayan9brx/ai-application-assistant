import { Component, input } from '@angular/core';

export interface ParsedField {
  label: string;
  value: string;
  /** Whether the ATS read this field correctly. */
  detected: boolean;
}

@Component({
  selector: 'li[app-parsed-field-row]',
  template: `
    <span class="icon" aria-hidden="true">{{ field().detected ? '✓' : '✗' }}</span
    >&ngsp;
    <span
      ><span class="label">{{ field().label }}:</span>&ngsp;
      @if (!field().detected) {
        <span class="sr-only">Problem:&ngsp;</span>
      }
      <span class="value">{{ field().value }}</span></span
    >
  `,
  styleUrl: './parsed-field-row.scss',
  host: { '[class.problem]': '!field().detected' },
})
export class ParsedFieldRow {
  readonly field = input.required<ParsedField>();
}
