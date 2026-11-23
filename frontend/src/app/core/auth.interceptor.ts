import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Sends our own API calls (/api/...) to the backend at environment.apiBaseUrl, with the Supabase
 * access token. Requests to other hosts are left alone and never get the token.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const auth = inject(AuthService);
  const url = environment.apiBaseUrl + request.url;
  return from(auth.accessToken()).pipe(
    switchMap((token) =>
      next(request.clone({ url, ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}) })),
    ),
  );
};
