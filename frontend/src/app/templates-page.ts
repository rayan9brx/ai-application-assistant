import { Component } from '@angular/core';
import { CvSheet } from './cv-sheet';
import { CV_TEMPLATES, SAMPLE_CV, TEMPLATES_HREF } from './cv-templates';
import { TemplateIcon } from './template-icon';

/** /templates: every CV template with a large preview of the same sample CV. */
@Component({
  selector: 'app-templates-page',
  imports: [CvSheet, TemplateIcon],
  template: `
    <section class="templates" aria-labelledby="templates-title">
      <header class="intro">
        <p class="pill-badge">Templates</p>
        <h1 id="templates-title">ATS-friendly CV templates</h1>
        <p class="lede">
          Every template is built to pass applicant tracking systems. Pick a style and start in
          minutes.
        </p>
      </header>
      <ul class="grid" role="list">
        @for (template of templates; track template.id) {
          <li>
            <a class="card" [href]="href + '/' + template.id">
              <span class="preview">
                <app-cv-sheet [text]="sample" [template]="template.id" crop="4 / 3" [decorative]="true" />
              </span>
              <span class="info">
                <span class="name"><app-template-icon [template]="template.id" /> {{ template.name }}</span>
                <span class="description">{{ template.description }}</span>
                <span class="tags">
                  @for (tag of template.tags; track tag) {
                    <span class="tag">{{ tag }}</span>
                  }
                </span>
              </span>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styleUrl: './templates-page.scss',
})
export class TemplatesPage {
  readonly templates = CV_TEMPLATES;
  readonly sample = SAMPLE_CV;
  readonly href = TEMPLATES_HREF;
}
