import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { from, map } from 'rxjs';
import { AccountRole, AuthService } from './auth.service';

const roleHome: Record<AccountRole, string> = {
  student: '/dashboard',
  teacher: '/instructor',
  admin: '/admin',
};

export const accountGuard: CanActivateFn = (route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  const expectedRole = route.data['role'] as AccountRole | undefined;
  return from(auth.ensureSession()).pipe(
    map(() => {
      const account = auth.currentAccount();
      if (!account) {
        return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
      }
      return expectedRole && account.role !== expectedRole
        ? router.createUrlTree([roleHome[account.role]])
        : true;
    }),
  );
};
