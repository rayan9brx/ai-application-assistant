import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Pages that need an account: guests go to /login and come back afterwards. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.signedIn() ? true : router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/** Log-in and sign-up pages: someone already signed in goes straight on. */
export const guestGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.signedIn() ? router.parseUrl(safeNext(route.queryParamMap.get('next'))) : true;
};

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  // "//host" and "/\host" would leave the site.
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : fallback;
}
