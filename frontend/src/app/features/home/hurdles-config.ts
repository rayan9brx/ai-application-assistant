/**
 * All copy and sample data for the "3 hurdles" section. Edit text here; the components only
 * lay it out. Sample jobs, bullets and scores are fictional illustrations, not real results.
 */
import { CHECK_HREF, itemBySlug } from '../../core/menu-config';

export type HurdleVisual = 'jobs' | 'rewrite' | 'ats';

export interface Hurdle {
  id: string;
  number: string;
  /** Short name for the progress stepper. */
  stepLabel: string;
  label: string;
  title: string;
  pain: string;
  benefits: readonly string[];
  cta: { label: string; href: string };
  visual: HurdleVisual;
}

const toolHref = (slug: string) => itemBySlug(slug)?.href ?? '/tools';

export const HURDLES_HEADER = {
  badge: 'How we help',
  title: '3 hurdles stand between you and your next job',
  text: 'Finding the right role. Writing a CV that fits it. Getting past the ATS. Most applicants fail at one of them without knowing it. We help you clear all three.',
};

export const HURDLES: readonly Hurdle[] = [
  {
    id: 'hurdle-01',
    number: '01',
    stepLabel: 'Find the right job',
    label: 'Hurdle 01',
    title: 'Finding a job that actually fits you',
    pain: "You scroll through hundreds of listings, apply to anything that looks close, and hear nothing back. Not because you're not good enough, but because the roles weren't the right match.",
    benefits: [
      'Smart job matching based on your skills and experience',
      'See your match score before you apply',
      'Focus on roles where you have a real chance',
    ],
    cta: { label: 'Find matching jobs', href: toolHref('job-search') },
    visual: 'jobs',
  },
  {
    id: 'hurdle-02',
    number: '02',
    stepLabel: 'Build a CV for that job',
    label: 'Hurdle 02',
    title: 'Sending the same CV everywhere',
    pain: "Recruiters spend seconds on each CV. A generic one gets skipped. But rewriting it for every application takes hours you don't have.",
    benefits: [
      'AI tailors your CV to each job description in minutes',
      'Stronger bullet points that show impact, not just tasks',
      'Clean, professional templates recruiters love',
    ],
    cta: { label: 'Build my tailored CV', href: CHECK_HREF },
    visual: 'rewrite',
  },
  {
    id: 'hurdle-03',
    number: '03',
    stepLabel: 'Pass the ATS',
    label: 'Hurdle 03',
    title: 'Getting filtered out before a human sees you',
    pain: 'Most companies screen CVs with software first. Wrong format, missing keywords, and your application disappears. No reply, no feedback.',
    benefits: [
      'Instant ATS score for your CV',
      "See exactly which keywords you're missing",
      'Fix formatting issues with one click',
    ],
    cta: { label: 'Check my CV for free', href: CHECK_HREF },
    visual: 'ats',
  },
];

export interface SampleJob {
  title: string;
  company: string;
  location: string;
  match: number;
}

/** Fictional postings for the job-match visual. */
export const SAMPLE_JOBS: readonly SampleJob[] = [
  {
    title: 'Frontend Developer',
    company: 'Northwind Labs',
    location: 'Hamburg · Hybrid',
    match: 92,
  },
  { title: 'UI Engineer', company: 'Pixelharbor Studio', location: 'Remote', match: 78 },
  { title: 'Data Analyst', company: 'Example Collective', location: 'Berlin', match: 41 },
];

/** Fictional before/after bullet for the rewrite visual. */
export const SAMPLE_REWRITE = {
  before: 'Responsible for website updates',
  after: 'Redesigned 12 landing pages in React, improving load time by 40%',
  tag: 'AI rewrite',
};

/** Fictional score change for the ATS visual. */
export const SAMPLE_ATS_SCORE = {
  from: 47,
  to: 89,
  keywords: ['React', 'TypeScript', 'REST APIs', 'CI/CD', 'Testing'],
};

export const HURDLES_CLOSING = {
  title: 'One tool. Three hurdles. Your next interview.',
  cta: { label: 'Start for free', href: CHECK_HREF },
  note: 'No credit card required',
};
