import { CHECK_HREF, SIGNUP_HREF } from './menu-config';

/**
 * Single source of truth for the /pricing page: plans, prices, comparison rows and FAQ.
 * Prices are plain numbers in euros; formatEuro() renders them in German format (9,99 €).
 */
export type Billing = 'monthly' | 'yearly';
export type PlanId = 'free' | 'pro' | 'lifetime';

export type PlanPrice =
  | { kind: 'free' }
  | { kind: 'subscription'; monthly: number; yearlyPerMonth: number; yearlyTotal: number }
  | { kind: 'once'; amount: number };

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: PlanPrice;
  features: readonly string[];
  /** Shown as a badge and visually highlights the card. */
  highlight?: string;
  cta: { label: string; href: string; style: 'primary' | 'secondary' };
}

/** The Free plan opens the CV Checker; guests sign up first (PricingCard gates the link). */
const FREE_HREF = CHECK_HREF;
/**
 * Paid plans lead to sign-up for now; nothing is charged yet.
 * TODO(stripe): send Pro and Lifetime to Stripe Checkout (after sign-up) and set profiles.plan
 * from the Stripe webhook on the backend.
 */
const PAID_HREF = SIGNUP_HREF;

export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For trying it out',
    price: { kind: 'free' },
    features: [
      '1 CV',
      'AI CV score',
      '3 AI bullet point rewrites',
      'Basic templates',
      'PDF download',
    ],
    cta: { label: 'Get started', href: FREE_HREF, style: 'secondary' },
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For active job seekers',
    price: { kind: 'subscription', monthly: 9.99, yearlyPerMonth: 6.99, yearlyTotal: 83.88 },
    features: [
      'Unlimited CVs',
      'Unlimited AI rewrites & summaries',
      'ATS keyword scanner',
      'Tailor CV to any job description',
      'Cover letter generator',
      'All premium templates',
      'PDF & DOCX export',
    ],
    highlight: 'Most popular',
    cta: { label: 'Start Pro', href: PAID_HREF, style: 'primary' },
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    tagline: 'Pay once, use forever',
    price: { kind: 'once', amount: 49 },
    features: ['Everything in Pro', 'All future features', 'Priority support'],
    cta: { label: 'Get lifetime access', href: PAID_HREF, style: 'secondary' },
  },
];

/** A cell is included (true), not included (false), or a short limit such as "3". */
export type ComparisonValue = boolean | string;

export interface ComparisonRow {
  feature: string;
  values: Record<PlanId, ComparisonValue>;
}

export const COMPARISON: readonly ComparisonRow[] = [
  { feature: 'CVs', values: { free: '1', pro: 'Unlimited', lifetime: 'Unlimited' } },
  { feature: 'AI CV score', values: { free: true, pro: true, lifetime: true } },
  {
    feature: 'AI bullet point rewrites',
    values: { free: '3', pro: 'Unlimited', lifetime: 'Unlimited' },
  },
  { feature: 'AI summaries', values: { free: false, pro: 'Unlimited', lifetime: 'Unlimited' } },
  { feature: 'ATS keyword scanner', values: { free: false, pro: true, lifetime: true } },
  { feature: 'Tailor CV to a job description', values: { free: false, pro: true, lifetime: true } },
  { feature: 'Cover letter generator', values: { free: false, pro: true, lifetime: true } },
  { feature: 'Templates', values: { free: 'Basic', pro: 'All premium', lifetime: 'All premium' } },
  { feature: 'PDF download', values: { free: true, pro: true, lifetime: true } },
  { feature: 'DOCX export', values: { free: false, pro: true, lifetime: true } },
  { feature: 'Priority support', values: { free: false, pro: false, lifetime: true } },
  {
    feature: 'Billing',
    values: { free: 'Free', pro: 'Monthly or yearly', lifetime: 'One-time' },
  },
];

export interface FaqItem {
  question: string;
  answer: string;
  link?: { label: string; href: string };
}

export const FAQ: readonly FaqItem[] = [
  {
    question: 'Can I really use it for free?',
    answer:
      'Yes. The Free plan costs nothing and needs no credit card. It includes one CV, an AI CV score, three AI bullet point rewrites, basic templates and PDF download. Upgrade only if you need more.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Pro is billed monthly or yearly and you can cancel whenever you like. You keep Pro until the end of the period you already paid for. Lifetime is a single payment, so there is nothing to cancel.',
  },
  {
    // TODO (GDPR/DSGVO): check this against the privacy policy before launch, including how
    // long Anthropic retains API inputs and the region of the Supabase project.
    question: 'Is my data safe?',
    answer:
      'We are building ApplyCraft to follow the GDPR (DSGVO). When you check your CV, it is sent over an encrypted connection to our server to read the text, and to our AI provider (Anthropic) for the analysis. Without an account, your CV is never stored: your progress stays in your browser on this device. If you save CVs to your account, they are stored securely in the EU and you can delete them, or your whole account, anytime in Settings. We never sell your data.',
  },
  {
    question: 'Will my CV pass ATS systems?',
    answer:
      'No tool can guarantee that, because every company configures its ATS differently. ApplyCraft helps you avoid the common problems, like layouts the ATS cannot read and missing keywords from the job description, so your CV has a much better chance.',
  },
  {
    question: "What's the difference between Pro and Lifetime?",
    answer:
      'Both include every Pro feature. Pro is a subscription you can cancel anytime. Lifetime is a one-time payment that also includes all future features and priority support.',
  },
  {
    question: 'Do you offer student discounts?',
    // TODO: add a "Contact us" link here once there is a real support address.
    answer: 'We would like to help students. Contact details for discount requests will be added here soon.',
  },
];

const euro = (fractionDigits: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

/** German euro format: 9,99 € and 49 € (whole amounts drop the cents). */
export const formatEuro = (amount: number): string =>
  euro(Number.isInteger(amount) ? 0 : 2).format(amount);

/** Percentage saved by paying yearly, derived from the first subscription plan. */
export const yearlySaving = (): number => {
  for (const plan of PLANS) {
    if (plan.price.kind === 'subscription') {
      return Math.round((1 - plan.price.yearlyPerMonth / plan.price.monthly) * 100);
    }
  }
  return 0;
};
