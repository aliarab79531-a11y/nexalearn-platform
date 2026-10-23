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
import { CourseCardComponent } from '../shared/components/course-card/course-card.component';
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
  catalogPage = 1;
  catalogPages = 0;
  catalogTotal = 0;
  readonly catalogPageSize = 12;
  coursesLoading = false;
  coursesError = '';
  courseLoading = false;
  enrollmentPending = false;
  enrollmentMessage = '';

  // Home Page Interactive AI Playground State
  homeInteractiveTutorTopic: 'signals' | 'closure' | 'challenge' | 'bigo' = 'signals';

  readonly homeTutorSnippets = {
    signals: {
      title: 'Angular Signals & Reactivity',
      text: 'Signals provide synchronous, fine-grained reactivity. Angular recomputes derived state only when tracked reads change, removing zone.js overhead.',
      code: `const count = signal(0);\nconst doubled = computed(() => count() * 2);\ncount.set(5); // doubled() immediately updates to 10`,
      tip: 'Best practice: Keep signals synchronous and pure. Use effects only for side effects like logging or external syncing.'
    },
    closure: {
      title: 'JavaScript Closures & Lexical Scope',
      text: 'A closure is created when an inner function retains access to its enclosing lexical scope even after the parent function has finished executing.',
      code: `function makeCounter(init = 0) {\n  let val = init;\n  return () => ++val;\n}\nconst count = makeCounter(); count(); // 1`,
      tip: 'Watch out: Closures holding DOM nodes can cause memory leaks if listeners are not cleaned up on unmount.'
    },
    challenge: {
      title: '5-Minute Async Backoff Challenge',
      text: 'Design an exponential backoff retry helper that retries an async task N times before throwing.',
      code: `async function retry<T>(fn: () => Promise<T>, tries = 3, ms = 500): Promise<T> {\n  try { return await fn(); }\n  catch (e) { if (tries <= 1) throw e; await new Promise(r => setTimeout(r, ms)); return retry(fn, tries - 1, ms * 2); }\n}`,
      tip: 'Tip: Add random jitter to exponential backoff to prevent thundering herd problems in microservices.'
    },
    bigo: {
      title: 'Algorithmic Complexity & Optimization',
      text: 'Replacing an O(N²) nested array search with a Set lookup drops time complexity to linear O(N).',
      code: `// Anti-pattern O(N^2): a.filter(x => b.includes(x))\n// Optimized O(N): const set = new Set(b); a.filter(x => set.has(x))`,
      tip: 'Rule of thumb: Sets and Maps provide O(1) average lookup times, saving seconds on large data arrays.'
    }
  };

  readonly featuredCurricula = [
    {
      id: 'angular-signals',
      title: 'Angular 20 & Reactive Architecture',
      category: 'Development',
      level: 'Advanced',
      duration: '18 hours',
      lessons: 24,
      rating: '4.9',
      reviews: '340',
      icon: 'bolt',
      color: '#e8eaff',
      badge: 'TOP RATED',
      description: 'Master fine-grained signals, computed state, zoneless change detection, and SSR microfrontends.',
    },
    {
      id: 'javascript-mastery',
      title: 'Full-Stack Node.js & Microservices',
      category: 'Backend',
      level: 'Intermediate',
      duration: '14 hours',
      lessons: 15,
      rating: '4.8',
      reviews: '280',
      icon: 'dns',
      color: '#e0f2fe',
      badge: 'POPULAR',
      description: 'Design distributed architectures with Docker, Redis caching, event loops, and rate limiting.',
    },
    {
      id: 'enterprise-ai',
      title: 'Enterprise AI Engineering with Gemini',
      category: 'AI & Data',
      level: 'Advanced',
      duration: '20 hours',
      lessons: 18,
      rating: '5.0',
      reviews: '190',
      icon: 'psychology',
      color: '#f3e8ff',
      badge: 'NEW',
      description: 'Integrate Google Gemini 2.5 Flash, multi-modal LLM reasoning, function calling, and vector embeddings.',
    },
  ];

  selectHomeTutorTopic(topic: 'signals' | 'closure' | 'challenge' | 'bigo'): void {
    this.homeInteractiveTutorTopic = topic;
  }

  async quickLogin(role: 'student' | 'teacher'): Promise<void> {
    const creds = role === 'teacher'
      ? { email: 'demo.teacher@nexalearn.test', password: 'Demo-JgotYvqm_vNm7OE4f-4cqPrD!' }
      : { email: 'demo.student@nexalearn.test', password: 'Demo-WIGSMNJb4p6GbF__Joa5E2Q5!' };
    try {
      this.authPending = true;
      const res = await firstValueFrom(this.auth.login(creds.email, creds.password, true));
      const dest = res.data.user.role === 'teacher' ? '/instructor' : '/dashboard';
      await this.router.navigateByUrl(dest);
    } catch {
      await this.router.navigateByUrl('/auth/login');
    } finally {
      this.authPending = false;
    }
  }

  get categories(): string[] {
    return ['All courses', ...new Set(this.apiCourses.map(course => course.category))];
  }
  readonly features = [
    { icon: 'route', title: 'Adaptive Learning Paths', text: 'Personalized roadmaps that evolve with your goals, knowledge gaps, and daily momentum.' },
    { icon: 'auto_awesome', title: '24/7 AI-Powered Tutoring', text: 'Instant AST-level code diagnostics, algorithmic hints, and step-by-step conceptual breakdowns.' },
    { icon: 'terminal', title: 'Interactive Sandbox & Code', text: 'Write, debug, and run code directly in your browser with real-time feedback and tests.' },
    { icon: 'cast_for_education', title: 'Instructor Authoring Suite', text: 'Visual curriculum builder to craft modular lessons, assign hands-on challenges, and publish.' },
    { icon: 'fact_check', title: 'AI Rubric Submissions & Grading', text: 'Automated grading assistance with confidence scores and customizable mentor feedback.' },
    { icon: 'analytics', title: 'Cohort Telemetry & Insights', text: 'Live student velocity tracking, completion forecasts, and cohort retention metrics.' },
  ];
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
    this.learningApi.listCourses({
      page: this.catalogPage,
      limit: this.catalogPageSize,
      query: this.query.trim() || undefined,
      category: this.selectedCategory === 'All courses' ? undefined : this.selectedCategory,
    }).subscribe({
      next: ({ data, meta }) => {
        this.apiCourses = data.map(course => this.mapCourse(course));
        this.catalogPage = meta.page;
        this.catalogPages = meta.pages;
        this.catalogTotal = meta.total;
        this.coursesLoading = false;
      },
      error: () => {
        this.apiCourses = [];
        this.catalogPages = 0;
        this.catalogTotal = 0;
        this.coursesLoading = false;
        this.coursesError = 'The course catalog is temporarily unavailable. Please try again.';
      },
    });
  }

  searchCourses(): void {
    this.catalogPage = 1;
    this.loadCourses();
  }

  filterCoursesByCategory(category: string): void {
    this.selectedCategory = category;
    this.catalogPage = 1;
    this.loadCourses();
  }

  changeCatalogPage(page: number): void {
    if (page < 1 || page > this.catalogPages || page === this.catalogPage) return;
    this.catalogPage = page;
    this.loadCourses();
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
      }[response.data.user.role];
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const destination = returnUrl && this.canReturnTo(returnUrl, response.data.user.role)
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
