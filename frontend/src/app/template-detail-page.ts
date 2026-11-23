import { Component, computed, inject, input } from '@angular/core';
import { AuthService } from './auth.service';
import { CvFlow } from './cv-flow';
import { CvSheet } from './cv-sheet';
import { CV_TEMPLATES, SAMPLE_CV, TEMPLATES_HREF, templateById } from './cv-templates';
import { CHECK_HREF } from './menu-config';
import { TemplateIcon } from './template-icon';

/** The /check link that opens the checker with a template chosen (behind sign-up for guests). */
export const useTemplatePath = (id: string) => `${CHECK_HREF}?template=${id}`;

/** /templates/:name: one template with a large preview and "Use this template". */
@Component({
  selector: 'app-template-detail-page',
  imports: [CvSheet, TemplateIcon],
  template: `
    @let current = template()!;
    <a class="back" [href]="templatesHref"><span aria-hidden="true">‹</span> All templates</a>
    <div class="layout">
      <div class="stage">
        <app-cv-sheet
          class="sheet"
          [text]="sample"
          [template]="current.id"
          [attr.aria-label]="'Sample CV in the ' + current.name + ' template'"
          role="img"
        />
      </div>
      <aside class="side" aria-labelledby="template-title">
        <p class="pill-badge">Template</p>
        <h1 id="template-title">
          <app-template-icon [template]="current.id" /> {{ current.name }}
        </h1>
        <p class="lede">{{ current.description }}</p>
        <ul class="tags" role="list" aria-label="Features">
          @for (tag of current.tags; track tag) {
            <li class="tag">{{ tag }}</li>
          }
        </ul>
        <a class="cta use" [href]="useHref()" (click)="choose()">Use this template</a>
        <p class="note">
          One column of real text with standard headings, so applicant tracking systems read every
          line. You can switch templates any time before you download.
        </p>
        <h2 class="others-title">Other templates</h2>
        <ul class="others" role="list">
          @for (other of others(); track other.id) {
            <li>
              <a [href]="templatesHref + '/' + other.id">
                <app-template-icon [template]="other.id" />
                <span>
                  <span class="other-name">{{ other.name }}</span>
                  <span class="other-tagline">{{ other.tagline }}</span>
                </span>
              </a>
            </li>
          }
        </ul>
      </aside>
    </div>
  `,
  styleUrl: './template-detail-page.scss',
})
export class TemplateDetailPage {
  /** The :name route parameter; templateGuard only lets known template ids through. */
  readonly name = input.required<string>();
  readonly template = computed(() => templateById(this.name()) ?? CV_TEMPLATES[0]);
  readonly others = computed(() => CV_TEMPLATES.filter((t) => t.id !== this.template().id));
  readonly useHref = computed(() => this.auth.gate(useTemplatePath(this.template().id)));
  readonly sample = SAMPLE_CV;
  readonly templatesHref = TEMPLATES_HREF;
  private readonly auth = inject(AuthService);
  private readonly flow = inject(CvFlow);

  /** Remembered on this device too, so the choice survives sign-up and email confirmation. */
  choose(): void {
    this.flow.setTemplate(this.template().id);
  }
}
