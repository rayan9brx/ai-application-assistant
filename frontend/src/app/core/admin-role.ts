import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CvApi } from './cv-api';
import { excludeBrowser } from './page-view-tracker';

/**
 * Whether the signed-in user is an admin, from /api/me. This only decides what the UI shows:
 * the backend checks the role again on every /api/admin request.
 */
@Injectable({ providedIn: 'root' })
export class AdminRole {
  private readonly auth = inject(AuthService);
  private readonly api = inject(CvApi);
  readonly isAdmin = signal(false);
  private loaded: { userId: string; result: Promise<boolean> } | null = null;

  constructor() {
    this.auth.onChange((event) => {
      if (event === 'SIGNED_OUT') this.reset();
      else void this.check();
    });
    void this.auth.whenReady().then(() => this.check());
  }

  /** Loads the role once per signed-in user. */
  check(): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.reset();
      return Promise.resolve(false);
    }
    if (this.loaded?.userId !== userId) {
      const result = this.api.me().then(
        (profile) => profile.role === 'admin',
        () => false,
      );
      this.loaded = { userId, result };
      void result.then((admin) => {
        // An admin's browser stays out of the visitor stats from now on, even after logout.
        if (admin) excludeBrowser();
        if (this.loaded?.userId === userId) this.isAdmin.set(admin);
      });
    }
    return this.loaded.result;
  }

  private reset(): void {
    this.loaded = null;
    this.isAdmin.set(false);
  }
}

/** /admin: guests log in first; signed-in non-admins go to their dashboard. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  // inject() only works before the first await, so take everything up front.
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = inject(AdminRole);
  await auth.whenReady();
  if (!auth.signedIn()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return (await role.check()) ? true : router.parseUrl('/dashboard');
};
