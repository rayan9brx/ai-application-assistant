import { Component, input } from '@angular/core';
import { MenuItemConfig } from './menu-config';

/** One tool link: title (with optional badge) and a short description. */
@Component({
  selector: 'a[app-menu-item]',
  template: `
    <span class="title"
      >{{ item().title }}
      @if (item().badge) {
        <span class="badge">{{ item().badge }}</span>
      }
    </span>
    <span class="description">{{ item().description }}</span>
  `,
  styleUrl: './menu-item.scss',
  host: { '[attr.href]': 'item().href' },
})
export class MenuItem {
  readonly item = input.required<MenuItemConfig>();
}
