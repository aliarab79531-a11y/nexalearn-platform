import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { AccountUser, AuthService } from './core/auth.service';
import { TranslationService } from './core/translation.service';
import { LearningApiService } from './core/learning-api.service';
import { WorkspacePageComponent } from './features/workspace-page.component';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

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
    const mockLearningApi = {
      teacherOverview: () => of({
        data: { courses: 3, publishedCourses: 2, draftCourses: 1, enrolledLearners: 12, completedEnrollments: 4 },
      }),
      teacherCourses: () => of({
        data: [],
        meta: { page: 1, limit: 20, total: 0, pages: 0 },
      }),
      listEnrollments: () => of({
        data: [],
        meta: { page: 1, limit: 20, total: 0, pages: 0 },
      }),
      listCourses: () => of({
        data: [],
        meta: { page: 1, limit: 12, total: 0, pages: 0 },
      }),
      createCourse: () => of({ data: { id: 'mock-course', title: 'New Course' } }),
      setCourseStatus: () => of({ data: { id: 'mock-course', status: 'published' } }),
      enroll: () => of({ data: { id: 'mock-enrollment', courseId: 'mock-course', progress: 0, status: 'active', enrolledAt: new Date().toISOString() } }),
      updateProgress: () => of({ data: { id: 'mock-enrollment', progress: 50, status: 'active' } }),
      studentProgress: () => of({ data: { coursesEnrolled: 1, coursesCompleted: 0, averageProgress: 50 } }),
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: authSession },
        { provide: LearningApiService, useValue: mockLearningApi },
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
    const layout = fixture.debugElement.query(By.directive(MainLayoutComponent))
      .componentInstance as MainLayoutComponent;
    toggle.click();
    fixture.detectChanges();
    expect(layout.sidebarOpen).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(layout.sidebarOpen).toBeFalse();
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

  it('should support student interactive actions: AI tutor, lesson runner, assignments, and roadmap', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    // 1. AI Tutor interaction
    await router.navigateByUrl('/ai-tutor');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const tutorWorkspace = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;
    expect(tutorWorkspace.chatMessages.length).toBeGreaterThan(0);
    tutorWorkspace.askTutorPrompt('Explain Signals vs RxJS');
    expect(tutorWorkspace.isTutorTyping).toBeTrue();
    expect(tutorWorkspace.chatMessages.some(m => m.text.includes('Signals vs RxJS'))).toBeTrue();
    tutorWorkspace.startNewDialogue();
    expect(tutorWorkspace.newDialogue).toBeTrue();

    // 2. Lesson Player & Sandbox runner
    await router.navigateByUrl('/learning/course-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const lessonWorkspace = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;
    expect(lessonWorkspace.currentLessonData.title).toBeTruthy();
    lessonWorkspace.runLessonCode();
    expect(lessonWorkspace.isCodeRunning).toBeTrue();
    lessonWorkspace.studentLessonNotes = 'Key takeaway: signals recompute synchronously.';
    lessonWorkspace.saveLessonNotes();
    expect(lessonWorkspace.notesSavedNotice).toContain('saved');
    lessonWorkspace.markLessonCompleteAndContinue();
    expect(lessonWorkspace.syllabusLessons[0].completed).toBeTrue();

    // 3. Assignments Submission
    await router.navigateByUrl('/assignments');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const assignmentWorkspace = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;
    const initialUpcoming = assignmentWorkspace.upcomingAssignments.length;
    const assignment = assignmentWorkspace.upcomingAssignments[0];
    assignmentWorkspace.openSubmitModal(assignment);
    expect(assignmentWorkspace.activeSubmissionModal).toBeTruthy();
    assignmentWorkspace.submissionRepoUrl = 'https://github.com/student/assignment-1';
    assignmentWorkspace.submitAssignmentWork();
    expect(assignmentWorkspace.upcomingAssignments.length).toBe(initialUpcoming - 1);
    expect(assignmentWorkspace.selectedAssignmentTab).toBe('Submitted & graded');
    expect(assignmentWorkspace.submittedAssignments[0].title).toBe(assignment.title);

    // 4. Roadmap / Personalized learning path
    await router.navigateByUrl('/learning-paths');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const roadmapWorkspace = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;
    roadmapWorkspace.careerTarget = 'Frontend Engineer';
    roadmapWorkspace.updateLearningPath();
    expect(roadmapWorkspace.pathSteps[0].title).toContain('HTML5');
    const initialProgress = roadmapWorkspace.pathProgress;
    roadmapWorkspace.toggleStepState(2);
    expect(roadmapWorkspace.pathSteps[2].state).toBe('Complete');
  });

  it('should support teacher actions: grading reviews, cohort roster, and curriculum authoring', async () => {
    testAccount.set({
      id: 'test-teacher',
      name: 'Test Teacher',
      email: 'teacher@example.com',
      role: 'teacher',
    });
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    // 1. Instructor Dashboard & Grading Queue
    await router.navigateByUrl('/instructor');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const teacherWorkspace = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;

    // Switch tab to grading
    teacherWorkspace.setTeacherTab('grading');
    expect(teacherWorkspace.teacherTab).toBe('grading');

    // Review a submission
    const sub = teacherWorkspace.submissions[0];
    teacherWorkspace.openReview(sub);
    expect(teacherWorkspace.activeReviewModal).toBe(sub);
    teacherWorkspace.reviewGrade = 98;
    teacherWorkspace.reviewFeedback = 'Superb implementation of signals and architecture.';
    const subCount = teacherWorkspace.submissions.length;
    teacherWorkspace.submitReviewGrade();
    expect(teacherWorkspace.submissions.length).toBe(subCount - 1);
    expect(teacherWorkspace.activeReviewModal).toBeNull();

    // Roster filter
    teacherWorkspace.setTeacherTab('roster');
    teacherWorkspace.teacherRosterFilter = 'All';
    expect(teacherWorkspace.filteredTeacherRoster().length).toBeGreaterThan(0);

    // 2. Course Builder Suite
    await router.navigateByUrl('/instructor/course-builder');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const builderWorkspace = fixture.debugElement.query(By.directive(WorkspacePageComponent))
      .componentInstance as WorkspacePageComponent;
    const initialModules = builderWorkspace.builderModules.length;
    builderWorkspace.addLesson();
    expect(builderWorkspace.builderModules.length).toBe(initialModules + 1);

    builderWorkspace.newTopicTitle = 'Observability & Metrics';
    builderWorkspace.addTopicToModule(0);
    expect(builderWorkspace.builderModules[0].topics).toContain('Observability & Metrics');

    builderWorkspace.deleteTopic(0, builderWorkspace.builderModules[0].topics.length - 1);
    expect(builderWorkspace.builderModules[0].topics).not.toContain('Observability & Metrics');

    builderWorkspace.generateAiOutline();
    builderWorkspace.saveCourseDraft();
    expect(builderWorkspace.actionFeedback).toContain('saved');
  });
});
