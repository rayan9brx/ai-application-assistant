import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Logo } from '../../shared/logo';

interface PreviewCv {
  title: string;
  edited: string;
  score: number;
}

/**
 * Decorative product preview on the right of /login and /signup: a mini dashboard window and a
 * floating keyword-matching card. Purely visual, so it is hidden from assistive technology.
 */
@Component({
  selector: 'app-auth-preview',
  imports: [Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage" aria-hidden="true">
      <div class="window">
        <div class="titlebar">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="address">app.rezumo.com/dashboard</span>
        </div>
        <div class="body">
          <aside class="sidebar">
            <p class="side-brand"><app-logo variant="white" [size]="16" /></p>
            @for (item of nav; track item.label; let first = $first) {
              <p class="side-item" [class.active]="first">
                <svg viewBox="0 0 20 20"><path [attr.d]="item.icon" /></svg>{{ item.label }}
              </p>
            }
          </aside>
          <div class="main">
            <div class="main-head">
              <div>
                <p class="main-title">My CVs</p>
                <p class="main-sub">4 CVs · last edited today</p>
              </div>
              <span class="new-cv">
                <svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" /></svg>Create new CV
              </span>
            </div>
            <div class="grid">
              @for (cv of cvs; track cv.title) {
                <div class="cv-card">
                  <div class="thumb">
                    <span class="t-name"></span>
                    <span class="t-role"></span>
                    <span class="t-rule"></span>
                    <span class="t-line"></span><span class="t-line short"></span>
                    <span class="t-line"></span><span class="t-line mid"></span>
                    <span class="t-rule"></span>
                    <span class="t-line"></span><span class="t-line short"></span>
                  </div>
                  <div class="cv-meta">
                    <p class="cv-title">{{ cv.title }}</p>
                    <p class="cv-edited">
                      {{ cv.edited }} <span class="cv-score">{{ cv.score }}</span>
                    </p>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <div class="keywords">
        <div class="kw-head">
          <p class="kw-title">
            <svg viewBox="0 0 20 20"><path d="M10 2.5l1.8 4.6 4.7.4-3.6 3 1.1 4.8L10 12.8l-4 2.5 1.1-4.8-3.6-3 4.7-.4z" /></svg>
            AI Keyword Matching
          </p>
          <span class="score">Score <strong>89</strong></span>
        </div>
        <ul>
          @for (keyword of keywords; track keyword) {
            <li>
              <span class="check"><svg viewBox="0 0 16 16"><path d="M4.5 8.5l2.2 2.2 4.8-5" /></svg></span
              >{{ keyword }}
            </li>
          }
        </ul>
      </div>
    </div>
  `,
  styleUrls: ['./auth-preview.scss', './auth-preview-cards.scss'],
})
export class AuthPreview {
  readonly nav = [
    { label: 'Dashboard', icon: 'M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z' },
    { label: 'CV Checker', icon: 'M5 2.5h7l3 3v12H5zM8 10l1.5 1.5L12.5 8' },
    { label: 'AI Fixes', icon: 'M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z' },
    { label: 'Tailor to Job', icon: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  ];
  readonly cvs: readonly PreviewCv[] = [
    { title: 'Frontend Developer', edited: 'Today', score: 89 },
    { title: 'Werkstudent IT', edited: '2 days ago', score: 82 },
    { title: 'Data Analyst', edited: 'Last week', score: 76 },
    { title: 'Internship 2025', edited: '3 weeks ago', score: 71 },
  ];
  readonly keywords = ['JavaScript', 'TypeScript', 'React', 'REST APIs', 'Testing', 'Accessibility', 'Git'];
}
