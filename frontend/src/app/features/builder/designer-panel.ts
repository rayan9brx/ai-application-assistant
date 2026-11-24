import { Component, inject } from '@angular/core';
import { ACCENTS, FONTS, SizeId, SpacingId } from '../../core/cv-builder';
import { TemplatePicker } from '../../shared/template-picker';
import { BuilderStore } from './builder-store';

/** Template, accent color, font, size, spacing, dividers and indent; the preview follows live. */
@Component({
  selector: 'app-designer-panel',
  imports: [TemplatePicker],
  template: `
    @let design = store.design();
    <section class="card">
      <h3>Template</h3>
      <app-template-picker class="picker" [text]="store.text()" [value]="design.template"
        (valueChange)="store.setDesign('template', $event)" />
      <p class="muted">The PDF export uses this template.</p>
    </section>

    <section class="card">
      <h3 id="accent-title">Accent color</h3>
      <div class="swatches theme-light" role="radiogroup" aria-labelledby="accent-title">
        @for (accent of accents; track accent.id) {
          <button type="button" role="radio" class="swatch" [class.default]="!accent.token"
            [style.--swatch]="accent.token || null" [attr.aria-checked]="design.accent === accent.id"
            [attr.aria-label]="accent.label" [title]="accent.label" (click)="store.setDesign('accent', accent.id)"></button>
        }
      </div>
      <p class="muted">Colors show in the live preview; the PDF keeps the template's own colors.</p>
    </section>

    <section class="card options">
      <label>
        <span>Font</span>
        <select [value]="design.font" (change)="store.setDesign('font', $any(value($event)))">
          @for (font of fonts; track font.id) {
            <option [value]="font.id">{{ font.label }}</option>
          }
        </select>
      </label>
      <div class="field">
        <span class="field-label" id="size-title">Font size</span>
        <div class="segmented" role="radiogroup" aria-labelledby="size-title">
          @for (size of sizes; track size.id) {
            <button type="button" role="radio" [attr.aria-checked]="design.fontSize === size.id"
              (click)="store.setDesign('fontSize', size.id)">{{ size.label }}</button>
          }
        </div>
      </div>
      <div class="field">
        <span class="field-label" id="spacing-title">Spacing</span>
        <div class="segmented" role="radiogroup" aria-labelledby="spacing-title">
          @for (spacing of spacings; track spacing.id) {
            <button type="button" role="radio" [attr.aria-checked]="design.spacing === spacing.id"
              (click)="store.setDesign('spacing', spacing.id)">{{ spacing.label }}</button>
          }
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" role="switch" [checked]="design.dividers" (change)="store.setDesign('dividers', checked($event))" />
        <span>Section dividers</span>
      </label>
      <label class="toggle">
        <input type="checkbox" role="switch" [checked]="design.indent" (change)="store.setDesign('indent', checked($event))" />
        <span>Indent section content</span>
      </label>
    </section>
  `,
  styleUrls: ['./builder-panels.scss'],
  styles: `
    .card { display: grid; gap: 10px; }
    .picker { display: block; }
    .swatches { display: flex; flex-wrap: wrap; gap: 10px; background: transparent; }
    .swatch { width: 34px; min-height: 34px; padding: 0; border: 2px solid var(--surface); border-radius: 50%; background: var(--swatch); box-shadow: 0 0 0 1px var(--border-strong); }
    .swatch.default { background: linear-gradient(135deg, var(--text) 50%, var(--primary-600) 50%); }
    .swatch[aria-checked='true'] { box-shadow: 0 0 0 2px var(--focus-ring); }
    .options { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .field { display: grid; gap: 4px; }
    .segmented { display: flex; padding: 3px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--bg); }
    .segmented button { flex: 1; min-height: 32px; padding: 4px 8px; border: 0; border-radius: 6px; background: none; color: var(--text-secondary); font-size: 12px; }
    .segmented button[aria-checked='true'] { background: var(--accent-soft); color: var(--text); }
    .toggle { display: flex; align-items: center; gap: 8px; }
    .toggle input { width: 18px; height: 18px; accent-color: var(--accent); }
    .toggle span { color: var(--text); font-size: var(--text-sm); font-weight: 500; }
    @media (max-width: 560px) { .options { grid-template-columns: 1fr; } }
  `,
})
export class DesignerPanel {
  readonly store = inject(BuilderStore);
  readonly accents = ACCENTS;
  readonly fonts = FONTS;
  readonly sizes: { id: SizeId; label: string }[] = [
    { id: 'small', label: 'Small' },
    { id: 'medium', label: 'Medium' },
    { id: 'large', label: 'Large' },
  ];
  readonly spacings: { id: SpacingId; label: string }[] = [
    { id: 'tight', label: 'Tight' },
    { id: 'normal', label: 'Normal' },
    { id: 'relaxed', label: 'Relaxed' },
  ];

  value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
