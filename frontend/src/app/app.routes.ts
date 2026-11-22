import { ResolveFn, Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { itemBySlug } from './menu-config';

export const SITE_TITLE = 'ApplyCraft — Your application workspace';

const comingSoonTitle: ResolveFn<string> = (route) =>
  `${itemBySlug(route.paramMap.get('slug') ?? '')?.title ?? 'Coming soon'} — ApplyCraft`;

export const routes: Routes = [
  { path: '', title: SITE_TITLE, loadComponent: () => import('./home-page').then((m) => m.HomePage) },
  {
    path: 'check',
    title: 'CV Checker — ApplyCraft',
    loadComponent: () => import('./cv-check-page').then((m) => m.CvCheckPage),
  },
  {
    path: 'pricing',
    title: 'Pricing — ApplyCraft',
    loadComponent: () => import('./pricing-page').then((m) => m.PricingPage),
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
  // Legal pages are not written yet; they show the Coming Soon page until then.
  {
    path: 'terms',
    title: 'Terms of Service — ApplyCraft',
    data: { pageTitle: 'Terms of Service' },
    loadComponent: () => import('./coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'privacy',
    title: 'Privacy Policy — ApplyCraft',
    data: { pageTitle: 'Privacy Policy' },
    loadComponent: () => import('./coming-soon').then((m) => m.ComingSoon),
  },
  {
    path: 'dashboard',
    title: 'Dashboard — ApplyCraft',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'settings',
    title: 'Settings — ApplyCraft',
    canActivate: [authGuard],
    loadComponent: () => import('./settings-page').then((m) => m.SettingsPage),
  },
  // Unknown paths showed the landing page before the router; keep that.
  { path: '**', redirectTo: '' },
];
