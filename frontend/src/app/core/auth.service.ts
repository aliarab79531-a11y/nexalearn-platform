import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, tap } from 'rxjs';

export type AccountRole = 'student' | 'teacher' | 'admin';
export type SelfRegistrationRole = Exclude<AccountRole, 'admin'>;

export interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
}

interface AccountResponse {
  status: 'success';
  data: { user: AccountUser };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private sessionPromise?: Promise<void>;
  readonly currentAccount = signal<AccountUser | null>(null);
  readonly sessionReady = signal(false);
  readonly sessionError = signal<string | null>(null);

  register(input: {
    name: string;
    email: string;
    password: string;
    role: SelfRegistrationRole;
  }): Observable<AccountResponse> {
    return this.http.post<AccountResponse>('/api/auth/register', input, { withCredentials: true })
      .pipe(tap(({ data: { user } }) => this.setCurrentAccount(user)));
  }

  login(email: string, password: string, remember = false): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(
      '/api/auth/login',
      { email, password, remember },
      { withCredentials: true },
    )
      .pipe(tap(({ data: { user } }) => this.setCurrentAccount(user)));
  }

  currentUser(): Observable<AccountResponse> {
    return this.http.get<AccountResponse>('/api/auth/me', { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}, { withCredentials: true })
      .pipe(tap(() => this.setCurrentAccount(null)));
  }

  ensureSession(): Promise<void> {
    this.sessionPromise ??= firstValueFrom(this.currentUser())
      .then(({ data: { user } }) => this.setCurrentAccount(user))
      .catch((error: unknown) => {
        this.currentAccount.set(null);
        if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
          this.sessionError.set(this.readErrorMessage(error));
        }
        this.sessionReady.set(true);
      });
    return this.sessionPromise;
  }

  private setCurrentAccount(user: AccountUser | null): void {
    this.currentAccount.set(user);
    this.sessionError.set(null);
    this.sessionReady.set(true);
    this.sessionPromise = Promise.resolve();
  }

  private readErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Cannot reach the account service. Start the backend and check its environment configuration.';
    }
    if (error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null) {
      const payload = error.error as { data?: { message?: string }; error?: string | { message?: string } };
      if (payload.data && typeof payload.data.message === 'string') {
        return payload.data.message;
      }
      if (typeof payload.error === 'string') {
        return payload.error;
      }
      if (payload.error && typeof payload.error.message === 'string') {
        return payload.error.message;
      }
    }
    return 'Could not restore your account session. Please try again.';
  }
}
