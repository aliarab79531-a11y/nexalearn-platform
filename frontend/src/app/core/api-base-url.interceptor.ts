import { HttpInterceptorFn } from '@angular/common/http';

declare global {
  interface Window {
    __NEXALEARN_CONFIG__?: { apiBaseUrl?: string };
  }
}

export const apiBaseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const apiBaseUrl = typeof window === 'undefined'
    ? ''
    : window.__NEXALEARN_CONFIG__?.apiBaseUrl?.replace(/\/$/, '') ?? '';

  return next(apiBaseUrl ? request.clone({ url: `${apiBaseUrl}${request.url}` }) : request);
};
