import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { CvSheet } from '../../shared/cv-sheet';
import { CV_EXAMPLES, TEMPLATES_HREF, templateById } from '../../core/cv-templates';
import { CHECK_HREF } from '../../core/menu-config';
import { TemplateIcon } from '../../shared/template-icon';

/** The /check link that opens an example CV as a starting point. */
export const useExamplePath = (slug: string) => `${CHECK_HREF}?example=${slug}`;

/** /examples: strong example CVs of fictional people, with why each one works. */
@Component({
  selector: 'app-examples-page',
  imports: [CvSheet, TemplateIcon],
  template: `
    <section aria-labelledby="examples-title">
      <header class="intro">
        <p class="pill-badge">Examples</p>
        <h1 id="examples-title">CV examples that get interviews</h1>
        <p class="lede">
          Three strong CVs for jobs in Germany, each in one of our templates. The people are
          fictional; the structure is what recruiters and applicant tracking systems look for.
        </p>
      </header>
      <ol class="examples" role="list">
        @for (example of examples; track example.slug) {
          @let template = templateFor(example.template);
          <li class="example" [attr.aria-labelledby]="'example-' + example.slug">
            <div class="preview">
              <app-cv-sheet [text]="example.text" [template]="example.template" crop="1 / 1.2" [decorative]="true" />
            </div>
            <div class="info">
              <h2 [id]="'example-' + example.slug">{{ example.role }}</h2>
              <p class="meta">
                <span>{{ example.city }}</span>
                <span aria-hidden="true">·</span>
                <a class="template-link" [href]="templatesHref + '#' + example.template">
                  <app-template-icon [template]="example.template" /> {{ template.name }} template
                </a>
              </p>
              <h3>Why it works</h3>
              <ul class="why">
                @for (point of example.why; track point) {
                  <li>{{ point }}</li>
                }
              </ul>
              <a class="cta use" [href]="auth.gate(usePath(example.slug))">Use this example</a>
            </div>
          </li>
        }
      </ol>
    </section>
  `,
  styleUrl: './examples-page.scss',
})
export class ExamplesPage {
  readonly examples = CV_EXAMPLES;
  readonly templatesHref = TEMPLATES_HREF;
  readonly usePath = useExamplePath;
  readonly auth = inject(AuthService);

  templateFor(id: string) {
    return templateById(id)!;
  }
}
