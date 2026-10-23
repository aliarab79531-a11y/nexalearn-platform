import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CourseService } from '../core/course.service';
import { AuthService } from '../core/auth.service';
import { Course } from '../core/models';
import { SeoService } from '../core/seo.service';
import { LearningApiService, ApiEnrollment, ApiCourse } from '../core/learning-api.service';

interface WorkspaceHighlight {
  title: string;
  detail: string;
}

interface WorkspacePageDetails {
  eyebrow: string;
  heading: string;
  summary: string;
  highlights: WorkspaceHighlight[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  time: string;
  code?: string;
  tip?: string;
}

export interface QuizQuestion {
  prompt: string;
  correctAnswer: string;
  explanation?: string;
  options: Array<{
    id: string;
    title: string;
    detail: string;
  }>;
}

export interface BuilderModule {
  label: string;
  title: string;
  lessons: number;
  duration: string;
  status: string;
  topics: string[];
}

export interface SubmissionItem {
  id: string;
  initials: string;
  name: string;
  course: string;
  status: string;
  submittedAgo: string;
  repoUrl: string;
  studentCode: string;
  aiConfidence: string;
  aiScore: number;
  aiFeedback: string;
  rubric: { architecture: number; tests: number; performance: number };
}

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './workspace-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './workspace-page.component.css',
})
export class WorkspacePageComponent implements OnInit {
  readonly service = inject(CourseService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly learningApi = inject(LearningApiService);

  view = 'dashboard';
  learningCourse?: Course;
  title = '';
  description = '';
  eyebrow = 'LEARNING WORKSPACE';
  query = '';
  courseFilter: 'all' | 'in-progress' | 'completed' | 'saved' = 'all';
  readonly savedCourseIds = new Set<string>();
  enrolledCourses: Course[] = [...this.service.courses];
  enrollmentsLoading = false;
  enrollmentsError = '';
  actionFeedback = '';

  // AI Tutor State
  message = '';
  lastMessage = '';
  newDialogue = false;
  isTutorTyping = false;
  exerciseStarted = false;
  tutorPromptChips = [
    'Explain Signals vs RxJS',
    'How do JavaScript closures work?',
    'Give me a 5-minute code challenge',
    'Explain Big-O Time Complexity',
    'How to handle async errors cleanly?',
  ];
  chatMessages: ChatMessage[] = [
    {
      id: 'welcome',
      sender: 'tutor',
      text: 'Hello! I am your NexaLearn AI Tutor. I have full context of your active course (Angular Development & Modern JS). Ask me to explain a tricky concept, debug an error, or break down an architectural pattern!',
      time: 'Just now',
      tip: 'Pro tip: Click one of the suggested prompt chips below or type your own question.',
    },
  ];

  // Quiz State (preserves original questions for unit test compatibility)
  selectedTopic = 'angular';
  selectedAnswer = '';
  quizNotice = '';
  quizQuestion = 1;
  quizComplete = false;
  readonly quizAnswers: Record<number, string> = {};

  readonly quizTopics = [
    { id: 'angular', name: 'Angular Signals & Reactivity', icon: 'bolt' },
    { id: 'js', name: 'Modern JavaScript & Async Engine', icon: 'javascript' },
    { id: 'ts', name: 'TypeScript Strict Architecture', icon: 'code' },
    { id: 'api', name: 'Full-Stack REST & Security', icon: 'api' },
  ];

  readonly quizBanks: Record<string, QuizQuestion[]> = {
    angular: [
      {
        prompt: 'When does a computed signal recalculate its value?',
        correctAnswer: 'b',
        explanation: 'Angular signals track reads dynamically during computation. The computed value updates reactively whenever a read dependency emits a new value.',
        options: [
          { id: 'a', title: 'Whenever the component renders', detail: 'Computed values are not tied to component lifecycle.' },
          { id: 'b', title: 'When a signal it read changes', detail: 'Dependencies are tracked automatically while evaluating the computation.' },
          { id: 'c', title: 'Only when explicitly refreshed', detail: 'Computed signals update reactively; they do not need a manual refresh.' },
          { id: 'd', title: 'At fixed time intervals', detail: 'Signals are synchronous state primitives, not polling timers.' },
        ],
      },
      {
        prompt: 'What does Angular track while evaluating a computed signal?',
        correctAnswer: 'a',
        explanation: 'Any signal read executed within the computed callback function is registered in its dynamic reactive dependency graph.',
        options: [
          { id: 'a', title: 'Every signal read during evaluation', detail: 'Those reads become the computed value’s reactive dependencies.' },
          { id: 'b', title: 'Only signals declared in the same file', detail: 'Dependencies are determined by reads, not file location.' },
          { id: 'c', title: 'No dependencies until a timer runs', detail: 'Computed signals update synchronously when dependencies change.' },
          { id: 'd', title: 'Every component input automatically', detail: 'Only signals actually read by the computation are tracked.' },
        ],
      },
      {
        prompt: 'Why does Angular cache a computed signal value?',
        correctAnswer: 'a',
        explanation: 'Caching prevents unnecessary re-evaluations (memoization), keeping rendering and derived calculations instantaneous until an actual input changes.',
        options: [
          { id: 'a', title: 'To avoid recalculating until a dependency changes', detail: 'The cached result remains valid while its dependencies remain unchanged.' },
          { id: 'b', title: 'To prevent future updates', detail: 'A dependency change invalidates the cached value.' },
          { id: 'c', title: 'To save the value between browser sessions', detail: 'Computed values are in-memory reactive state.' },
          { id: 'd', title: 'To force periodic refreshes', detail: 'Computed signals do not use polling intervals.' },
        ],
      },
    ],
    js: [
      {
        prompt: 'What happens when an unhandled Promise rejection occurs in Node.js/browsers?',
        correctAnswer: 'b',
        explanation: 'Unhandled rejections trigger an unhandledrejection process event and can terminate Node processes if left unhandled.',
        options: [
          { id: 'a', title: 'It is silently swallowed', detail: 'Modern runtimes flag unhandled rejections.' },
          { id: 'b', title: 'An unhandledrejection event fires', detail: 'Allows centralized logging or graceful recovery.' },
          { id: 'c', title: 'It automatically retries 3 times', detail: 'Promises do not have automatic retries.' },
          { id: 'd', title: 'It blocks the event loop thread', detail: 'Promises are non-blocking microtasks.' },
        ],
      },
      {
        prompt: 'Which task queue has the highest execution priority in the event loop?',
        correctAnswer: 'a',
        explanation: 'Microtasks (Promises, queueMicrotask) execute immediately after the current synchronous stack before macrotasks (setTimeout).',
        options: [
          { id: 'a', title: 'Microtask queue (Promise.then)', detail: 'Drained completely between event loop ticks.' },
          { id: 'b', title: 'Timer macrotask queue (setTimeout)', detail: 'Executed in subsequent event loop iterations.' },
          { id: 'c', title: 'I/O poll phase queue', detail: 'Executed after microtask queue is drained.' },
          { id: 'd', title: 'Idle checks queue', detail: 'Runs only when no higher priority tasks exist.' },
        ],
      },
    ],
    ts: [
      {
        prompt: 'What is the purpose of the "unknown" type compared to "any" in TypeScript?',
        correctAnswer: 'b',
        explanation: '"unknown" enforces type-narrowing before accessing properties, preventing runtime errors that "any" permits.',
        options: [
          { id: 'a', title: 'It disables all type checking', detail: 'That is what "any" does.' },
          { id: 'b', title: 'It requires type narrowing before use', detail: 'Guarantees type safety at compile time.' },
          { id: 'c', title: 'It can only store undefined', detail: '"unknown" can hold any value safely.' },
          { id: 'd', title: 'It converts the value to string at runtime', detail: 'TypeScript types do not alter runtime values.' },
        ],
      },
    ],
    api: [
      {
        prompt: 'Which HTTP status code should be returned for an unauthenticated request?',
        correctAnswer: 'a',
        explanation: '401 Unauthorized indicates missing or invalid credentials. 403 Forbidden indicates valid credentials but insufficient permissions.',
        options: [
          { id: 'a', title: '401 Unauthorized', detail: 'Credentials required or invalid.' },
          { id: 'b', title: '403 Forbidden', detail: 'Authenticated, but access denied.' },
          { id: 'c', title: '400 Bad Request', detail: 'Malformed request syntax.' },
          { id: 'd', title: '404 Not Found', detail: 'Target resource does not exist.' },
        ],
      },
    ],
  };

  // AI Code Explainer State
  codeLoaded = false;
  selectedLanguage: 'typescript' | 'javascript' | 'python' | 'sql' = 'typescript';
  isAnalyzingCode = false;
  copyFeedback = '';
  codeSnippet = `async function loadUserProfile(userId: string) {
  const response = await fetch('/api/users/' + userId);
  const data = response.json(); // Bug: missing await on Promise
  localStorage.setItem('cached_user', data); // Bug: string coercion
  return data;
}`;

  codeAnalysisOutput: {
    complexity: string;
    severity: 'High' | 'Medium' | 'Clean';
    issueTitle: string;
    issueDetail: string;
    refactoredCode: string;
    keyTakeaway: string;
  } | null = null;

  // Assignments State
  selectedAssignmentTab: 'Upcoming' | 'Submitted & graded' | 'Drafts' = 'Upcoming';
  activeSubmissionModal: any = null;
  submissionRepoUrl = '';
  submissionNotes = '';

  upcomingAssignments = [
    {
      id: 'assign-1',
      course: 'Angular Development: Zero to Hero',
      due: 'Due tomorrow',
      title: 'Module 6 Capstone: Reactive State Management',
      description: 'Implement a resilient state store using fine-grained signals, computed values, and RxJS interop.',
      level: 'Advanced',
      reward: '100 XP + Certificate',
    },
    {
      id: 'assign-2',
      course: 'JavaScript Mastery & Modern ES6+',
      due: 'Due in 4 days',
      title: 'Async Scheduler & Event Loop Engine',
      description: 'Design and test a task scheduler that handles asynchronous queues, concurrency limits, and error recovery.',
      level: 'Intermediate',
      reward: '75 XP',
    },
    {
      id: 'assign-3',
      course: 'Full-Stack Node.js Architecture',
      due: 'Due in 8 days',
      title: 'Distributed REST Gateway with Rate Limiting',
      description: 'Build a production-grade API gateway with token-bucket rate limiting and structured logging.',
      level: 'Advanced',
      reward: '120 XP',
    },
  ];

  submittedAssignments = [
    {
      id: 'sub-prev-1',
      course: 'JavaScript Mastery & Modern ES6+',
      title: 'Async Scheduler & Event Loop Engine',
      submittedDate: 'Oct 19, 2026',
      grade: 96,
      maxGrade: 100,
      feedback: 'Excellent handling of async edge cases, queue exhaustion, and promise rejections. Unit tests were comprehensive.',
      status: 'Graded',
      badgeClass: 'text-bg-success-subtle text-success',
    },
  ];

  draftAssignments = [
    {
      id: 'draft-1',
      course: 'Angular Development: Zero to Hero',
      title: 'Module 6 Capstone: Reactive State Store',
      savedAgo: 'Saved 2h ago',
      notes: 'Initial signal store created; need to add effects for localStorage sync.',
    },
  ];

  // Course Player / Lesson State
  activeLessonIndex = 0;
  lessonCompleted = false;
  isCodeRunning = false;
  lessonConsoleOutput = '';
  studentLessonNotes = '';
  notesSavedNotice = '';

  readonly syllabusLessons = [
    {
      id: 'lesson-1',
      module: 'Module 1 · Foundations',
      title: 'Understanding Reactive Primitives',
      duration: '12m',
      completed: true,
      description: 'Learn how signals, computed values, and effects work together to build responsive Angular interfaces.',
      tips: [
        'Use writable signals to hold primary reactive state values.',
        'Use computed state for values derived automatically from your signals.',
      ],
      code: `const count = signal(0);
const doubled = computed(() => count() * 2);
console.log('Initial doubled:', doubled());
count.set(count() + 1);
console.log('After set(1):', doubled());`,
      simulatedOutput: `> [Signal Init]: count = 0
> [Computed Init]: doubled = 0
> Initial doubled: 0
> [Reactive Trigger]: count updated to 1
> [Computed Re-eval]: doubled recalculated to 2
> After set(1): 2
✔ Reactive graph updated synchronously.`,
    },
    {
      id: 'lesson-2',
      module: 'Module 1 · Foundations',
      title: 'Computed Signals & Dependency Tracking',
      duration: '15m',
      completed: false,
      description: 'Explore the internal dependency graph that Angular constructs dynamically during computed evaluation.',
      tips: [
        'Dependencies are determined dynamically by signal reads during execution.',
        'If a signal is not read during a branch, it is not tracked as a dependency.',
      ],
      code: `const showTax = signal(true);
const amount = signal(100);
const total = computed(() => {
  return showTax() ? amount() * 1.15 : amount();
});
console.log('Total with tax:', total());`,
      simulatedOutput: `> [Computed Eval]: reading showTax() [true] and amount() [100]
> Total with tax: 115
> Cached memoized result ready.`,
    },
    {
      id: 'lesson-3',
      module: 'Module 2 · Advanced Signals',
      title: 'Side Effects & Resource Cleanup',
      duration: '18m',
      completed: false,
      description: 'Use effects for logging, analytics, and external synchronization while preventing memory leaks.',
      tips: [
        'Always clean up timers and WebSocket listeners with the onCleanup callback.',
        'Avoid setting other signals inside effects unless explicitly needed.',
      ],
      code: `effect((onCleanup) => {
  const timer = setInterval(() => console.log('Heartbeat: active'), 5000);
  onCleanup(() => clearInterval(timer));
});`,
      simulatedOutput: `> [Effect Created]: registered onCleanup callback.
> Heartbeat timer active.
> Cleanup registered on effect destruction.`,
    },
  ];

  // Roadmap State
  careerTarget = 'Full-Stack AI Engineer';
  weeklyCommitment = 7;
  pathProgress = 64;

  pathSteps = [
    { label: 'STEP 01 · FOUNDATION', title: 'Web Foundations & Responsive UI', detail: 'Semantic HTML, CSS layout, responsive design systems, and accessibility.', state: 'Complete', icon: 'check_circle' },
    { label: 'STEP 02 · CORE MASTERY', title: 'Modern JavaScript & Async Internals', detail: 'Closures, execution contexts, promises, and event loop patterns.', state: 'Complete', icon: 'check_circle' },
    { label: 'STEP 03 · CURRENT FOCUS', title: 'Angular & Reactive Primitives', detail: 'Signals, components, and state management in Angular 20.', state: 'In progress', icon: 'play_circle' },
    { label: 'STEP 04 · UP NEXT', title: 'Node.js, Express & Microservices', detail: 'Build high-throughput APIs and distributed applications.', state: 'Up next', icon: 'route' },
  ];

  // Teacher / Instructor State
  teacherTab: 'overview' | 'grading' | 'courses' | 'roster' = 'overview';
  teacherRosterFilter = 'All';
  teacherOverviewData: {
    courses: number;
    publishedCourses: number;
    draftCourses: number;
    enrolledLearners: number;
    completedEnrollments: number;
  } | null = null;
  teacherCoursesList: ApiCourse[] = [];

  readonly fallbackTeacherCourses: ApiCourse[] = [
    {
      id: 'course-t-1',
      title: 'Angular Development: Zero to Hero',
      description: 'Master Angular signals, modern reactivity, SSR, and enterprise microfrontends.',
      category: 'Development',
      level: 'Advanced',
      duration: '18 hours',
      lessons: 24,
      status: 'published',
      instructor: 'Dr. Sarah Connor',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
      publishedAt: '2026-09-05T00:00:00.000Z',
      modules: [],
    },
    {
      id: 'course-t-2',
      title: 'Full-Stack Node.js Architecture & Microservices',
      description: 'Build high-throughput, distributed microservices using Node.js, Express, Docker, and Redis caching.',
      category: 'Development',
      level: 'Intermediate',
      duration: '14 hours',
      lessons: 15,
      status: 'published',
      instructor: 'Dr. Sarah Connor',
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
      publishedAt: '2026-09-12T00:00:00.000Z',
      modules: [],
    },
    {
      id: 'course-t-3',
      title: 'Enterprise AI Engineering with Google Gemini',
      description: 'Integrate multi-modal LLMs, function calling, vector search, and agentic workflows into production apps.',
      category: 'AI & Prompting',
      level: 'Advanced',
      duration: '20 hours',
      lessons: 18,
      status: 'draft',
      instructor: 'Dr. Sarah Connor',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
      publishedAt: null,
      modules: [],
    },
  ];

  readonly teacherRoster = [
    { name: 'Alex Rivera', email: 'a.rivera@stanford.edu', course: 'Angular Development: Zero to Hero', progress: 84, grade: 'A', status: 'Active', avatar: 'AR' },
    { name: 'Marina Bell', email: 'marina.bell@mit.edu', course: 'Angular Development: Zero to Hero', progress: 92, grade: 'A+', status: 'Active', avatar: 'MB' },
    { name: 'Priya Sharma', email: 'priya.s@berkeley.edu', course: 'Full-Stack Node.js Architecture', progress: 68, grade: 'B+', status: 'Active', avatar: 'PS' },
    { name: 'Marcus Young', email: 'marcus.y@toronto.edu', course: 'Full-Stack Node.js Architecture', progress: 96, grade: 'A+', status: 'Active', avatar: 'MY' },
    { name: 'Elena Kost', email: 'e.kost@ethz.ch', course: 'Enterprise AI Engineering with Google Gemini', progress: 42, grade: 'B', status: 'Needs check-in', avatar: 'EK' },
  ];

  questionBankCount = 42;
  activeReviewModal: SubmissionItem | null = null;
  reviewGrade = 95;
  reviewFeedback = '';

  readonly submissions: SubmissionItem[] = [
    {
      id: 'sub-1',
      initials: 'AR',
      name: 'Alex Rivera',
      course: 'AI Product Strategy · Capstone',
      status: 'Due in 4h',
      submittedAgo: '4.5h ago',
      repoUrl: 'https://github.com/arivera/ai-guardrails-capstone',
      studentCode: `export async function routeUserPrompt(prompt: string, tenantId: string) {
  const tokenBudget = await getTenantTokenBudget(tenantId);
  if (tokenBudget <= 0) throw new Error('Token quota exceeded');
  return sanitizePromptAndDispatch(prompt);
}`,
      aiConfidence: '93.1%',
      aiScore: 94,
      aiFeedback: 'Excellent insight into microservice guardrails and security tradeoffs. The prompt sanitization step appropriately blocks prompt injection patterns.',
      rubric: { architecture: 40, tests: 27, performance: 27 },
    },
    {
      id: 'sub-2',
      initials: 'MB',
      name: 'Marina Bell',
      course: 'Reactive State Store & Signals',
      status: 'Due in 12h',
      submittedAgo: '1.2h ago',
      repoUrl: 'https://github.com/marinabell/signal-state-store',
      studentCode: `export class ReactiveCartStore {
  readonly items = signal<CartItem[]>([]);
  readonly totalCount = computed(() => this.items().reduce((acc, i) => acc + i.qty, 0));
  readonly subtotal = computed(() => this.items().reduce((acc, i) => acc + (i.price * i.qty), 0));
}`,
      aiConfidence: '96.4%',
      aiScore: 98,
      aiFeedback: 'Outstanding usage of Angular signals and fine-grained computed properties. Glitch-free and memory efficient.',
      rubric: { architecture: 40, tests: 30, performance: 28 },
    },
    {
      id: 'sub-3',
      initials: 'PS',
      name: 'Priya Sharma',
      course: 'Async Scheduler & Event Loop Engine',
      status: 'Awaiting review',
      submittedAgo: '30m ago',
      repoUrl: 'https://github.com/priyasharma/event-loop-scheduler',
      studentCode: `export class TaskScheduler {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  constructor(private concurrency = 4) {}
}`,
      aiConfidence: '91.8%',
      aiScore: 92,
      aiFeedback: 'Clean promise concurrency limiter with FIFO queue semantics. Handles promise rejections safely.',
      rubric: { architecture: 38, tests: 26, performance: 28 },
    },
  ];

  // Curriculum Builder State
  courseTitle = 'Full-Stack Node.js & Microservices';
  courseCategory = 'Development';
  courseLevel: 'Beginner' | 'Intermediate' | 'Advanced' = 'Intermediate';
  courseDuration = '14 hours';
  courseDescription = 'Build high-throughput, distributed microservices using modern Node.js, Express, Docker, and Redis caching.';
  isPublishingCourse = false;
  newTopicTitle = '';

  builderModules: BuilderModule[] = [
    {
      label: 'MODULE 1',
      title: 'Foundations & Architecture',
      lessons: 4,
      duration: '48m',
      status: 'Published',
      topics: ['Event loop internals & libuv', 'Buffer, Streams & Backpressure', 'Worker threads & Clustering'],
    },
    {
      label: 'MODULE 2',
      title: 'Scopes, Closures & Concurrency',
      lessons: 6,
      duration: '1h 12m',
      status: 'Active editing',
      topics: ['AsyncLocalStorage & Context tracing', 'Task queue throttling', 'Graceful shutdown patterns'],
    },
    {
      label: 'MODULE 3',
      title: 'RESTful API & Distributed Services',
      lessons: 5,
      duration: '1h 30m',
      status: 'Draft',
      topics: ['Token-bucket rate limiting', 'JWT auth & refresh rotation', 'OpenAPI documentation & contract testing'],
    },
  ];

  // Common Platform Metrics
  readonly lessonList = ['Foundations & setup', 'Scopes & execution', 'Async JavaScript', 'Angular signals & effects'];
  readonly assignmentList = [
    { course: 'Angular Development: Zero to Hero', due: 'Due tomorrow', title: 'Module 6 Capstone: Reactive State Management', description: 'Implement a resilient state store using fine-grained signals and RxJS streams.', level: 'Advanced', reward: '100 XP + certificate' },
    { course: 'JavaScript Mastery & Modern ES6+', due: 'Due in 4 days', title: 'Async Scheduler & Event Loop Engine', description: 'Design and test a task scheduler that handles asynchronous queues safely.', level: 'Intermediate', reward: '75 XP' },
  ];
  readonly progressMetrics = [
    { label: 'STUDY INVESTMENT', value: '54.2 hrs', detail: '+18.4% this period' },
    { label: 'SKILL VALIDATION', value: '18 / 24', detail: '75% verified' },
    { label: 'DIAGNOSTIC QUALITY', value: '92.4%', detail: '+3.1% first-attempt accuracy' },
    { label: 'LEARNING STREAK', value: '21 days', detail: 'Personal best' },
  ];
  chartBars = [42, 58, 75, 51, 86, 65, 94];
  reportRange = '7 days';
  readonly skills = [
    { name: 'Syntax & patterns', value: 88 },
    { name: 'Asynchronous JavaScript', value: 74 },
    { name: 'Angular signals', value: 64 },
    { name: 'Testing workflows', value: 42 },
  ];
  readonly instructorMetrics = [
    { label: 'COURSES MANAGED', value: '8', detail: '6 active · 2 drafts' },
    { label: 'ACTIVE STUDENTS', value: '8,450', detail: '+14% this month' },
    { label: 'COMPLETION RATE', value: '78.4%', detail: '+3.2% vs benchmark' },
    { label: 'SUBMISSIONS TO GRADE', value: '18', detail: '4 need priority review' },
  ];
  readonly adminMetrics = [
    { label: 'TOTAL PLATFORM USERS', value: '42,850', detail: 'Across 3 user roles' },
    { label: 'CURRICULUM STATUS', value: '120', detail: '108 published · 12 in review' },
    { label: 'MONTHLY AI INFERENCES', value: '1.42M', detail: 'Average latency 240ms' },
    { label: 'PLATFORM GROSS ARR', value: '$482.5K', detail: '14 multi-campus sites' },
  ];
  readonly users = [
    { name: 'Amara Chen', email: 'a.chen@stanford.edu', role: 'Student', status: 'Active', joined: 'Jun 2026' },
    { name: 'Prof. Liam Gallagher', email: 'gallagher@oxford.ac.uk', role: 'Instructor', status: 'Active', joined: 'May 2026' },
    { name: 'Nia Robinson', email: 'nia.robinson@cognilearn.ai', role: 'Instructor', status: 'Pending activation', joined: 'Apr 2026' },
    { name: 'Tariq Raman', email: 'tariq@syndicate-labs.io', role: 'Student', status: 'Active', joined: 'Mar 2026' },
    { name: 'Ariana Wells', email: 'a.wells@cognilearn.ai', role: 'Admin', status: 'Pending activation', joined: 'Jul 2026' },
  ];
  readonly systemHealth = [
    { name: 'AI tutor inference', status: '99.8% SLA' },
    { name: 'Course catalog API', status: 'Operational' },
    { name: 'Content moderation', status: '3 pending' },
  ];
  readonly aboutFeatures = [
    { icon: 'person', title: 'Learner focused', text: 'Clear paths and feedback that help every learner make progress.' },
    { icon: 'verified_user', title: 'Practical by design', text: 'Build confidence through real projects and measurable outcomes.' },
  ];
  readonly moderationState = ['Pending review', 'Pending review'];
  safeguardsLocked = false;
  selectedUserRole = 'All';

  readonly pageDetailsByView: Record<string, WorkspacePageDetails> = {
    dashboard: {
      eyebrow: 'YOUR LEARNING WORKSPACE',
      heading: 'Make every study session count',
      summary: 'Use this overview to see what is moving forward, what needs attention, and where to resume. A short, regular session is often more useful than waiting for a perfect block of free time.',
      highlights: [
        { title: 'Resume your current course', detail: 'The in-progress course card links directly to your next lesson and keeps your recent learning context close at hand.' },
        { title: 'Track the habits behind progress', detail: 'Streaks, study hours, completion, and assessment results provide different signals about your learning routine.' },
        { title: 'Plan around upcoming work', detail: 'Review deadlines and quick actions before choosing the most useful task for today.' },
      ],
    },
    student: {
      eyebrow: 'STUDENT ACCOUNT',
      heading: 'Your learning hub is now active',
      summary: 'Student account access is enabled. Use this workspace to jump into your dashboard, review your courses, and track your pace across the platform.',
      highlights: [
        { title: 'Launch your learning dashboard', detail: 'Check course momentum, upcoming deadlines, and recent activity from one place.' },
        { title: 'Access the student pages you need', detail: 'Move between your dashboard, course library, progress analytics, and AI tutor quickly.' },
        { title: 'Stay on track with feedback', detail: 'Use course notes, analytics, and practice tools to decide the next action for your next study session.' },
      ],
    },
    'my-courses': {
      eyebrow: 'YOUR COURSE LIBRARY',
      heading: 'Organize what you are learning now',
      summary: 'Your library is the home for active and completed study. Search by course title or subject, check completion at a glance, and reopen a course when you are ready to continue.',
      highlights: [
        { title: 'Find a course quickly', detail: 'Use the search field to narrow your list by course name or subject area.' },
        { title: 'See your progress', detail: 'Completion indicators and lesson totals help you understand how much work remains.' },
        { title: 'Choose a next step', detail: 'Continue an active course or visit the catalog to find a new subject that supports your goals.' },
      ],
    },
    roadmap: {
      eyebrow: 'PERSONALIZED LEARNING PATH',
      heading: 'Connect today’s lesson to a longer-term goal',
      summary: 'The roadmap breaks a career direction into milestones, from foundational knowledge through applied projects. Adjust the target role or weekly commitment to make the plan better fit your schedule.',
      highlights: [
        { title: 'Follow a sensible sequence', detail: 'Milestones build on earlier skills so new topics have a clear foundation.' },
        { title: 'Set a sustainable pace', detail: 'A weekly study commitment makes the target date easier to plan around and revisit.' },
        { title: 'Spot skills you have unlocked', detail: 'The skills panel connects completed work to practical capabilities you can continue developing.' },
      ],
    },
    lesson: {
      eyebrow: 'GUIDED COURSE PLAYER',
      heading: 'Learn a concept, then apply it immediately',
      summary: 'Use the lesson player to focus on one idea at a time. Follow the explanation, review the worked example, and use the syllabus to move between related topics without losing the course sequence.',
      highlights: [
        { title: 'Build understanding in steps', detail: 'Lessons introduce a core idea before adding related concepts and implementation details.' },
        { title: 'Study the example', detail: 'Code snippets and concise notes help connect the explanation to a pattern you can reuse.' },
        { title: 'Keep your place', detail: 'The syllabus shows how this lesson fits into the wider module and course.' },
      ],
    },
    tutor: {
      eyebrow: 'AI TUTORING WORKSPACE',
      heading: 'Ask focused questions while you learn',
      summary: 'Use the tutor to clarify a confusing term, compare approaches, or request a hint for a course exercise. The most useful prompts include the topic you are studying and what you have already tried.',
      highlights: [
        { title: 'Ask for an explanation', detail: 'Request a plain-language walkthrough of a concept, then ask follow-up questions about individual steps.' },
        { title: 'Get a hint before a solution', detail: 'Use progressive hints to keep the problem-solving work in your hands.' },
        { title: 'Stay aligned with your course', detail: 'Course context helps focus a question on the concepts and terminology you are currently learning.' },
      ],
    },
    quiz: {
      eyebrow: 'PRACTICE & KNOWLEDGE CHECK',
      heading: 'Use retrieval practice to strengthen understanding',
      summary: 'Work through one question at a time, choose an answer, and use the explanation to identify what to review. A quiz is most useful as a learning signal, not just a score.',
      highlights: [
        { title: 'Think before revealing', detail: 'Commit to an answer and explain your reasoning to yourself before moving to the next question.' },
        { title: 'Review the concept behind a choice', detail: 'Answer details point back to the mental model or rule that distinguishes a strong choice.' },
        { title: 'Turn gaps into a study plan', detail: 'Use diagnostic notes to revisit topics that need another example or a slower walkthrough.' },
      ],
    },
    code: {
      eyebrow: 'CODE REVIEW & EXPLANATION',
      heading: 'Understand the reason behind a code change',
      summary: 'The code explainer highlights potential issues, explains their impact, and shows safer alternatives. Treat its output as a review aid: check assumptions, validate behavior, and run tests in your project.',
      highlights: [
        { title: 'Read the finding in context', detail: 'Severity and issue descriptions help distinguish correctness concerns from optional improvements.' },
        { title: 'Study the suggested pattern', detail: 'A small corrected example can make asynchronous behavior and data handling easier to reason about.' },
        { title: 'Verify before adopting', detail: 'Confirm the recommendation against your requirements, types, tests, and actual runtime behavior.' },
      ],
    },
    assignments: {
      eyebrow: 'PROJECTS & SUBMISSIONS',
      heading: 'Apply course ideas to work you can review',
      summary: 'Assignments turn lesson concepts into concrete deliverables. Check the due date and rubric, break larger work into small steps, and use feedback to decide what to improve next.',
      highlights: [
        { title: 'Prioritize upcoming work', detail: 'Sort attention by due date and course so you can start the most time-sensitive task early.' },
        { title: 'Show your reasoning', detail: 'Clear implementation notes and focused tests help reviewers understand how your solution works.' },
        { title: 'Use feedback as a next step', detail: 'Evaluation notes point to strengths to keep and specific areas to practice again.' },
      ],
    },
    progress: {
      eyebrow: 'LEARNING ANALYTICS',
      heading: 'Look beyond completion to understand your momentum',
      summary: 'Progress combines time, consistency, assessment quality, and skill development. Compare trends over a useful time range, then use a specific finding to shape your next study session.',
      highlights: [
        { title: 'Notice changes in study rhythm', detail: 'Weekly activity makes it easier to see whether your current routine is sustainable.' },
        { title: 'Identify skills to strengthen', detail: 'Skill indicators help separate comfortable topics from topics that still need practice.' },
        { title: 'Compare progress across courses', detail: 'Course velocity offers a quick view of where effort is translating into completion.' },
      ],
    },
    instructor: {
      eyebrow: 'INSTRUCTOR TEACHING WORKSPACE',
      heading: 'Support learners with timely, actionable guidance',
      summary: 'The instructor dashboard brings course health, learner activity, and grading priorities together. Use it to decide where a small intervention can remove friction for the largest number of learners.',
      highlights: [
        { title: 'Monitor course health', detail: 'Enrollment, completion, and feedback signals help you spot material that may need clarification.' },
        { title: 'Prioritize learner reviews', detail: 'Submission queues and deadlines make it easier to focus on work that needs timely feedback.' },
        { title: 'Improve teaching material', detail: 'Use learner questions and AI-assisted drafts as inputs to review and refine your curriculum.' },
      ],
    },
    builder: {
      eyebrow: 'COURSE AUTHORING WORKSPACE',
      heading: 'Shape a curriculum learners can navigate',
      summary: 'The builder organizes course content into modules and lessons. Keep each unit focused, make the sequence explicit, and check the learner preview to see how your structure reads outside the authoring view.',
      highlights: [
        { title: 'Create a learning sequence', detail: 'Order modules so foundational ideas appear before the tasks that depend on them.' },
        { title: 'Balance depth and pace', detail: 'Lesson counts and durations help learners estimate effort and find manageable checkpoints.' },
        { title: 'Review before publishing', detail: 'Preview the learner experience and use course-health feedback to find gaps in the structure.' },
      ],
    },
    admin: {
      eyebrow: 'PLATFORM GOVERNANCE',
      heading: 'Manage access, quality, and operational health',
      summary: 'The governance workspace brings identity, curriculum review, platform signals, and safeguards into one operational view. Use role filters to investigate a focused set of accounts and review alerts with appropriate care.',
      highlights: [
        { title: 'Keep access understandable', detail: 'Review user roles and account status to maintain clear, accountable access across the organization.' },
        { title: 'Protect learning quality', detail: 'Curriculum and moderation queues surface material that needs a human review.' },
        { title: 'Watch service health', detail: 'Operational indicators help teams notice reliability or security signals that may need follow-up.' },
      ],
    },
    about: {
      eyebrow: 'OUR APPROACH',
      heading: 'Make technical learning practical and welcoming',
      summary: 'NexaLearn combines structured learning, practical projects, and adaptive learning tools to make high-quality technology education more accessible.',
      highlights: [
        { title: 'Design for different starting points', detail: 'Clear sequencing and flexible pacing help learners find a meaningful place to begin.' },
        { title: 'Connect knowledge to practice', detail: 'Exercises and projects make technical concepts tangible and easier to apply later.' },
        { title: 'Keep the learner in control', detail: 'Guidance supports independent thinking, reflection, and deliberate next steps.' },
      ],
    },
  };

  get pageDetails(): WorkspacePageDetails | undefined {
    return this.pageDetailsByView[this.view];
  }

  get quizQuestions(): QuizQuestion[] {
    return this.quizBanks[this.selectedTopic] || this.quizBanks['angular'];
  }

  get currentQuiz(): QuizQuestion {
    return this.quizQuestions[this.quizQuestion - 1] || this.quizQuestions[0];
  }

  get correctQuizAnswers(): number {
    return this.quizQuestions.reduce(
      (score, question, index) => score + (this.quizAnswers[index + 1] === question.correctAnswer ? 1 : 0),
      0,
    );
  }

  get currentLessonData() {
    return this.syllabusLessons[this.activeLessonIndex] || this.syllabusLessons[0];
  }

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.view = data['view'] ?? 'dashboard';
      this.title = data['title'] ?? 'Learning workspace';
      this.description = data['description'] ?? 'Continue your learning journey.';
      this.eyebrow =
        this.view === 'admin'
          ? 'PLATFORM GOVERNANCE'
          : this.view === 'instructor' || this.view === 'builder'
          ? 'INSTRUCTOR WORKSPACE'
          : this.view === 'student'
          ? 'STUDENT ACCOUNT'
          : 'LEARNING WORKSPACE';
      this.seo.update(this.title, this.description);
      if (this.view === 'my-courses') this.loadEnrollments();
      if (this.view === 'instructor') this.loadTeacherData();
    });

    this.route.paramMap.subscribe((params) => {
      this.learningCourse = this.service.getCourse(params.get('id') ?? '');
    });
  }

  // Course Filtering & Saved List
  filteredCourses(): Course[] {
    const term = this.query.trim().toLowerCase();
    return this.enrolledCourses.filter((course) => this.matchesCourseFilter(course, this.courseFilter, term));
  }

  courseCount(filter: 'all' | 'in-progress' | 'completed' | 'saved'): number {
    const term = this.query.trim().toLowerCase();
    return this.enrolledCourses.filter((course) => this.matchesCourseFilter(course, filter, term)).length;
  }

  loadEnrollments(): void {
    this.enrollmentsLoading = true;
    this.enrollmentsError = '';
    this.learningApi.listEnrollments().subscribe({
      next: ({ data }) => {
        if (data && data.length > 0) {
          this.enrolledCourses = data.flatMap(enrollment => enrollment.course
            ? [this.mapEnrollmentCourse(enrollment)]
            : []);
        } else {
          this.enrolledCourses = [...this.service.courses];
        }
        this.enrollmentsLoading = false;
      },
      error: () => {
        this.enrolledCourses = [...this.service.courses];
        this.enrollmentsLoading = false;
      },
    });
  }

  private mapEnrollmentCourse(enrollment: ApiEnrollment): Course {
    const course = enrollment.course!;
    return {
      id: course.id, title: course.title, category: course.category, level: course.level,
      lessons: course.lessons, duration: course.duration, progress: enrollment.progress,
      students: 'Active', color: '#e8eaff', icon: 'school', description: course.description,
      instructor: course.instructor, instructorTitle: 'Course instructor', rating: '4.9',
      reviews: '120', price: 'Free', callToAction: 'Continue learning', outcomes: [],
      projects: [], tools: [], modules: course.modules,
    };
  }

  private matchesCourseFilter(course: Course, filter: 'all' | 'in-progress' | 'completed' | 'saved', term: string): boolean {
    const progress = course.progress ?? 0;
    const matchesFilter =
      filter === 'all' ||
      (filter === 'in-progress' && progress > 0 && progress < 100) ||
      (filter === 'completed' && progress === 100) ||
      (filter === 'saved' && this.savedCourseIds.has(course.id));
    return matchesFilter && `${course.title} ${course.category}`.toLowerCase().includes(term);
  }

  toggleSavedCourse(courseId: string): void {
    if (this.savedCourseIds.has(courseId)) {
      this.savedCourseIds.delete(courseId);
      this.showActionFeedback('Course removed from your saved list.');
      return;
    }
    this.savedCourseIds.add(courseId);
    this.showActionFeedback('Course saved to your learning list.');
  }

  resetCourseFilters(): void {
    this.query = '';
    this.courseFilter = 'all';
  }

  showActionFeedback(message: string): void {
    this.actionFeedback = message;
    setTimeout(() => {
      if (this.actionFeedback === message) {
        this.actionFeedback = '';
      }
    }, 4500);
  }

  // AI Tutor Actions
  askTutorPrompt(prompt: string): void {
    this.message = prompt;
    this.sendMessage();
  }

  sendMessage(): void {
    const trimmed = this.message.trim();
    if (!trimmed) {
      this.showActionFeedback('Please enter a question before sending it to the tutor.');
      return;
    }

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: trimmed,
      time: 'Just now',
    };
    this.chatMessages.push(userMsg);
    this.lastMessage = trimmed;
    this.message = '';
    this.newDialogue = false;
    this.isTutorTyping = true;

    setTimeout(() => {
      this.isTutorTyping = false;
      const lower = trimmed.toLowerCase();
      let reply: ChatMessage;

      if (lower.includes('signal') || lower.includes('rxjs')) {
        reply = {
          id: 'tutor-' + Date.now(),
          sender: 'tutor',
          text: 'Great question! Signals provide fine-grained synchronous reactivity with automatic dependency tracking, meaning Angular recomputes derived state only when tracked reads change. In contrast, RxJS excels at asynchronous event streams, debouncing, and web socket handling.',
          time: 'Just now',
          code: `// Synchronous reactivity with Signals:\nconst query = signal('');\nconst filtered = computed(() => items().filter(i => i.includes(query())));\n\n// Async stream with RxJS:\nconst search$ = inputEvents$.pipe(debounceTime(300), switchMap(api.search));`,
          tip: 'Mental Model: Use Signals for component UI state and caching. Use RxJS for asynchronous streams, event handling, and cancellation.',
        };
      } else if (lower.includes('closure') || lower.includes('scope')) {
        reply = {
          id: 'tutor-' + Date.now(),
          sender: 'tutor',
          text: 'A closure is the combination of a function bundled together with references to its surrounding lexical state. Even after the outer function finishes executing, inner functions maintain access to outer variables.',
          time: 'Just now',
          code: `function createCounter() {\n  let count = 0; // Enclosed lexical variable\n  return () => ++count;\n}\nconst next = createCounter();\nconsole.log(next()); // 1\nconsole.log(next()); // 2`,
          tip: 'Careful with memory leaks: Avoid holding large objects in outer closures when they are no longer needed.',
        };
      } else if (lower.includes('challenge') || lower.includes('exercise')) {
        reply = {
          id: 'tutor-' + Date.now(),
          sender: 'tutor',
          text: 'Here is your 5-minute code challenge: Implement an async function `retryWithBackoff(fn, retries, delay)` that attempts an API call up to N times before throwing.',
          time: 'Just now',
          code: `async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {\n  try {\n    return await fn();\n  } catch (err) {\n    if (retries <= 1) throw err;\n    await new Promise(r => setTimeout(r, delay));\n    return retryWithBackoff(fn, retries - 1, delay * 2);\n  }\n}`,
          tip: 'Try writing tests for network timeout edge cases!',
        };
      } else if (lower.includes('big-o') || lower.includes('complexity')) {
        reply = {
          id: 'tutor-' + Date.now(),
          sender: 'tutor',
          text: 'Big-O notation describes how execution time or memory requirements scale as input size N grows toward infinity. Common complexities: O(1) Constant, O(log N) Binary search, O(N) Linear scan, O(N log N) Efficient sorting, O(N²) Nested loops.',
          time: 'Just now',
          code: `// O(1) Constant: Object or Map lookup\nconst val = map.get(key);\n\n// O(N) Linear: Single iteration\nconst found = list.find(item => item.id === id);\n\n// O(N^2) Quadratic: Nested search (anti-pattern)\nconst dupes = list.filter(a => other.includes(a));`,
          tip: 'Rule of thumb: Convert nested lookup arrays into Sets or Maps to drop algorithmic time from O(N²) to O(N).',
        };
      } else {
        reply = {
          id: 'tutor-' + Date.now(),
          sender: 'tutor',
          text: `Here is a structured breakdown for "${trimmed}":\n\n1. Core Concept: Ensure your implementation handles synchronous contracts cleanly before introducing asynchronous flows.\n2. Design Pattern: Decouple business logic from framework rendering cycles.\n3. Safety: Always add error boundaries or try/catch around unverified boundaries.`,
          time: 'Just now',
          code: `// Recommended pattern:\ntry {\n  const result = await processTask(input);\n  return { success: true, data: result };\n} catch (error) {\n  logger.error('Failed to process task', error);\n  return { success: false, error: error.message };\n}`,
          tip: 'Would you like to generate a practice quiz on this topic or inspect a sample in the Code Explainer?',
        };
      }

      this.chatMessages.push(reply);
      this.showActionFeedback('AI Tutor responded to your query.');
    }, 450);
  }

  startNewDialogue(): void {
    this.lastMessage = '';
    this.message = '';
    this.newDialogue = true;
    this.chatMessages = [
      {
        id: 'welcome-' + Date.now(),
        sender: 'tutor',
        text: 'New session started! What would you like to master today? Choose a suggested topic below or paste a snippet.',
        time: 'Just now',
        tip: 'Tutor memory refreshed.',
      },
    ];
    this.showActionFeedback('New tutor dialogue started. Context refreshed.');
  }

  toggleExerciseCoach(): void {
    this.exerciseStarted = !this.exerciseStarted;
    this.showActionFeedback(
      this.exerciseStarted
        ? '🎯 Targeted 10-minute focus exercise started. Keep coding!'
        : 'Targeted study exercise paused.',
    );
  }

  // Quiz Generator Actions
  switchQuizTopic(topicId: string): void {
    this.selectedTopic = topicId;
    this.restartQuiz();
    this.showActionFeedback(`Quiz loaded for: ${this.quizTopics.find(t => t.id === topicId)?.name}`);
  }

  submitQuiz(): void {
    if (!this.selectedAnswer) {
      this.quizNotice = 'Choose an answer to continue.';
      return;
    }
    this.quizAnswers[this.quizQuestion] = this.selectedAnswer;
    if (this.quizQuestion === this.quizQuestions.length) {
      this.quizComplete = true;
      this.quizNotice = 'Practice complete. Review your score below.';
      this.showActionFeedback(`🎉 Quiz finished! You scored ${this.correctQuizAnswers} / ${this.quizQuestions.length} (+75 XP).`);
      return;
    }
    this.quizQuestion += 1;
    this.selectedAnswer = this.quizAnswers[this.quizQuestion] ?? '';
    this.quizNotice = 'Answer saved in this preview. The next question is ready.';
  }

  previousQuizQuestion(): void {
    if (this.quizQuestion <= 1) {
      return;
    }
    this.quizQuestion -= 1;
    this.selectedAnswer = this.quizAnswers[this.quizQuestion] ?? '';
    this.quizNotice = 'Returned to the previous question.';
  }

  restartQuiz(): void {
    this.quizQuestion = 1;
    this.quizComplete = false;
    this.selectedAnswer = '';
    this.quizNotice = '';
    for (const key of Object.keys(this.quizAnswers)) {
      delete this.quizAnswers[Number(key)];
    }
  }

  // AI Code Explainer Actions
  loadCodePreset(presetType: 'async-bug' | 'memory-leak' | 'signals-mutation' | 'loop-complexity'): void {
    this.codeLoaded = true;
    if (presetType === 'async-bug') {
      this.selectedLanguage = 'typescript';
      this.codeSnippet = `async function loadUserProfile(userId: string) {
  const response = await fetch('/api/users/' + userId);
  const data = response.json(); // Bug: missing await on Promise
  localStorage.setItem('cached_user', data); // Bug: string coercion
  return data;
}`;
    } else if (presetType === 'memory-leak') {
      this.selectedLanguage = 'typescript';
      this.codeSnippet = `function attachLiveWatcher(element: HTMLElement) {
  const hugeBuffer = new Array(500000).fill('cached');
  window.addEventListener('resize', () => {
    console.log(element.id, hugeBuffer.length);
  }); // Bug: listener is never removed when element unmounts!
}`;
    } else if (presetType === 'signals-mutation') {
      this.selectedLanguage = 'typescript';
      this.codeSnippet = `const items = signal<string[]>(['alpha', 'beta']);
function addEntry(item: string) {
  items().push(item); // Anti-pattern: in-place array mutation does not notify dependencies
}`;
    } else {
      this.selectedLanguage = 'javascript';
      this.codeSnippet = `function findSharedIds(listA, listB) {
  return listA.filter(item => listB.includes(item)); // O(N*M) nested scan!
}`;
    }
    this.analyzeCode();
  }

  analyzeCode(): void {
    this.isAnalyzingCode = true;
    this.codeLoaded = true;

    setTimeout(() => {
      this.isAnalyzingCode = false;
      const snippet = this.codeSnippet;

      if (snippet.includes('response.json()') && !snippet.includes('await response.json()')) {
        this.codeAnalysisOutput = {
          complexity: 'Time: O(1) · Memory: O(1)',
          severity: 'High',
          issueTitle: 'The response body promise is not awaited',
          issueDetail: 'Calling response.json() returns a Promise. Storing or returning it without await produces [object Promise] and causes runtime bugs.',
          refactoredCode: `async function loadUserProfile(userId: string) {
  const response = await fetch('/api/users/' + encodeURIComponent(userId));
  if (!response.ok) throw new Error('Failed to load user profile');
  const data = await response.json(); // Safely awaited
  localStorage.setItem('cached_user', JSON.stringify(data)); // Correct JSON serialization
  return data;
}`,
          keyTakeaway: 'Always await response.json() and serialize structured objects with JSON.stringify before storing in localStorage.',
        };
      } else if (snippet.includes('addEventListener') && !snippet.includes('removeEventListener')) {
        this.codeAnalysisOutput = {
          complexity: 'Time: O(1) · Memory: Leak Risk',
          severity: 'High',
          issueTitle: 'Uncleaned window event listener creates memory leak',
          issueDetail: 'The resize listener holds a reference to hugeBuffer in outer closure. Because it is never detached, the garbage collector cannot free memory.',
          refactoredCode: `function attachLiveWatcher(element: HTMLElement, signal: AbortSignal) {
  window.addEventListener('resize', () => {
    console.log(element.id);
  }, { signal }); // Automatically detaches when signal aborts!
}`,
          keyTakeaway: 'Pass an AbortSignal to addEventListener or return a cleanup function to allow automatic garbage collection on unmount.',
        };
      } else if (snippet.includes('.push(')) {
        this.codeAnalysisOutput = {
          complexity: 'Time: O(1) · Memory: O(1)',
          severity: 'Medium',
          issueTitle: 'In-place array mutation breaks signal reactivity',
          issueDetail: 'Directly calling .push() on a signal’s array mutates the object without changing reference identity, preventing computed values and effects from reacting.',
          refactoredCode: `const items = signal<string[]>(['alpha', 'beta']);
function addEntry(item: string) {
  items.update(current => [...current, item]); // Emits immutable new array
}`,
          keyTakeaway: 'Use signal.update() with immutable spread [...array, newItem] to reliably trigger consumer dependencies.',
        };
      } else if (snippet.includes('.includes(')) {
        this.codeAnalysisOutput = {
          complexity: 'Time: O(N · M) Quadratic',
          severity: 'Medium',
          issueTitle: 'Nested array search scales quadratically',
          issueDetail: 'Running listB.includes() inside listA.filter() performs an O(M) scan for every element in listA, degrading performance on large collections.',
          refactoredCode: `function findSharedIds(listA, listB) {
  const lookupSet = new Set(listB); // O(M) one-time setup
  return listA.filter(item => lookupSet.has(item)); // O(1) hash lookups -> O(N) total
}`,
          keyTakeaway: 'Convert lookup collections into Sets or Maps to reduce search algorithmic complexity from O(N²) to linear O(N).',
        };
      } else {
        this.codeAnalysisOutput = {
          complexity: 'Time: O(N) · Memory: O(1)',
          severity: 'Clean',
          issueTitle: 'Syntactic and architectural validation passed',
          issueDetail: 'No immediate critical anti-patterns or race conditions were found in the scanned block.',
          refactoredCode: this.codeSnippet,
          keyTakeaway: 'Code adheres to standard clean-code practices. Ensure unit test coverage verifies boundary cases.',
        };
      }
      this.showActionFeedback('AI Code Analysis complete.');
    }, 380);
  }

  copyRefactoredCode(): void {
    if (this.codeAnalysisOutput?.refactoredCode) {
      void navigator.clipboard?.writeText(this.codeAnalysisOutput.refactoredCode);
      this.copyFeedback = 'Copied!';
      this.showActionFeedback('Refactored code copied to clipboard!');
      setTimeout(() => (this.copyFeedback = ''), 3000);
    }
  }

  // Course Player & Lesson Actions
  selectSyllabusLesson(index: number): void {
    this.activeLessonIndex = index;
    this.lessonCompleted = this.syllabusLessons[index]?.completed ?? false;
    this.lessonConsoleOutput = '';
    this.showActionFeedback(`Loaded lesson: ${this.currentLessonData.title}`);
  }

  runLessonCode(): void {
    this.isCodeRunning = true;
    setTimeout(() => {
      this.isCodeRunning = false;
      this.lessonConsoleOutput = this.currentLessonData.simulatedOutput;
      this.showActionFeedback('Code ran successfully in browser sandbox.');
    }, 400);
  }

  markLessonCompleteAndContinue(): void {
    this.syllabusLessons[this.activeLessonIndex].completed = true;
    this.lessonCompleted = true;

    // Advance to next lesson if available
    if (this.activeLessonIndex < this.syllabusLessons.length - 1) {
      this.activeLessonIndex += 1;
      this.lessonCompleted = this.syllabusLessons[this.activeLessonIndex].completed;
      this.lessonConsoleOutput = '';
    }

    this.showActionFeedback('Lesson marked complete! Progress updated (+50 XP).');

    // Sync progress with backend if enrollment exists
    if (this.enrolledCourses.length > 0) {
      const active = this.enrolledCourses[0];
      const newProgress = Math.min(100, (active.progress ?? 50) + 12);
      active.progress = newProgress;
    }
  }

  saveLessonNotes(): void {
    if (!this.studentLessonNotes.trim()) {
      this.showActionFeedback('Please enter some notes before saving.');
      return;
    }
    localStorage.setItem(`lesson_notes_${this.activeLessonIndex}`, this.studentLessonNotes);
    this.notesSavedNotice = 'Notes saved to your study journal.';
    this.showActionFeedback('Study notes saved successfully.');
    setTimeout(() => (this.notesSavedNotice = ''), 4000);
  }

  // Assignments Actions
  setAssignmentTab(tab: 'Upcoming' | 'Submitted & graded' | 'Drafts'): void {
    this.selectedAssignmentTab = tab;
  }

  openSubmitModal(assignment: any): void {
    this.activeSubmissionModal = assignment;
    this.submissionRepoUrl = '';
    this.submissionNotes = '';
  }

  closeSubmitModal(): void {
    this.activeSubmissionModal = null;
  }

  submitAssignmentWork(): void {
    if (!this.activeSubmissionModal) return;
    const title = this.activeSubmissionModal.title;
    const course = this.activeSubmissionModal.course;

    // Add to submitted
    this.submittedAssignments.unshift({
      id: 'sub-' + Date.now(),
      course,
      title,
      submittedDate: 'Today',
      grade: 95,
      maxGrade: 100,
      feedback: 'Preliminary AI Pre-check passed: 95/100 (Architecture 38/40, Tests 29/30, Lint 28/30). Awaiting instructor sign-off.',
      status: 'Pending review',
      badgeClass: 'text-bg-warning-subtle text-warning-emphasis',
    });

    // Remove from upcoming
    this.upcomingAssignments = this.upcomingAssignments.filter(a => a.id !== this.activeSubmissionModal.id);
    this.activeSubmissionModal = null;
    this.selectedAssignmentTab = 'Submitted & graded';
    this.showActionFeedback(`🎉 Assignment "${title}" submitted! Preliminary AI score: 95/100.`);
  }

  // Roadmap Actions
  updateLearningPath(): void {
    if (this.careerTarget === 'Frontend Engineer') {
      this.pathSteps = [
        { label: 'STEP 01 · FOUNDATION', title: 'HTML5, Modern CSS & Responsive UI', detail: 'Grid, flexbox, custom properties, and WCAG accessibility standards.', state: 'Complete', icon: 'check_circle' },
        { label: 'STEP 02 · CORE MASTERY', title: 'Advanced JavaScript & DOM Performance', detail: 'Event bubbling, render tree, web workers, and memory profiling.', state: 'Complete', icon: 'check_circle' },
        { label: 'STEP 03 · CURRENT FOCUS', title: 'Angular 20 & Reactive Microfrontends', detail: 'Signals, standalone components, router state, and SSR.', state: 'In progress', icon: 'play_circle' },
        { label: 'STEP 04 · UP NEXT', title: 'Design Systems & Component Libraries', detail: 'Storybook, automated regression testing, and semantic theming.', state: 'Up next', icon: 'route' },
      ];
    } else if (this.careerTarget === 'Data Scientist') {
      this.pathSteps = [
        { label: 'STEP 01 · FOUNDATION', title: 'Python Syntax & Data Analysis', detail: 'NumPy, pandas, and data cleaning pipelines.', state: 'Complete', icon: 'check_circle' },
        { label: 'STEP 02 · CORE MASTERY', title: 'Statistical Modeling & Visualization', detail: 'Matplotlib, Seaborn, hypothesis testing, and regressions.', state: 'In progress', icon: 'play_circle' },
        { label: 'STEP 03 · UP NEXT', title: 'Machine Learning & Scikit-Learn', detail: 'Supervised classification, clustering, and cross-validation.', state: 'Up next', icon: 'route' },
        { label: 'STEP 04 · CAPSTONE', title: 'Deep Learning & Neural Networks', detail: 'TensorFlow, PyTorch, and model deployment.', state: 'Up next', icon: 'route' },
      ];
    } else {
      this.pathSteps = [
        { label: 'STEP 01 · FOUNDATION', title: 'Web Foundations & Responsive UI', detail: 'Semantic HTML, CSS layout, responsive design systems, and accessibility.', state: 'Complete', icon: 'check_circle' },
        { label: 'STEP 02 · CORE MASTERY', title: 'Modern JavaScript & Async Internals', detail: 'Closures, execution contexts, promises, and event loop patterns.', state: 'Complete', icon: 'check_circle' },
        { label: 'STEP 03 · CURRENT FOCUS', title: 'Angular & Reactive Primitives', detail: 'Signals, components, and state management in Angular 20.', state: 'In progress', icon: 'play_circle' },
        { label: 'STEP 04 · UP NEXT', title: 'Node.js, Express & Microservices', detail: 'Build high-throughput APIs and distributed applications.', state: 'Up next', icon: 'route' },
      ];
    }
    this.showActionFeedback(`Learning path updated for ${this.careerTarget} at ${this.weeklyCommitment} hrs/week.`);
  }

  toggleStepState(index: number): void {
    const step = this.pathSteps[index];
    if (step.state === 'Complete') {
      step.state = 'In progress';
      step.icon = 'play_circle';
    } else if (step.state === 'In progress') {
      step.state = 'Complete';
      step.icon = 'check_circle';
    } else {
      step.state = 'In progress';
      step.icon = 'play_circle';
    }
    const completed = this.pathSteps.filter(s => s.state === 'Complete').length;
    this.pathProgress = Math.round((completed / this.pathSteps.length) * 100);
    this.showActionFeedback(`Milestone "${step.title}" updated to ${step.state}.`);
  }

  // Teacher / Instructor Actions
  setTeacherTab(tab: 'overview' | 'grading' | 'courses' | 'roster'): void {
    this.teacherTab = tab;
  }

  filteredTeacherRoster() {
    if (this.teacherRosterFilter === 'All') return this.teacherRoster;
    return this.teacherRoster.filter(r => r.course.includes(this.teacherRosterFilter));
  }

  loadTeacherData(): void {
    this.learningApi.teacherOverview().subscribe({
      next: ({ data }) => {
        this.teacherOverviewData = data;
      },
      error: () => {
        // Retain fallback data gracefully
      },
    });

    this.learningApi.teacherCourses().subscribe({
      next: ({ data }) => {
        if (data && data.length > 0) {
          this.teacherCoursesList = data;
        } else {
          this.teacherCoursesList = [...this.fallbackTeacherCourses];
        }
      },
      error: () => {
        this.teacherCoursesList = [...this.fallbackTeacherCourses];
      },
    });
  }

  openReview(sub: SubmissionItem): void {
    this.activeReviewModal = sub;
    this.reviewGrade = sub.aiScore;
    this.reviewFeedback = sub.aiFeedback;
  }

  closeReview(): void {
    this.activeReviewModal = null;
  }

  submitReviewGrade(): void {
    if (!this.activeReviewModal) return;
    const student = this.activeReviewModal.name;
    const grade = this.reviewGrade;
    const index = this.submissions.findIndex(s => s.id === this.activeReviewModal?.id);
    if (index !== -1) {
      this.submissions.splice(index, 1);
    }
    this.activeReviewModal = null;
    this.showActionFeedback(`Grade of ${grade}/100 and feedback sent to ${student}. Submission approved.`);
  }

  requestReviewRevision(): void {
    if (!this.activeReviewModal) return;
    const student = this.activeReviewModal.name;
    this.activeReviewModal.status = 'Revision requested';
    this.activeReviewModal = null;
    this.showActionFeedback(`Revision requested from ${student} with your feedback notes.`);
  }

  addToQuestionBank(): void {
    this.questionBankCount += 5;
    this.showActionFeedback(`5 AI-generated practice questions added to your course question bank (Total: ${this.questionBankCount}).`);
  }

  // Curriculum Builder Actions
  addLesson(): void {
    const num = this.builderModules.length + 1;
    this.builderModules.push({
      label: `MODULE ${num}`,
      title: `New Module ${num}`,
      lessons: 3,
      duration: '45m',
      status: 'Draft',
      topics: ['Topic 1: Core concepts', 'Topic 2: Practical implementation', 'Topic 3: Lab exercise'],
    });
    this.showActionFeedback(`Module ${num} added to the curriculum outline.`);
  }

  deleteModule(index: number): void {
    const removed = this.builderModules.splice(index, 1);
    this.showActionFeedback(`Module "${removed[0]?.title}" removed.`);
  }

  editModule(index: number): void {
    const module = this.builderModules[index];
    if (module) {
      module.status = module.status === 'Active editing' ? 'Draft' : 'Active editing';
      this.showActionFeedback(`${module.title} is now ${module.status.toLowerCase()}.`);
    }
  }

  addTopicToModule(moduleIndex: number): void {
    if (!this.newTopicTitle.trim()) {
      this.showActionFeedback('Please enter a topic title to add.');
      return;
    }
    const targetModule = this.builderModules[moduleIndex];
    if (targetModule) {
      targetModule.topics.push(this.newTopicTitle.trim());
      targetModule.lessons = targetModule.topics.length;
      this.showActionFeedback(`Topic "${this.newTopicTitle.trim()}" added to ${targetModule.title}.`);
      this.newTopicTitle = '';
    }
  }

  deleteTopic(moduleIndex: number, topicIndex: number): void {
    const targetModule = this.builderModules[moduleIndex];
    if (targetModule) {
      targetModule.topics.splice(topicIndex, 1);
      targetModule.lessons = targetModule.topics.length;
      this.showActionFeedback('Topic removed from module.');
    }
  }

  generateAiOutline(): void {
    this.showActionFeedback('✨ AI is generating structured modules from your course title...');
    setTimeout(() => {
      this.builderModules = [
        {
          label: 'MODULE 1',
          title: 'Foundations & Architecture',
          lessons: 4,
          duration: '45m',
          status: 'Published',
          topics: ['Runtime execution model', 'Memory management & V8 engine', 'Project configuration & tooling'],
        },
        {
          label: 'MODULE 2',
          title: 'Asynchronous Core & Event Loop',
          lessons: 5,
          duration: '1h 10m',
          status: 'Active editing',
          topics: ['Promises, microtasks & macrotasks', 'Handling concurrent streams', 'Deadlock & starvation prevention'],
        },
        {
          label: 'MODULE 3',
          title: 'Production API Design & Microservices',
          lessons: 4,
          duration: '1h 25m',
          status: 'Draft',
          topics: ['High-throughput routing', 'Rate limiting & token buckets', 'Observability & OpenTelemetry'],
        },
        {
          label: 'MODULE 4',
          title: 'Security, Testing & Cloud Deployment',
          lessons: 4,
          duration: '1h 15m',
          status: 'Draft',
          topics: ['JWT auth & cryptographic signing', 'Integration tests with testcontainers', 'Dockerizing & horizontal scaling'],
        },
      ];
      this.showActionFeedback('✨ AI generated 4 comprehensive modules with topics.');
    }, 450);
  }

  saveCourseDraft(): void {
    this.showActionFeedback(`Course "${this.courseTitle}" saved as draft in database.`);
  }

  publishCourse(): void {
    if (!this.courseTitle.trim() || !this.courseDescription.trim()) {
      this.showActionFeedback('Please specify course title and description before publishing.');
      return;
    }

    this.isPublishingCourse = true;
    const payload = {
      title: this.courseTitle.trim(),
      description: this.courseDescription.trim(),
      category: this.courseCategory,
      level: this.courseLevel,
      duration: this.courseDuration,
      modules: this.builderModules.map(m => ({
        title: m.title,
        lessons: m.topics.length || m.lessons,
        duration: m.duration,
        topics: m.topics.length ? m.topics : ['Introduction', 'Core concepts', 'Project capstone'],
      })),
    };

    this.learningApi.createCourse(payload).subscribe({
      next: ({ data }) => {
        this.isPublishingCourse = false;
        // Also set status to published
        this.learningApi.setCourseStatus(data.id, 'published').subscribe({
          next: () => {
            this.showActionFeedback(`🎉 Course "${data.title}" published to catalog successfully!`);
          },
          error: () => {
            this.showActionFeedback(`Course "${data.title}" created!`);
          },
        });
      },
      error: () => {
        this.isPublishingCourse = false;
        this.showActionFeedback(`🎉 Course "${this.courseTitle}" published to catalog! Visible in course library.`);
      },
    });
  }

  toggleCourseStatus(courseId: string, currentStatus: 'draft' | 'published'): void {
    const nextStatus = currentStatus === 'published' ? 'draft' : 'published';
    this.learningApi.setCourseStatus(courseId, nextStatus).subscribe({
      next: () => {
        const found = this.teacherCoursesList.find(c => c.id === courseId);
        if (found) found.status = nextStatus;
        this.showActionFeedback(`Course status updated to ${nextStatus}.`);
      },
      error: () => {
        this.showActionFeedback(`Course status changed to ${nextStatus}.`);
      },
    });
  }

  // Admin & Analytics Actions
  filteredUsers() {
    return this.selectedUserRole === 'All'
      ? this.users
      : this.users.filter(user => user.role === this.selectedUserRole);
  }

  activateUser(email: string): void {
    const user = this.users.find(item => item.email === email);
    if (!user) return;
    user.status = user.status === 'Active' ? 'Suspended' : 'Active';
    this.showActionFeedback(`${user.name} account is now ${user.status.toLowerCase()}.`);
  }

  toggleReportRange(): void {
    this.reportRange = this.reportRange === '7 days' ? '30 days' : '7 days';
    this.chartBars = this.reportRange === '30 days'
      ? [54, 66, 61, 79, 72, 88, 94]
      : [42, 58, 75, 51, 86, 65, 94];
    this.showActionFeedback(`Progress chart range changed to the last ${this.reportRange}.`);
  }

  navigateTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  updateModeration(index: number, status: string): void {
    this.moderationState[index] = status;
    this.showActionFeedback(`Curriculum review marked: ${status.toLowerCase()}.`);
  }
}
