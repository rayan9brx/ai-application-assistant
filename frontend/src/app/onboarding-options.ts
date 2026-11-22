/** Keys match AccountService.ONBOARDING_ANSWERS on the backend. */
export type OnboardingAnswer = 'cv_quality' | 'ats' | 'tailor' | 'job_search';

export interface OnboardingOption {
  key: OnboardingAnswer;
  label: string;
  /** Where "Continue" leads for this answer. */
  href: string;
}

/** `?focus=job` puts the cursor in /check's job description field. */
export const ONBOARDING_OPTIONS: OnboardingOption[] = [
  { key: 'cv_quality', label: 'I’m not sure my CV is good enough', href: '/check' },
  { key: 'ats', label: 'My CV doesn’t pass ATS filters', href: '/check' },
  { key: 'tailor', label: 'I need to tailor my CV to a specific job', href: '/check?focus=job' },
  { key: 'job_search', label: 'I don’t know which jobs to apply for', href: '/dashboard' },
];

/** Short labels for the admin chart. */
export const ONBOARDING_ANSWER_LABELS: Record<string, string> = {
  cv_quality: 'Not sure CV is good enough',
  ats: 'CV doesn’t pass ATS',
  tailor: 'Tailor CV to a job',
  job_search: 'Which jobs to apply for',
  skipped: 'Skipped',
};
