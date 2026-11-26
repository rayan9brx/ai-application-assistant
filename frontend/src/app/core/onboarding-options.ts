/**
 * The onboarding steps, also used by Settings → Job preferences and the admin charts.
 * Option keys must match OnboardingController's allowed values on the backend.
 */
export interface OnboardingAnswers {
  challenge: string | null;
  foundJobs: string | null;
  searchStatus: string | null;
  experienceLevel: string | null;
  roles: string[];
  workModes: string[];
  locations: string[];
  minSalary: string | null;
}

export type SingleField = 'challenge' | 'foundJobs' | 'searchStatus' | 'experienceLevel' | 'minSalary';
export type ListField = 'roles' | 'workModes' | 'locations';

export interface OnboardingOption {
  key: string;
  label: string;
  sub?: string;
}

interface StepBase {
  title: string;
  /** Short name for Settings and the admin dashboard. */
  short: string;
  /** The backend's column, for the admin stats. */
  column: string;
  hint?: string;
}
export type OnboardingStep = StepBase &
  (
    | { kind: 'single' | 'pills'; field: SingleField; options: OnboardingOption[] }
    | { kind: 'multi'; field: 'roles' | 'workModes'; options: OnboardingOption[]; grid?: boolean }
    | { kind: 'chips'; field: 'locations'; suggestions: string[] }
  );

export const EMPTY_ANSWERS: OnboardingAnswers = {
  challenge: null,
  foundJobs: null,
  searchStatus: null,
  experienceLevel: null,
  roles: [],
  workModes: [],
  locations: [],
  minSalary: null,
};

export const MAX_LOCATIONS = 20;
export const MAX_LOCATION_CHARS = 60;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    kind: 'single',
    field: 'challenge',
    column: 'challenge',
    short: 'Biggest challenge',
    title: 'What’s your biggest challenge right now?',
    options: [
      { key: 'cv_quality', label: 'I’m not sure my CV is good enough' },
      { key: 'ats', label: 'My CV doesn’t pass ATS filters' },
      { key: 'tailor', label: 'I need to tailor my CV to a specific job' },
      { key: 'job_search', label: 'I don’t know which jobs to apply for' },
    ],
  },
  {
    kind: 'single',
    field: 'foundJobs',
    column: 'found_jobs',
    short: 'Found jobs to apply for',
    title: 'Have you already found jobs you want to apply for?',
    options: [
      { key: 'one', label: 'Yes, one specific job' },
      { key: 'many', label: 'Yes, many jobs' },
      { key: 'looking', label: 'No, I’m still looking' },
      { key: 'not_applying', label: 'No, I’m not actively applying yet' },
    ],
  },
  {
    kind: 'single',
    field: 'searchStatus',
    column: 'search_status',
    short: 'Job search status',
    title: 'What is your job search status?',
    options: [
      { key: 'active', label: 'Actively looking', sub: 'Ready to interview and change soon' },
      { key: 'open', label: 'Open to offers', sub: 'Not searching, but open to great roles' },
      { key: 'not_looking', label: 'Not looking', sub: 'Just curious for now' },
    ],
  },
  {
    kind: 'single',
    field: 'experienceLevel',
    column: 'experience_level',
    short: 'Experience level',
    title: 'What is your level of experience?',
    options: [
      { key: 'student', label: 'Student / Internship', sub: 'Still studying or first steps' },
      { key: 'entry', label: 'Entry level', sub: '0–2 years' },
      { key: 'mid', label: 'Mid level', sub: '2–5 years' },
      { key: 'senior', label: 'Senior', sub: '5+ years' },
      { key: 'lead', label: 'Lead / Manager', sub: 'Responsible for a team' },
    ],
  },
  {
    kind: 'multi',
    field: 'roles',
    column: 'roles',
    short: 'Roles',
    title: 'What roles interest you?',
    hint: 'Choose all that apply.',
    grid: true,
    options: [
      { key: 'engineering', label: 'Engineering', sub: 'Software, hardware and data' },
      { key: 'design', label: 'Design', sub: 'UI/UX, web and product design' },
      { key: 'product', label: 'Product', sub: 'Product management' },
      { key: 'data_ai', label: 'Data & AI', sub: 'Analytics, ML and research' },
      { key: 'marketing', label: 'Marketing', sub: 'Growth, content and SEO' },
      { key: 'sales', label: 'Sales', sub: 'Sales and business development' },
      { key: 'finance', label: 'Finance' },
      { key: 'hr', label: 'HR & Recruiting' },
      { key: 'operations', label: 'Operations' },
      { key: 'support', label: 'Customer Support' },
      { key: 'other', label: 'Other' },
    ],
  },
  {
    kind: 'multi',
    field: 'workModes',
    column: 'work_modes',
    short: 'Work mode',
    title: 'Where would you like to work?',
    hint: 'Choose all that apply.',
    options: [
      { key: 'onsite', label: 'On-site', sub: 'In the office' },
      { key: 'hybrid', label: 'Hybrid', sub: 'Mix of office and remote' },
      { key: 'remote', label: 'Remote', sub: 'From anywhere' },
    ],
  },
  {
    kind: 'chips',
    field: 'locations',
    column: 'locations',
    short: 'Preferred locations',
    title: 'Preferred work locations',
    suggestions: [
      'Berlin',
      'Munich',
      'Hamburg',
      'Frankfurt',
      'Cologne',
      'Stuttgart',
      'Düsseldorf',
      'Leipzig',
      'Dresden',
      'Hanover',
      'Nuremberg',
      'Magdeburg',
      'Remote',
    ],
  },
  {
    kind: 'pills',
    field: 'minSalary',
    column: 'min_salary',
    short: 'Minimum salary',
    title: 'Minimum annual salary',
    hint: 'We’ll use this to prioritize job matches. Roles without a salary range still show up.',
    options: [
      { key: 'any', label: 'Any' },
      { key: '40k', label: '€40k+' },
      { key: '50k', label: '€50k+' },
      { key: '60k', label: '€60k+' },
      { key: '80k', label: '€80k+' },
      { key: '100k', label: '€100k+' },
    ],
  },
];

/** Whether a step has an answer, so "Continue" can be pressed. */
export function isAnswered(step: OnboardingStep, answers: OnboardingAnswers): boolean {
  const value = answers[step.field];
  return Array.isArray(value) ? value.length > 0 : !!value;
}

/** Where "Continue" on the success screen leads, from the step 1 answer. */
export function destinationFor(answers: OnboardingAnswers): string {
  if (answers.challenge === 'job_search') return '/dashboard';
  if (answers.challenge === 'tailor') return '/tailor';
  return '/check';
}

/** A location chip's cleaned text, or '' when it can't be added. */
export function cleanLocation(text: string, existing: string[]): string {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, MAX_LOCATION_CHARS);
  if (!clean || existing.length >= MAX_LOCATIONS) return '';
  return existing.some((l) => l.toLowerCase() === clean.toLowerCase()) ? '' : clean;
}
