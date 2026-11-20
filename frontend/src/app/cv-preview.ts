import { Component, input } from '@angular/core';

export interface CvBullet {
  text: string;
  /** Highlighted as a weak or problematic line. */
  flagged?: boolean;
}

export interface CvRole {
  title: string;
  org: string;
  dates: string;
  bullets: readonly CvBullet[];
}

export interface CvData {
  name: string;
  title: string;
  contact: string;
  summary: string;
  roles: readonly CvRole[];
  education: { degree: string; school: string; dates: string };
  skills: string;
  skillsFlagged?: boolean;
}

/** Renders a CV as a white paper sheet. Place it on an `<article>` and label it. */
@Component({
  selector: 'article[app-cv-preview]',
  templateUrl: './cv-preview.html',
  styleUrl: './cv-preview.scss',
})
export class CvPreview {
  readonly cv = input.required<CvData>();
  readonly caption = input('');
}
