import { Component, computed, inject, input } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { MenuItemConfig } from '../core/menu-config';

/** One tool link: title (with optional badge) and a short description. */
@Component({
  selector: 'a[app-menu-item]',
  template: `
    <span class="title"
      >{{ item().title }}
      @if (item().soon) {
        <span class="badge soon">Soon</span>
      } @else if (item().badge) {
        <span class="badge">{{ item().badge }}</span>
      }
    </span>
    &ngsp;<span class="description">{{ item().description }}</span>
  `,
  styleUrl: './menu-item.scss',
  host: { '[attr.href]': 'href()' },
})
export class MenuItem {
  readonly item = input.required<MenuItemConfig>();
  private readonly auth = inject(AuthService);
  /** Live tools need an account; "Coming soon" and public pages stay public. */
  readonly href = computed(() => {
    const item = this.item();
    return item.soon || item.public ? item.href : this.auth.gate(item.href);
  });
}
