import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, SelfRegistrationRole } from '../core/auth.service';
import { CourseService } from '../core/course.service';
import { SeoService } from '../core/seo.service';
import { Course } from '../core/models';
import { CourseCardComponent } from '../shared/course-card.component';
import { TranslationService } from '../core/translation.service';
import { LearningApiService, ApiCourse } from '../core/learning-api.service';

interface PageHighlight {
  title: string;
  detail: string;
}

interface PageDetails {
  eyebrow: string;
  heading: string;
  summary: string;
  highlights: PageHighlight[];
}

@Component({
  selector: 'app-platform-page', standalone: true, imports: [RouterLink, FormsModule, CourseCardComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './platform-page.component.html',
})
export class PlatformPageComponent implements OnInit {
  readonly service = inject(CourseService);
  readonly translation = inject(TranslationService);
  readonly auth = inject(AuthService);
  private readonly learningApi = inject(LearningApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly seo = inject(SeoService);
  view = 'home'; title = ''; description = ''; query = '';
  course?: Course;
  selectedCategory = 'All courses';
  authEmail = '';
  authPassword = '';
  authName = '';
  authRole: SelfRegistrationRole = 'student';
  rememberMe = false;
  authMessage = '';
  authPending = false;
  apiCourses: Course[] = [];
  coursesLoading = false;
  coursesError = '';
  courseLoading = false;
  enrollmentPending = false;
  enrollmentMessage = '';

  get categories(): string[] {
    return ['All courses', ...new Set(this.apiCourses.map(course => course.category))];
  }
  readonly features = [{ icon: 'route', title: 'Adaptive Learning Paths', text: 'Personalized roadmaps that evolve with your goals and progress.' }, { icon: 'auto_awesome', title: 'AI-Powered Tutoring', text: 'Get unstuck faster with an intelligent learning companion.' }, { icon: 'terminal', title: 'Build Real Projects', text: 'Apply what you learn in production-style environments.' }];
  private readonly pageDetailsByView: Record<string, PageDetails> = {
    home: {
      eyebrow: 'HOW NEXALEARN WORKS',
      heading: 'A practical system for making steady progress',
      summary: 'NexaLearn brings course material, practice, and feedback into one guided experience. Start with a goal, follow a focused sequence, and use projects to turn new concepts into durable skills.',
      highlights: [
        { title: 'Choose a clear goal', detail: 'Browse role-focused subjects and pick a learning direction that fits your experience and ambitions.' },
        { title: 'Learn by doing', detail: 'Short lessons pair explanations with practical exercises, project milestones, and examples you can revisit.' },
        { title: 'Adjust as you grow', detail: 'Use progress signals and optional AI guidance to decide what to review and what to tackle next.' },
      ],
    },
    catalog: {
      eyebrow: 'COURSE CATALOG GUIDE',
      heading: 'Find the right course for your next milestone',
      summary: 'Compare courses by subject, level, time commitment, and practical outcomes. Search the catalog for a tool or skill, then open a course to review its modules before choosing where to begin.',
      highlights: [
        { title: 'Match your starting point', detail: 'Beginner, intermediate, and advanced labels help you select material that is appropriately challenging.' },
        { title: 'Check the time commitment', detail: 'Lesson counts and estimated durations make it easier to plan learning around work or study.' },
        { title: 'Preview the outcome', detail: 'Review projects, tools, instructor information, and learning outcomes before committing to a course.' },
      ],
    },
    dashboard: {
      eyebrow: 'LEARNER DASHBOARD',
      heading: 'Turn your learning activity into a useful plan',
      summary: 'The dashboard brings current courses, recent activity, and key progress signals together so you can pick up quickly and spend your next session on a concrete task.',
      highlights: [
        { title: 'Resume without searching', detail: 'Your in-progress course and next lesson are surfaced alongside direct links to your course library.' },
        { title: 'Keep momentum visible', detail: 'Streaks, study time, completion, and assessment results help you notice consistent progress.' },
        { title: 'Plan the next session', detail: 'Upcoming work and recent activity make deadlines and useful review tasks easier to spot.' },
      ],
    },
    login: {
      eyebrow: 'YOUR LEARNING ACCOUNT',
      heading: 'Keep your courses and progress together',
      summary: 'An account is the starting point for a continuous learning workspace. Sign in to return to saved progress, or create an account to begin organizing courses and milestones in one place.',
      highlights: [
        { title: 'Return to your course', detail: 'Continue from your current lesson instead of rebuilding your place each time you visit.' },
        { title: 'Keep goals in view', detail: 'Use a personal dashboard to follow course activity, upcoming assignments, and learning streaks.' },
        { title: 'Get guided practice', detail: 'Connect course work with quizzes, progress reports, and tutor tools when available.' },
      ],
    },
    about: {
      eyebrow: 'ABOUT NEXALEARN AI',
      heading: 'Technology learning built around real progress',
      summary: 'NexaLearn is designed to make ambitious technical goals feel approachable. We combine structured curricula with hands-on work and clear feedback, so learners can move from understanding a concept to using it confidently.',
      highlights: [
        { title: 'Start with the learner', detail: 'Clear explanations and flexible pacing help learners with different backgrounds find a productive starting point.' },
        { title: 'Practice with purpose', detail: 'Projects and exercises connect foundational ideas to the kinds of work developers and analysts actually do.' },
        { title: 'Use AI as a guide', detail: 'AI support is intended to clarify concepts and suggest next steps while keeping learner judgment at the center.' },
      ],
    },
  };

  get pageDetails(): PageDetails | undefined {
    if (this.view === 'login' || this.view === 'logout') {
      return undefined;
    }
    if (this.view === 'course' && this.course) {
      return {
        eyebrow: 'COURSE LEARNING PLAN',
        heading: `What to expect from ${this.course.title}`,
        summary: `${this.course.description} The course is organized into ${this.course.modules.length} modules and includes guided practice designed to help you apply the material as you go.`,
        highlights: [
          { title: 'Build practical skills', detail: this.course.outcomes[0] ?? 'Develop a foundation you can apply in your own projects.' },
          { title: 'Create portfolio-ready work', detail: this.course.projects.join(' · ') },
          { title: 'Learn with a focused toolkit', detail: `Work with ${this.course.tools.join(', ')} through lessons led by ${this.course.instructor}.` },
        ],
      };
    }
    return this.pageDetailsByView[this.view];
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.view = data['view'] ?? 'home';
      this.title = data['title'] ?? 'NexaLearn AI';
      this.description = data['description'] ?? 'A modern learning platform powered by AI.';
      this.seo.update(this.title, this.description);
      if (this.view === 'catalog') this.loadCourses();
      if (this.view === 'logout' && isPlatformBrowser(this.platformId)) {
        void this.completeSignOut();
      }
    });
    this.route.paramMap.subscribe(params => {
      const courseId = params.get('id') ?? '';
      this.course = this.service.getCourse(courseId);
      if (this.view === 'course') {
        this.courseLoading = true;
        this.learningApi.getCourse(courseId).subscribe({
          next: ({ data }) => {
            this.course = this.mapCourse(data);
            this.courseLoading = false;
            this.title = this.course.title;
            this.description = this.course.description;
            this.seo.update(this.title, this.description);
          },
          error: () => {
            this.course = undefined;
            this.courseLoading = false;
            this.title = 'Course not found';
            this.description = 'The course you requested is not available.';
            this.seo.update(this.title, this.description);
          },
        });
      }
    });
  }

  filteredCourses(): Course[] {
    const term = this.query.trim().toLowerCase();
    return this.apiCourses.filter(course =>
      (this.selectedCategory === 'All courses' || course.category === this.selectedCategory) &&
      `${course.title} ${course.category} ${course.description} ${course.tools.join(' ')}`.toLowerCase().includes(term)
    );
  }

  loadCourses(): void {
    this.coursesLoading = true;
    this.coursesError = '';
    this.learningApi.listCourses({ limit: 100 }).subscribe({
      next: ({ data }) => {
        this.apiCourses = data.map(course => this.mapCourse(course));
        this.coursesLoading = false;
      },
      error: () => {
        this.apiCourses = [];
        this.coursesLoading = false;
        this.coursesError = 'The course catalog is temporarily unavailable. Please try again.';
      },
    });
  }

  async enrollInCourse(courseId: string): Promise<void> {
    const account = this.auth.currentAccount();
    if (!account) {
      await this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (account.role !== 'student') {
      this.enrollmentMessage = 'Course enrollment is available to student accounts.';
      return;
    }
    if (this.enrollmentPending) return;
    this.enrollmentPending = true;
    this.enrollmentMessage = '';
    try {
      await firstValueFrom(this.learningApi.enroll(courseId));
      await this.router.navigateByUrl('/my-courses');
    } catch (error) {
      this.enrollmentMessage = this.authErrorMessage(error);
    } finally {
      this.enrollmentPending = false;
    }
  }

  private mapCourse(course: ApiCourse): Course {
    return {
      id: course.id, title: course.title, category: course.category, level: course.level,
      lessons: course.lessons, duration: course.duration, students: '', color: '#e8eaff',
      icon: 'school', description: course.description, instructor: course.instructor,
      instructorTitle: 'Course instructor', rating: '—', reviews: '0', price: 'Free',
      callToAction: 'Start learning', outcomes: [], projects: [], tools: [], modules: course.modules,
    };
  }

  async submitAuth(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.authPending) {
      return;
    }
    this.authPending = true;
    this.authMessage = '';
    try {
      const response = this.title === 'Sign in'
        ? await firstValueFrom(this.auth.login(this.authEmail, this.authPassword, this.rememberMe))
        : await firstValueFrom(this.auth.register({
          name: this.authName,
          email: this.authEmail,
          password: this.authPassword,
          role: this.authRole,
        }));
      const defaultDestination = {
        student: '/dashboard',
        teacher: '/instructor',
        admin: '/admin',
      }[response.user.role];
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const destination = returnUrl && this.canReturnTo(returnUrl, response.user.role)
        ? returnUrl
        : defaultDestination;
      await this.router.navigateByUrl(destination);
    } catch (error) {
      this.authMessage = this.authErrorMessage(error);
    } finally {
      this.authPending = false;
    }
  }

  showAuthMessage(message: string): void {
    this.authMessage = message;
  }

  private authErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Cannot reach the account service. Start the backend and check its environment configuration.';
    }
    if (error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null) {
      const payload = error.error as { error?: string | { message?: string } };
      if (typeof payload.error === 'string') {
        return payload.error;
      }
      if (payload.error && typeof payload.error.message === 'string') {
        return payload.error.message;
      }
    }
    return 'The account request could not be completed. Please try again.';
  }

  private canReturnTo(path: string, role: SelfRegistrationRole | 'admin'): boolean {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
      return false;
    }
    const matchesPrefix = (prefix: string) => prefix.endsWith('/')
      ? path.startsWith(prefix)
      : path === prefix || path.startsWith(`${prefix}/`);
    if (role === 'admin') {
      return ['/admin', '/student', '/dashboard', '/my-courses', '/learning-paths', '/learning/', '/ai-tutor', '/ai/', '/assignments', '/progress', '/instructor']
        .some(matchesPrefix);
    }
    const prefixes = role === 'teacher'
      ? ['/instructor']
      : ['/student', '/dashboard', '/my-courses', '/learning-paths', '/learning/', '/ai-tutor', '/ai/', '/assignments', '/progress'];
    return prefixes.some(matchesPrefix);
  }

  private async completeSignOut(): Promise<void> {
    try {
      await firstValueFrom(this.auth.logout());
      await this.router.navigateByUrl('/');
    } catch {
      this.authMessage = 'Sign out could not be completed. Please try again.';
    }
  }
}
