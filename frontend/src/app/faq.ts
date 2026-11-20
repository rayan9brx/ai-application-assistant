import { Component, input, signal } from '@angular/core';
import { FaqItem } from './pricing-config';

let nextId = 0;

/** Accordion of questions; each can be opened independently. */
@Component({
  selector: 'app-faq',
  templateUrl: './faq.html',
  styleUrl: './faq.scss',
})
export class Faq {
  readonly items = input.required<readonly FaqItem[]>();
  readonly open = signal<ReadonlySet<number>>(new Set());
  readonly idPrefix = `faq-${nextId++}`;

  toggle(index: number): void {
    this.open.update((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }
}
