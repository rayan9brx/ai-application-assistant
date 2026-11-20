import { Component, input } from '@angular/core';
import { MenuItemConfig, TOOLS_HREF } from './menu-config';

/** Generic placeholder page for tools that are not built yet. */
@Component({
  selector: 'app-coming-soon',
  template: `
    <section class="coming-soon" aria-labelledby="coming-soon-title">
      <p class="pill">Coming soon</p>
      <h1 id="coming-soon-title">{{ item()?.title ?? 'This tool' }} is on its way</h1>
      <p class="lede">
        {{ item()?.description ? item()!.description + '. ' : '' }}We're still building this tool.
        In the meantime, you can upload your CV on the home page.
      </p>
      <div class="actions">
        <a class="cta" href="/#get-started">Back to home</a>
        <a class="secondary" [href]="toolsHref">See all tools</a>
      </div>
    </section>
  `,
  styleUrl: './coming-soon.scss',
})
export class ComingSoon {
  readonly item = input<MenuItemConfig>();
  readonly toolsHref = TOOLS_HREF;
}
