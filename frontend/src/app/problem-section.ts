import { Component } from '@angular/core';
import { AtsPanel, AtsResult } from './ats-panel';
import { CvData } from './cv-preview';

/**
 * Illustrative ATS result. There is no ATS analysis backend yet; replace this
 * with a real analysis response once one exists.
 */
export const SAMPLE_ATS_RESULT: AtsResult = {
  platforms: ['Workday', 'Greenhouse', 'Lever', 'SAP SuccessFactors', 'Personio'],
  passed: false,
  match: 47,
  fields: [
    { label: 'Name', value: 'Detected', detected: true },
    { label: 'Contact Info', value: 'Detected', detected: true },
    { label: 'Experience', value: '3 positions detected', detected: true },
    { label: 'Skills', value: 'Parsed as body text', detected: false },
  ],
  matchedSkills: ['React', 'TypeScript', 'SQL', 'Git'],
  missingSkills: ['Agile', 'CI/CD', 'REST APIs', 'Testing', 'Cloud', 'Scrum'],
};

/** Fictional developer CV that matches the sample ATS result. */
export const SAMPLE_ATS_CV: CvData = {
  name: 'Taylor Brooks',
  title: 'Frontend Developer',
  contact: 'taylor.brooks@example.com · Hamburg, Germany · github.com/taylor-brooks-example',
  summary:
    'Frontend developer with four years of experience building web apps in React and TypeScript. Enjoys turning designs into fast, accessible interfaces.',
  roles: [
    {
      title: 'Frontend Developer',
      org: 'Northwind Labs',
      dates: '2022 – Present',
      bullets: [
        { text: 'Built a customer dashboard in React and TypeScript used by 40 internal teams.' },
        { text: 'Worked on the backend sometimes.', flagged: true },
        { text: 'Cut page load time by 35% by splitting bundles and lazy-loading images.' },
      ],
    },
    {
      title: 'Junior Web Developer',
      org: 'Pixelharbor Studio',
      dates: '2020 – 2022',
      bullets: [
        { text: 'Wrote SQL reports for client analytics and kept them in Git.' },
        { text: 'Helped with different projects.', flagged: true },
      ],
    },
    {
      title: 'Web Development Intern',
      org: 'Example Collective',
      dates: '2019 – 2020',
      bullets: [{ text: 'Maintained marketing pages and fixed layout bugs across browsers.' }],
    },
  ],
  education: {
    degree: 'B.Sc. Computer Science',
    school: 'Riverside University of Applied Sciences',
    dates: '2016 – 2020',
  },
  skills: 'React · TypeScript · SQL · Git · HTML & CSS · Figma',
  skillsFlagged: true,
};

@Component({
  selector: 'app-problem-section',
  imports: [AtsPanel],
  templateUrl: './problem-section.html',
  styleUrl: './problem-section.scss',
})
export class ProblemSection {
  readonly result = SAMPLE_ATS_RESULT;
  readonly cv = SAMPLE_ATS_CV;
}
