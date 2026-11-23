import { Component, computed, input } from '@angular/core';
import { TOOLS_HREF, itemBySlug } from '../core/menu-config';

/** Generic placeholder page for tools that are not built yet. */
@Component({
  selector: 'app-coming-soon',
  template: `
    <section class="coming-soon" aria-labelledby="coming-soon-title">
      <p class="pill-badge">Coming soon</p>
      <h1 id="coming-soon-title">{{ item()?.title ?? 'This tool' }} is on its way</h1>
      <p class="lede">
        {{ item()?.description ? item()!.description + '. ' : '' }}We're still building this tool.
        In the meantime, you can check and improve your CV with the CV Checker.
      </p>
      <div class="actions">
        <a class="cta" href="/check">Check my CV</a>
        <a class="secondary" [href]="toolsHref">See all tools</a>
      </div>
    </section>
  `,
  styleUrl: './coming-soon.scss',
})
export class ComingSoon {
  /** The :slug route parameter. */
  readonly slug = input<string>();
  /** Route data for placeholders that aren't in the Services menu (e.g. cover letter examples). */
  readonly soonTitle = input<string>();
  readonly soonDescription = input<string>();
  readonly item = computed(() => {
    const title = this.soonTitle();
    if (title) return { title, description: this.soonDescription() ?? '' };
    return itemBySlug(this.slug() ?? '');
  });
  readonly toolsHref = TOOLS_HREF;
}
