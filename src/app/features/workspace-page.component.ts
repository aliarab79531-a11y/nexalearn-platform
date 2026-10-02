import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CourseService } from '../core/course.service';
import { SeoService } from '../core/seo.service';

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
  private readonly seo = inject(SeoService);
  view = 'dashboard';
  title = '';
  description = '';
  eyebrow = 'LEARNING WORKSPACE';
  query = '';
  message = '';
  lastMessage = '';
  selectedAnswer = '';

  readonly pathSteps = [
    { label: 'STEP 01 · FOUNDATION', title: 'Web Foundations & Responsive UI', detail: 'Semantic HTML, CSS layout, responsive design systems, and accessibility.', state: 'Complete', icon: 'check_circle' },
    { label: 'STEP 02 · CORE MASTERY', title: 'Modern JavaScript & Async Internals', detail: 'Closures, execution contexts, promises, and event loop patterns.', state: 'Complete', icon: 'check_circle' },
    { label: 'STEP 03 · CURRENT FOCUS', title: 'Angular & Reactive Primitives', detail: 'Signals, components, and state management in Angular 20.', state: 'In progress', icon: 'play_circle' },
    { label: 'STEP 04 · UP NEXT', title: 'Node.js, Express & Microservices', detail: 'Build high-throughput APIs and distributed applications.', state: 'Up next', icon: 'route' },
  ];
  readonly lessonList = ['Foundations & setup', 'Scopes & execution', 'Async JavaScript', 'Angular signals & effects'];
  readonly quizOptions = [
    { id: 'a', title: 'Whenever the component renders', detail: 'Computed values are not tied to component lifecycle.' },
    { id: 'b', title: 'When a signal it read changes', detail: 'Dependencies are tracked automatically while evaluating the computation.' },
    { id: 'c', title: 'Only when explicitly refreshed', detail: 'Computed signals update reactively; they do not need a manual refresh.' },
    { id: 'd', title: 'At fixed time intervals', detail: 'Signals are synchronous state primitives, not polling timers.' },
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
  readonly chartBars = [42, 58, 75, 51, 86, 65, 94];
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
    { name: 'Nia Robinson', email: 'nia.robinson@cognilearn.ai', role: 'Instructor', status: 'Active', joined: 'Apr 2026' },
    { name: 'Tariq Raman', email: 'tariq@syndicate-labs.io', role: 'Student', status: 'Active', joined: 'Mar 2026' },
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

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.view = data['view'] ?? 'dashboard';
      this.title = data['title'] ?? 'Learning workspace';
      this.description = data['description'] ?? 'Continue your learning journey.';
      this.eyebrow = this.view === 'admin' ? 'PLATFORM GOVERNANCE' : this.view === 'instructor' || this.view === 'builder' ? 'INSTRUCTOR WORKSPACE' : 'LEARNING WORKSPACE';
      this.seo.update(this.title, this.description);
    });
  }

  filteredCourses() {
    const term = this.query.trim().toLowerCase();
    return this.service.courses.filter((course) => `${course.title} ${course.category}`.toLowerCase().includes(term));
  }

  sendMessage(): void {
    this.lastMessage = this.message.trim();
    this.message = '';
  }
}
