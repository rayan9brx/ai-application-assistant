import { CERTIFICATES, TRAILING_YEAR, isHeading, isProse } from './classic-cv';

/**
 * The CV templates, the sample CV used to show them, and the example CVs. The ids match the
 * backend's CvTemplate enum and the check constraint on cvs.template (V5 migration); the
 * layouts are drawn by CvSheet here and by PdfExportService in the PDF.
 */
export type CvTemplateId = 'classic' | 'simple' | 'modern' | 'compact' | 'creative';

export interface CvTemplate {
  id: CvTemplateId;
  name: string;
  /** Shown in the template picker and on /templates; defaults to the name. */
  label?: string;
  /** One line, for the mega menu and the picker. */
  tagline: string;
  description: string;
  tags: readonly string[];
}

export const CV_TEMPLATES: readonly CvTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    label: 'Classic (recommended)',
    tagline: 'Calibri-style, black and white, one column',
    description:
      'The standard German-style CV: Carlito (Calibri) font, black text, bold headings over a thin rule and dates on the right. Built for applicant tracking systems.',
    tags: ['ATS-friendly', '1 page', 'Recommended'],
  },
  {
    id: 'simple',
    name: 'Simple',
    tagline: 'Clean, classic, single column',
    description:
      'A classic layout with clear black headings. Works for every industry and every applicant tracking system.',
    tags: ['ATS-friendly', '1 page', 'Classic'],
  },
  {
    id: 'modern',
    name: 'Modern',
    tagline: 'Accent color headings, clear sections',
    description:
      'Your name and section headings in an accent color, with ruled sections that make the CV easy to scan.',
    tags: ['ATS-friendly', '1 page', 'Accent color'],
  },
  {
    id: 'compact',
    name: 'Compact',
    tagline: 'Fits more content on one page',
    description:
      'Tighter margins and spacing, so more experience fits on one page without looking crowded.',
    tags: ['ATS-friendly', '1–2 pages', 'Dense'],
  },
  {
    id: 'creative',
    name: 'Creative',
    tagline: 'A colored top bar, still ATS-friendly',
    description:
      'A colored bar with your name and contact details. Everything stays real text in one column.',
    tags: ['ATS-friendly', '1 page', 'Color bar'],
  },
];

export const DEFAULT_TEMPLATE: CvTemplateId = 'classic';
export const TEMPLATES_HREF = '/templates';
export const EXAMPLES_HREF = '/examples';
export const COVER_LETTER_EXAMPLES_HREF = '/examples/cover-letters';

export const isTemplateId = (id: unknown): id is CvTemplateId =>
  CV_TEMPLATES.some((template) => template.id === id);

export const templateById = (id: string | null | undefined): CvTemplate | undefined =>
  CV_TEMPLATES.find((template) => template.id === id);

/** The fictional person every template preview shows. */
export const SAMPLE_CV = `Jonas Weber
Software Engineer
jonas.weber@example.com · +49 40 5550 1234 · Hamburg, Germany

Summary
Software engineer with 5 years of experience building web platforms in Java and TypeScript. Cut page load times by 40% and led the move of a monolith to cloud services.

Experience
Senior Software Engineer, Northwind Logistics   2022 – Present
- Led a team of 4 to rebuild the shipment tracking app in Angular, used by 12,000 customers a day
- Reduced API response times by 40% by adding caching and query indexes
- Introduced code reviews and CI checks that cut production bugs by a third

Software Engineer, Harbor Digital   2019 – 2022
- Built REST APIs in Spring Boot for 3 client projects
- Automated deployments with Docker and GitHub Actions

Education
B.Sc. Computer Science, University of Hamburg   2015 – 2019

Skills
Java, Spring Boot, TypeScript, Angular, PostgreSQL, Docker, AWS, Git

Languages
German (native), English (C1)`;

export interface CvExample {
  slug: string;
  role: string;
  city: string;
  template: CvTemplateId;
  /** Why this CV works, in a few short points. */
  why: readonly string[];
  text: string;
}

