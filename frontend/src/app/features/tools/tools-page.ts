import { Component } from '@angular/core';
import { MENU_COLUMNS, itemsIn } from '../../core/menu-config';
import { MenuItem } from '../../layout/menu-item';

/** Lists every tool from the menu config, grouped by column. */
@Component({
  selector: 'app-tools-page',
  imports: [MenuItem],
  template: `
    <section class="tools" aria-labelledby="tools-title">
      <h1 id="tools-title">All tools</h1>
      <p class="lede">Everything Rezumo offers for your CV and job search.</p>
      @for (group of groups; track group.id) {
        <h2 [id]="'tools-' + group.id">{{ group.label }}</h2>
        <ul class="grid" role="list" [attr.aria-labelledby]="'tools-' + group.id">
          @for (item of group.items; track item.slug) {
            <li><a app-menu-item class="card" [item]="item"></a></li>
          }
        </ul>
      }
    </section>
  `,
  styleUrl: './tools-page.scss',
})
export class ToolsPage {
  readonly groups = MENU_COLUMNS.map((column) => ({ ...column, items: itemsIn(column.id) }));
}
