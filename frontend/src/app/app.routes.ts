import { inject } from '@angular/core';
import { ResolveFn, Router, Routes } from '@angular/router';
import { adminGuard } from './admin-role';
import { authGuard, guestGuard } from './auth.guard';
import { TEMPLATES_HREF, templateById } from './cv-templates';
import { itemBySlug } from './menu-config';

export const SITE_TITLE = 'ApplyCraft — Your application workspace';

const comingSoonTitle: ResolveFn<string> = (route) =>
  `${itemBySlug(route.paramMap.get('slug') ?? '')?.title ?? 'Coming soon'} — ApplyCraft`;

export const routes: Routes = [
  { path: '', title: SITE_TITLE, loadComponent: () => import('./home-page').then((m) => m.HomePage) },
  {
    path: 'check',
    title: 'CV Checker — ApplyCraft',
    canActivate: [authGuard],
    loadComponent: () => import('./cv-check-page').then((m) => m.CvCheckPage),
  },
  {
    path: 'pricing',
    title: 'Pricing — ApplyCraft',
    loadComponent: () => import('./pricing-page').then((m) => m.PricingPage),
  },
  {
    path: 'templates',
    title: 'ATS-friendly CV templates — ApplyCraft',
    loadComponent: () => import('./templates-page').then((m) => m.TemplatesPage),
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
    title: 'CV examples — ApplyCraft',
    loadComponent: () => import('./examples-page').then((m) => m.ExamplesPage),
  },
  {
    path: 'examples/cover-letters',
    title: 'Cover Letter Examples — ApplyCraft',
    data: { soonTitle: 'Cover Letter Examples', soonDescription: 'Effective cover letter samples' },
    loadComponent: () => import('./coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'tools',
    title: 'All tools — ApplyCraft',
    loadComponent: () => import('./tools-page').then((m) => m.ToolsPage),
  },
  {
    path: 'tools/:slug',
    title: comingSoonTitle,
    loadComponent: () => import('./coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'login',
    title: 'Log in — ApplyCraft',
    canActivate: [guestGuard],
    loadComponent: () => import('./login-page').then((m) => m.LoginPage),
  },
  {
    path: 'signup',
    title: 'Create your account — ApplyCraft',
    canActivate: [guestGuard],
    loadComponent: () => import('./signup-page').then((m) => m.SignupPage),
  },
  {
    path: 'reset-password',
    title: 'Reset your password — ApplyCraft',
    loadComponent: () => import('./reset-password-page').then((m) => m.ResetPasswordPage),
  },
  // Legal pages, in English and German (?lang=de); the texts live in public/legal/*.{en,de}.md.
  {
    path: 'imprint',
    title: 'Imprint (Impressum) — ApplyCraft',
    data: { legalDoc: 'imprint', title: 'Imprint (Impressum)' },
    loadComponent: () => import('./legal-page').then((m) => m.LegalPage),
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
   *   monitor costs. No prompts or answers are stored.
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
    title: 'Privacy Policy (Datenschutzerklärung) — ApplyCraft',
    data: { legalDoc: 'privacy', title: 'Privacy Policy (Datenschutzerklärung)' },
    loadComponent: () => import('./legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'terms',
    title: 'Terms of Service (AGB) — ApplyCraft',
    data: { legalDoc: 'terms', title: 'Terms of Service (AGB)' },
    loadComponent: () => import('./legal-page').then((m) => m.LegalPage),
  },
  // German paths people may type or link to; they open the German version.
  { path: 'impressum', redirectTo: '/imprint?lang=de' },
  { path: 'datenschutz', redirectTo: '/privacy?lang=de' },
  { path: 'agb', redirectTo: '/terms?lang=de' },
  {
    path: 'dashboard',
    title: 'Dashboard — ApplyCraft',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard-page').then((m) => m.DashboardPage),
  },
  {
    // The top bar's "Cover letters" tab; the tool isn't built yet.
    path: 'cover-letters',
    title: 'Cover letters — ApplyCraft',
    canActivate: [authGuard],
    data: { slug: 'cover-letter-generator' },
    loadComponent: () => import('./coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'settings',
    title: 'Settings — ApplyCraft',
    canActivate: [authGuard],
    loadComponent: () => import('./settings-page').then((m) => m.SettingsPage),
  },
  {
    path: 'admin',
    title: 'Admin — ApplyCraft',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin-page').then((m) => m.AdminPage),
  },
  // Unknown paths showed the landing page before the router; keep that.
  { path: '**', redirectTo: '' },
];