export const CV_EXAMPLES: readonly CvExample[] = [
  {
    slug: 'frontend-developer',
    role: 'Frontend Developer',
    city: 'Berlin',
    template: 'modern',
    why: [
      'Every bullet starts with a verb and ends with a result, often a number.',
      'The skills match the words in typical Berlin frontend job ads (React, TypeScript, testing).',
      'Links to GitHub and a portfolio let recruiters see real work.',
    ],
    text: `Mira Schneider
Frontend Developer
mira.schneider@example.com · +49 30 5550 1842 · Berlin, Germany · github.com/mira-schneider-example

Summary
Frontend developer with 4 years of experience building fast, accessible web apps in React and TypeScript. Shipped a design system used by 6 product teams.

Experience
Frontend Developer, Spreebyte GmbH   2022 – Present
- Built a React and TypeScript design system with 40 components, now used by 6 product teams
- Improved Lighthouse performance scores from 62 to 95 on the main booking flow
- Cut checkout errors by 25% by adding form validation and end-to-end tests with Playwright

Junior Frontend Developer, Kiezlabs   2020 – 2022
- Developed responsive landing pages that raised sign-ups by 18%
- Moved a legacy jQuery app to React, one page at a time, without downtime

Education
B.Sc. Media Informatics, HTW Berlin   2016 – 2020

Skills
React, TypeScript, JavaScript, Next.js, CSS, Accessibility (WCAG), Jest, Playwright, Git, Figma

Languages
German (native), English (C1)`,
  },
  {
    slug: 'data-analyst',
    role: 'Data Analyst',
    city: 'Munich',
    template: 'simple',
    why: [
      'The summary says in one sentence what the candidate does and for whom.',
      'Results are measurable: saved hours, higher accuracy, faster reports.',
      'A plain, classic layout lets the tools and numbers stand out.',
    ],
    text: `Felix Brandt
Data Analyst
felix.brandt@example.com · +49 89 5550 2671 · Munich, Germany · linkedin.com/in/felix-brandt-example

Summary
Data analyst with 3 years of experience turning sales and customer data into clear reports for management. Strong in SQL, Python and Power BI.

Experience
Data Analyst, Isarwerk Retail AG   2022 – Present
- Built 12 Power BI dashboards that replaced weekly Excel reports and saved 15 hours a week
- Improved the sales forecast accuracy from 78% to 91% with a Python model
- Wrote SQL pipelines that combine data from 4 shop systems into one data warehouse

Junior Data Analyst, Alpenblick Insurance   2021 – 2022
- Cleaned and analysed customer survey data for 20,000 policyholders
- Presented churn findings to the management team, leading to a new retention campaign

Education
M.Sc. Statistics, LMU Munich   2019 – 2021
B.Sc. Economics, University of Augsburg   2016 – 2019

Skills
SQL, Python (pandas, scikit-learn), Power BI, Excel, Tableau, A/B testing, Statistics

Languages
German (native), English (C1)`,
  },
  {
    slug: 'it-working-student',
    role: 'IT Working Student (Werkstudent)',
    city: 'Stuttgart',
    template: 'compact',
    why: [
      'Little work experience, so projects and studies get real space.',
      'The availability (20 hours a week) answers the first question a recruiter asks.',
      'The compact layout keeps studies, jobs and projects on one page.',
    ],
    text: `Aylin Demir
IT Working Student (Werkstudentin) · available 20 hours/week
aylin.demir@example.com · +49 711 5550 3390 · Stuttgart, Germany · github.com/aylin-demir-example

Summary
Computer science student (5th semester) looking for a working student role in software development or IT support. Experience with Java, Python and Linux from studies, a part-time job and side projects.

Experience
IT Support Assistant (part-time), Neckar Stadtwerke   2023 – Present
- Resolve about 30 support tickets a week for 200 employees (hardware, accounts, Microsoft 365)
- Wrote a PowerShell script that sets up new laptops in 20 minutes instead of 2 hours

Tutor for Programming 1, University of Stuttgart   2023 – 2024
- Ran weekly Java exercise groups for 25 first-year students

Projects
- Study planner app (Java, Spring Boot, PostgreSQL) used by 150 students in my faculty
- Home server with Docker and Linux for backups and a private Git server

Education
B.Sc. Computer Science, University of Stuttgart   2022 – Present
Abitur, Hegel-Gymnasium Stuttgart   2014 – 2022

Skills
Java, Python, SQL, Spring Boot, Linux, Docker, Git, PowerShell, Microsoft 365

Languages
German (native), Turkish (native), English (B2)`,
  },
];

export const exampleBySlug = (slug: string | null | undefined): CvExample | undefined =>
  CV_EXAMPLES.find((example) => example.slug === slug);

/* Parsing: the same rules as PdfExportService.generateCv on the backend. */

export type CvBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'entry'; title: string; dates: string }
  | { kind: 'text'; text: string }
  | { kind: 'gap' };

export interface ParsedCv {
  name: string;
  /** Shown in the template picker and on /templates; defaults to the name. */
  label?: string;
  contact: string[];
  blocks: CvBlock[];
}

const BULLET = /^\s*[-•*–▪●]\s+/;
const ENTRY = /^(.*\S)\s{2,}(\S.{0,34})$/;

/** Headings, header and certificate dates follow the Classic reading (classic-cv.ts). */
export function parseCv(text: string): ParsedCv {
  const lines = text.replace(/\t/g, '    ').split(/\r\n?|\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const name = i < lines.length ? lines[i++].trim() : '';
  const contact: string[] = [];
  // The header ends at the first prose line: that is the summary's start, never header text.
  while (i < lines.length && contact.length < 3 && lines[i].trim() && !isHeading(lines[i].trim()) && !isProse(lines[i].trim())) {
    contact.push(lines[i++].trim());
  }
  const blocks: CvBlock[] = [];
  let certificates = false;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) blocks.push({ kind: 'gap' });
    else if (isHeading(line)) {
      blocks.push({ kind: 'heading', text: line.replace(/:$/, '').toUpperCase() });
      certificates = CERTIFICATES.test(line);
    } else if (BULLET.test(raw)) blocks.push({ kind: 'bullet', text: raw.replace(BULLET, '').trim() });
    else {
      const entry = ENTRY.exec(line) ?? (certificates ? TRAILING_YEAR.exec(line) : null);
      if (entry && /\d/.test(entry[2])) blocks.push({ kind: 'entry', title: entry[1], dates: entry[2] });
      else blocks.push({ kind: 'text', text: line });
    }
  }
  return { name, contact, blocks };
}
