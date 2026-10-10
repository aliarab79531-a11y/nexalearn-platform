import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { AccountUser, AuthService } from './core/auth.service';
import { TranslationService } from './core/translation.service';
import { WorkspacePageComponent } from './features/workspace-page.component';
import { NavbarComponent } from './layout/navbar.component';

describe('App', () => {
  let testAccount: WritableSignal<AccountUser | null>;

  beforeEach(async () => {
    testAccount = signal<AccountUser | null>({
      id: 'test-student',
      name: 'Test Student',
      email: 'student@example.com',
      role: 'student',
    });
    const authSession = {
      currentAccount: testAccount,
      sessionError: signal<string | null>(null),
      ensureSession: jasmine.createSpy('ensureSession').and.resolveTo(undefined),
      logout: () => of(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: authSession },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the public navigation on the home route', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('NexaLearn');
  });

  it('should expose an accessible responsive menu that closes with Escape', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const navbar = fixture.debugElement.query(By.directive(NavbarComponent))
      .componentInstance as NavbarComponent;
    const menuButton = fixture.nativeElement.querySelector('.mobile-menu') as HTMLButtonElement;
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
    expect(menuButton.getAttribute('aria-controls')).toBe('public-navigation');

    menuButton.click();
    fixture.detectChanges();
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#public-navigation').classList).toContain('menu-open');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(navbar.mobileMenuOpen).toBeFalse();
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('should treat workspace pages like the learning roadmap as protected', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/learning-paths');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.isPublic()).toBeFalse();
  });

  it('should redirect students away from the admin console', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/admin');
    await fixture.whenStable();

    expect(router.url).toBe('/dashboard');
  });

  it('should route teachers to their workspace and prevent access to admin pages', async () => {
    testAccount.set({
      id: 'test-teacher',
      name: 'Test Teacher',
      email: 'teacher@example.com',
      role: 'teacher',
    });
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/instructor/course-builder');
    expect(router.url).toBe('/instructor/course-builder');

    await router.navigateByUrl('/admin');
    expect(router.url).toBe('/instructor');
    await fixture.whenStable();
  });

  it('should render the shared footer on public and workspace routes', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.site-footer')).toBeTruthy();

    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.site-footer')).toBeTruthy();
  });

  it('should run the three-question practice quiz without repeating questions', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/ai/quiz-generator');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const quiz = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;
    expect(quiz.quizQuestion).toBe(1);
    quiz.submitQuiz();
    expect(quiz.quizNotice).toBe('Choose an answer to continue.');

    quiz.selectedAnswer = 'b';
    quiz.submitQuiz();
    expect(quiz.quizQuestion).toBe(2);
    quiz.previousQuizQuestion();
    expect(quiz.selectedAnswer).toBe('b');
    quiz.submitQuiz();

    quiz.selectedAnswer = 'a';
    quiz.submitQuiz();
    expect(quiz.quizQuestion).toBe(3);
    quiz.selectedAnswer = 'a';
    quiz.submitQuiz();

    expect(quiz.quizComplete).toBeTrue();
    expect(quiz.correctQuizAnswers).toBe(3);
    quiz.restartQuiz();
    expect(quiz.quizQuestion).toBe(1);
    expect(quiz.quizComplete).toBeFalse();
    expect(quiz.correctQuizAnswers).toBe(0);
  });

  it('should filter courses and manage the saved list', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/my-courses');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;
    expect(workspace.courseCount('all')).toBe(4);
    expect(workspace.courseCount('in-progress')).toBe(2);
    expect(workspace.courseCount('completed')).toBe(0);

    workspace.toggleSavedCourse('javascript-mastery');
    expect(workspace.courseCount('saved')).toBe(1);
    workspace.courseFilter = 'saved';
    expect(workspace.filteredCourses().map(course => course.id)).toEqual(['javascript-mastery']);

    workspace.toggleSavedCourse('javascript-mastery');
    expect(workspace.filteredCourses()).toEqual([]);
  });

  it('should close the mobile workspace navigation with Escape', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('.mobile-nav-toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarOpen).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarOpen).toBeFalse();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('should apply and persist Arabic right-to-left language settings', () => {
    const translation = TestBed.inject(TranslationService);

    translation.setLanguage('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('nexalearn-language')).toBe('ar');
    expect(translation.translate('Sign in')).toBe('تسجيل الدخول');

    translation.setLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
