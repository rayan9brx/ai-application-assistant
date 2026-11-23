import { Component } from '@angular/core';

/** Checkmark icon. Used as an attribute on <svg> so the parent's styles still apply to it. */
@Component({
  selector: 'svg[appCheckIcon]',
  template: '<svg:path d="M3.5 8.5 6.5 11.5 12.5 4.5" />',
  host: { viewBox: '0 0 16 16', 'aria-hidden': 'true' },
})
export class CheckIcon {}
