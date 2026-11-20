import { Component, input } from '@angular/core';
import { SAMPLE_JOBS } from './hurdles-config';

/** Fictional job list with match badges; rows and bars animate in when `play` turns on. */
@Component({
  selector: 'app-job-match-mock',
  template: `
    <figure class="mock" [class.play]="play()">
      <figcaption class="head">
        <span>Jobs for you</span>
        <span class="hint">Sample · sorted by match</span>
      </figcaption>
      <ul role="list">
        @for (job of jobs; track job.title; let i = $index) {
          <li [style.--i]="i">
            <span class="logo" aria-hidden="true">{{ job.company[0] }}</span>
            <div class="info">
              <p class="title">{{ job.title }}</p>
              <p class="meta">{{ job.company }} · {{ job.location }}</p>
              <span class="bar" aria-hidden="true"
                ><span
                  [attr.data-tone]="tone(job.match)"
                  [style.width.%]="play() ? job.match : 0"
                ></span
              ></span>
            </div>
            <span class="match" [attr.data-tone]="tone(job.match)">{{ job.match }}% match</span>
          </li>
        }
      </ul>
    </figure>
  `,
  styleUrl: './job-match-mock.scss',
})
export class JobMatchMock {
  readonly play = input(false);
  readonly jobs = SAMPLE_JOBS;

  tone(match: number): 'good' | 'fair' | 'poor' {
    return match >= 85 ? 'good' : match >= 60 ? 'fair' : 'poor';
  }
}
