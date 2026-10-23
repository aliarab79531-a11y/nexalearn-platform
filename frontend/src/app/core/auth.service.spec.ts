import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService, AccountUser } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('registers a teacher account through the API and stores its session user', async () => {
    const teacher: AccountUser = {
      id: 'teacher-1',
      name: 'Taylor Teacher',
      email: 'taylor@example.com',
      role: 'teacher',
    };
    const response = firstValueFrom(auth.register({
      name: teacher.name,
      email: teacher.email,
      password: 'long-enough-password',
      role: 'teacher',
    }));

    const request = http.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body.role).toBe('teacher');
    request.flush({ status: 'success', data: { user: teacher } });

    await response;
    expect(auth.currentAccount()).toEqual(teacher);
  });

  it('sends the remember choice with a sign-in request', async () => {
    const student: AccountUser = {
      id: 'student-1',
      name: 'Sam Student',
      email: 'sam@example.com',
      role: 'student',
    };
    const response = firstValueFrom(auth.login(student.email, 'long-enough-password', true));

    const request = http.expectOne('/api/auth/login');
    expect(request.request.body.remember).toBeTrue();
    request.flush({ status: 'success', data: { user: student } });

    await response;
    expect(auth.currentAccount()).toEqual(student);
  });

  it('clears the stored user only after successful sign out', async () => {
    auth.currentAccount.set({
      id: 'student-1',
      name: 'Sam Student',
      email: 'sam@example.com',
      role: 'student',
    });
    const response = firstValueFrom(auth.logout());

    const request = http.expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST');
    request.flush(null);

    await response;
    expect(auth.currentAccount()).toBeNull();
  });
});
