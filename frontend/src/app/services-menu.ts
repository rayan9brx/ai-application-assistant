import { Component } from '@angular/core';
import { DisclosureMenu } from './disclosure-menu';
import { MENU_COLUMNS, TOOLS_HREF, itemsIn } from './menu-config';
import { MenuItem } from './menu-item';

export type { DisclosureMenuVariant as ServicesMenuVariant } from './disclosure-menu';

/** "Services" mega menu: the tools from menu-config.ts in two columns. */
@Component({
  selector: 'app-services-menu',
  imports: [MenuItem],
  templateUrl: './services-menu.html',
  styleUrls: ['./disclosure-menu.scss', './services-menu.scss'],
})
export class ServicesMenu extends DisclosureMenu {
  protected readonly idPrefix = 'services-menu';
  readonly columns = MENU_COLUMNS.map((column) => ({ ...column, items: itemsIn(column.id) }));
  readonly toolsHref = TOOLS_HREF;
}
