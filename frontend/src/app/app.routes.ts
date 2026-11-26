import { inject } from '@angular/core';
import { ResolveFn, Router, Routes } from '@angular/router';
import { adminGuard } from './core/admin-role';
import { authGuard, guestGuard } from './core/auth.guard';
import { TEMPLATES_HREF, templateById } from './core/cv-templates';
import { itemBySlug } from './core/menu-config';

export const SITE_TITLE = 'Rezumo — Your application workspace';

const comingSoonTitle: ResolveFn<string> = (route) =>
  `${itemBySlug(route.paramMap.get('slug') ?? '')?.title ?? 'Coming soon'} — Rezumo`;

export const routes: Routes = [
  { path: '', title: SITE_TITLE, loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage) },
  {
    path: 'check',
    title: 'CV Checker — Rezumo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/check/cv-check-page').then((m) => m.CvCheckPage),
  },
  {
    path: 'tailor',
    title: 'Tailor your CV to a job — Rezumo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tailor/tailor-page').then((m) => m.TailorPage),
  },
  {
    path: 'pricing',
    title: 'Pricing — Rezumo',
    loadComponent: () => import('./features/pricing/pricing-page').then((m) => m.PricingPage),
  },
  {
    path: 'templates',
    title: 'ATS-friendly CV templates — Rezumo',
    loadComponent: () => import('./features/templates/templates-page').then((m) => m.TemplatesPage),
  },
  // The old detail pages: /templates/modern → /templates#modern (unknown names → /templates).
  {
    path: 'templates/:name',
    redirectTo: ({ params }) =>
      inject(Router).createUrlTree([TEMPLATES_HREF], {
        fragment: templateById(params['name'])?.id,
      }),
  },
  {
    path: 'examples',
    title: 'CV examples — Rezumo',
    loadComponent: () => import('./features/examples/examples-page').then((m) => m.ExamplesPage),
  },
  {
    path: 'examples/cover-letters',
    title: 'Cover Letter Examples — Rezumo',
    data: { soonTitle: 'Cover Letter Examples', soonDescription: 'Effective cover letter samples' },
    loadComponent: () => import('./shared/coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'tools',
    title: 'All tools — Rezumo',
    loadComponent: () => import('./features/tools/tools-page').then((m) => m.ToolsPage),
  },
  {
    path: 'tools/:slug',
    title: comingSoonTitle,
    loadComponent: () => import('./shared/coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'login',
    title: 'Log in — Rezumo',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'signup',
    title: 'Create your account — Rezumo',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/signup-page').then((m) => m.SignupPage),
  },
  {
    path: 'reset-password',
    title: 'Reset your password — Rezumo',
    loadComponent: () => import('./features/auth/reset-password-page').then((m) => m.ResetPasswordPage),
  },
  // Legal pages, in English and German (?lang=de); the texts live in public/legal/*.{en,de}.md.
  {
    path: 'imprint',
    title: 'Imprint (Impressum) — Rezumo',
    data: { legalDoc: 'imprint', title: 'Imprint (Impressum)' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  /*
   * TODO(privacy): the privacy policy (public/legal/privacy.{en,de}.md) must cover at least:
   * - Cookieless analytics: on each page view the backend stores the path, the referring
   *   website, mobile/desktop, and country and city looked up offline from the IP address
   *   (DB-IP Lite / GeoLite2, with the attribution its licence requires). The IP address
   *   itself is never stored; a visitor hash of IP + user agent + a random salt that is
   *   deleted daily only counts unique visitors per day. No cookies, no third-party scripts.
   *   Legal basis: legitimate interest (Art. 6(1)(f) GDPR). The user's latest country is
   *   also kept on their profile.
   * - AI usage: token counts per AI request (score, fix, tailor), linked to the account, to
   *   monitor costs. No AI prompts or answers are stored.
   * - Smart prompt box: what people type there (cut to 300 characters), the feature it was
   *   routed to, the user id when signed in, and the time; shown to admins without user
   *   details and deleted after 90 days (app.prompts.retention-days=90).
   * - Admin access: admins can see account metadata (email, sign-up and last login, country,
   *   number of CVs, plan) and open a CV's content only for support or abuse handling; every
   *   view is logged with the admin, CV, reason and time. No bulk export of CVs.
   * - Retention: page views are deleted after 12 months (app.analytics.retention-days=365),
   *   visitor salts after one day. CVs and scores are deleted with the account (or CV); AI
   *   usage rows lose their user id when the account is deleted. Decide and state how long the
   *   admin audit log is kept.
   */
  {
    path: 'privacy',
    title: 'Privacy Policy (Datenschutzerklärung) — Rezumo',
    data: { legalDoc: 'privacy', title: 'Privacy Policy (Datenschutzerklärung)' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'terms',
    title: 'Terms of Service (AGB) — Rezumo',
    data: { legalDoc: 'terms', title: 'Terms of Service (AGB)' },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  // German paths people may type or link to; they open the German version.
  { path: 'impressum', redirectTo: '/imprint?lang=de' },
  { path: 'datenschutz', redirectTo: '/privacy?lang=de' },
  { path: 'agb', redirectTo: '/terms?lang=de' },
  {
    path: 'dashboard',
    title: 'Dashboard — Rezumo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'documents',
    title: 'My Documents — Rezumo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/documents/documents-page').then((m) => m.DocumentsPage),
  },
  {
    path: 'builder/:cvId',
    title: 'CV Builder — Rezumo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/builder/builder-page').then((m) => m.BuilderPage),
  },
  {
    // The top bar's "Cover letters" tab; the tool isn't built yet.
    path: 'cover-letters',
    title: 'Cover letters — Rezumo',
    canActivate: [authGuard],
    data: { slug: 'cover-letter-generator' },
    loadComponent: () => import('./shared/coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'settings',
    title: 'Settings — Rezumo',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  {
    path: 'admin',
    title: 'Admin — Rezumo',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-page').then((m) => m.AdminPage),
  },
  // Unknown paths showed the landing page before the router; keep that.
  { path: '**', redirectTo: '' },
];
