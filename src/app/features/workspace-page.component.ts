import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CourseService } from '../core/course.service';
import { Course } from '../core/models';
import { SeoService } from '../core/seo.service';
import { LearningApiService, ApiEnrollment } from '../core/learning-api.service';

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
  enrolledCourses: Course[] = [];
  enrollmentsLoading = false;
  enrollmentsError = '';
  message = '';
  lastMessage = '';
  selectedAnswer = '';
  actionFeedback = '';
  quizNotice = '';
  selectedAssignmentTab = 'Upcoming';
  selectedUserRole = 'All';
  reportRange = '7 days';
  careerTarget = 'Full-Stack AI Engineer';
  weeklyCommitment = 7;
  quizQuestion = 1;
  quizComplete = false;
  readonly quizAnswers: Record<number, string> = {};
  lessonCompleted = false;
  newDialogue = false;
  exerciseStarted = false;
  safeguardsLocked = false;
  codeLoaded = false;
  readonly moderationState = ['Pending review', 'Pending review'];

  readonly pathSteps = [
    { label: 'STEP 01 · FOUNDATION', title: 'Web Foundations & Responsive UI', detail: 'Semantic HTML, CSS layout, responsive design systems, and accessibility.', state: 'Complete', icon: 'check_circle' },
    { label: 'STEP 02 · CORE MASTERY', title: 'Modern JavaScript & Async Internals', detail: 'Closures, execution contexts, promises, and event loop patterns.', state: 'Complete', icon: 'check_circle' },
    { label: 'STEP 03 · CURRENT FOCUS', title: 'Angular & Reactive Primitives', detail: 'Signals, components, and state management in Angular 20.', state: 'In progress', icon: 'play_circle' },
    { label: 'STEP 04 · UP NEXT', title: 'Node.js, Express & Microservices', detail: 'Build high-throughput APIs and distributed applications.', state: 'Up next', icon: 'route' },
  ];
  readonly lessonList = ['Foundations & setup', 'Scopes & execution', 'Async JavaScript', 'Angular signals & effects'];
  readonly quizQuestions = [
    {
      prompt: 'When does a computed signal recalculate its value?',
      correctAnswer: 'b',
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
      options: [
        { id: 'a', title: 'To avoid recalculating until a dependency changes', detail: 'The cached result remains valid while its dependencies remain unchanged.' },
        { id: 'b', title: 'To prevent future updates', detail: 'A dependency change invalidates the cached value.' },
        { id: 'c', title: 'To save the value between browser sessions', detail: 'Computed values are in-memory reactive state.' },
        { id: 'd', title: 'To force periodic refreshes', detail: 'Computed signals do not use polling intervals.' },
      ],
    },
  ];
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
  readonly submissions = [
    { initials: 'MT', name: 'Marcus Thorne', course: 'TypeScript Enterprise · Capstone 3', status: 'Due in 4h' },
    { initials: 'AR', name: 'Anaya Roy', course: 'JavaScript Mastery · Event Loop Lab', status: 'Due in 12h' },
  ];
  readonly builderModules = [
    { label: 'MODULE 1', title: 'Foundations & Variables', lessons: 4, duration: '48m', status: 'Published' },
    { label: 'MODULE 2', title: 'Scopes & Closures', lessons: 6, duration: '1h 12m', status: 'Active editing' },
    { label: 'MODULE 3', title: 'Async JavaScript & Event Loop', lessons: 5, duration: '1h 30m', status: 'Draft' },
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
      summary: 'NexaLearn combines structured learning, realistic practice, and helpful guidance so learners can build confidence through visible progress rather than passive content consumption.',
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

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.view = data['view'] ?? 'dashboard';
      this.title = data['title'] ?? 'Learning workspace';
      this.description = data['description'] ?? 'Continue your learning journey.';
      this.eyebrow = this.view === 'admin' ? 'PLATFORM GOVERNANCE' : this.view === 'instructor' || this.view === 'builder' ? 'INSTRUCTOR WORKSPACE' : this.view === 'student' ? 'STUDENT ACCOUNT' : 'LEARNING WORKSPACE';
      this.seo.update(this.title, this.description);
      if (this.view === 'my-courses') this.loadEnrollments();
    });
    this.route.paramMap.subscribe((params) => {
      this.learningCourse = this.service.getCourse(params.get('id') ?? '');
    });
  }

  get currentQuiz() {
    return this.quizQuestions[this.quizQuestion - 1];
  }

  get correctQuizAnswers(): number {
    return this.quizQuestions.reduce(
      (score, question, index) => score + (this.quizAnswers[index + 1] === question.correctAnswer ? 1 : 0),
      0,
    );
  }

  previousQuizQuestion(): void {
    if (this.quizQuestion <= 1) {
      return;
    }
    this.quizQuestion -= 1;
    this.selectedAnswer = this.quizAnswers[this.quizQuestion] ?? '';
    this.quizNotice = 'Returned to the previous question.';
  }

  filteredCourses() {
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
        this.enrolledCourses = data.flatMap(enrollment => enrollment.course
          ? [this.mapEnrollmentCourse(enrollment)]
          : []);
        this.enrollmentsLoading = false;
      },
      error: () => {
        this.enrollmentsError = 'Your course library could not be loaded. Please try again.';
        this.enrollmentsLoading = false;
      },
    });
  }

  private mapEnrollmentCourse(enrollment: ApiEnrollment): Course {
    const course = enrollment.course!;
    return {
      id: course.id, title: course.title, category: course.category, level: course.level,
      lessons: course.lessons, duration: course.duration, progress: enrollment.progress,
      students: '', color: '#e8eaff', icon: 'school', description: course.description,
      instructor: course.instructor, instructorTitle: 'Course instructor', rating: '—',
      reviews: '0', price: 'Free', callToAction: 'Continue learning', outcomes: [],
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
      this.actionFeedback = 'Course removed from your saved list.';
      return;
    }
    this.savedCourseIds.add(courseId);
    this.actionFeedback = 'Course saved to your learning list.';
  }

  resetCourseFilters(): void {
    this.query = '';
    this.courseFilter = 'all';
  }

  sendMessage(): void {
    const message = this.message.trim();
    if (!message) {
      this.actionFeedback = 'Enter a question before sending it to the tutor.';
      return;
    }
    this.lastMessage = message;
    this.message = '';
    this.newDialogue = false;
    this.actionFeedback = 'Message added to this tutor preview. AI responses require a connected backend.';
  }

  showActionFeedback(message: string): void {
    this.actionFeedback = message;
  }

  updateLearningPath(): void {
    this.actionFeedback = `Learning path updated for ${this.careerTarget} at ${this.weeklyCommitment} hours per week.`;
  }

  startNewDialogue(): void {
    this.lastMessage = '';
    this.message = '';
    this.newDialogue = true;
    this.actionFeedback = 'New tutor dialogue started.';
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
      return;
    }
    this.quizQuestion += 1;
    this.selectedAnswer = this.quizAnswers[this.quizQuestion] ?? '';
    this.quizNotice = 'Answer saved in this preview. The next question is ready.';
  }

  restartQuiz(): void {
    this.quizQuestion = 1;
    this.quizComplete = false;
    this.selectedAnswer = '';
    this.quizNotice = '';
    for (const questionNumber of Object.keys(this.quizAnswers)) {
      delete this.quizAnswers[Number(questionNumber)];
    }
  }

  filteredUsers() {
    return this.selectedUserRole === 'All'
      ? this.users
      : this.users.filter(user => user.role === this.selectedUserRole);
  }

  activateUser(email: string): void {
    const user = this.users.find(item => item.email === email);
    if (!user) {
      return;
    }

    user.status = user.status === 'Active' ? 'Suspended' : 'Active';
    this.actionFeedback = `${user.name} account is now ${user.status.toLowerCase()}.`;
  }

  addLesson(): void {
    const lessonNumber = this.builderModules.length + 1;
    this.builderModules.push({
      label: `MODULE ${lessonNumber}`,
      title: `New module ${lessonNumber}`,
      lessons: 1,
      duration: '15m',
      status: 'Draft',
    });
    this.actionFeedback = 'A new draft module was added to the curriculum.';
  }

  editModule(index: number): void {
    const module = this.builderModules[index];
    if (module) {
      module.status = module.status === 'Active editing' ? 'Draft' : 'Active editing';
      this.actionFeedback = `${module.title} is ${module.status.toLowerCase()}.`;
    }
  }

  toggleReportRange(): void {
    this.reportRange = this.reportRange === '7 days' ? '30 days' : '7 days';
    this.chartBars = this.reportRange === '30 days'
      ? [54, 66, 61, 79, 72, 88, 94]
      : [42, 58, 75, 51, 86, 65, 94];
    this.actionFeedback = `Progress chart range changed to the last ${this.reportRange}.`;
  }

  navigateTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  setAssignmentTab(tab: string): void {
    this.selectedAssignmentTab = tab;
  }

  updateModeration(index: number, status: string): void {
    this.moderationState[index] = status;
    this.actionFeedback = `Curriculum review marked: ${status.toLowerCase()}.`;
  }
}
