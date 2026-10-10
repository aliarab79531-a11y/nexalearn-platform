import { Routes } from '@angular/router';
import { PlatformPageComponent } from './features/platform-page.component';
import { WorkspacePageComponent } from './features/workspace-page.component';
import { accountGuard } from './core/auth.guard';

const publicPage = (view: string, title: string, description: string) => ({
  component: PlatformPageComponent,
  data: { view, title, description },
});

const workspacePage = (
  view: string,
  title: string,
  description: string,
  role: 'student' | 'teacher' | 'admin' = 'student',
) => ({
  component: WorkspacePageComponent,
  canActivate: [accountGuard],
  data: { view, title, description, role },
});

export const routes: Routes = [
  { path: '', ...publicPage('home', 'Learn smarter with AI', 'Personalized learning paths and intelligent tutoring for ambitious builders.') },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'courses', ...publicPage('catalog', 'Explore courses', 'Discover practical courses taught by industry experts.') },
  { path: 'catalog', redirectTo: 'courses', pathMatch: 'full' },
  { path: 'course/:id', ...publicPage('course', 'JavaScript Mastery', 'Master modern JavaScript with a production-focused curriculum.') },
  { path: 'auth/login', ...publicPage('login', 'Sign in', 'Sign in to continue your learning journey.') },
  { path: 'auth/register', ...publicPage('login', 'Create your account', 'Start building your future with AI-powered learning.') },
  { path: 'auth/logout', ...publicPage('logout', 'You’re all set', 'You have reached the NexaLearn sign-out screen.') },
  { path: 'about', ...publicPage('about', 'About NexaLearn AI', 'A learning ecosystem for the next generation of builders.') },
  { path: 'student', ...workspacePage('student', 'Student account', 'Manage your learning dashboard, courses, and progress in one place.') },
  { path: 'dashboard', ...workspacePage('dashboard', 'Student dashboard', 'Track your learning progress and continue your courses.') },
  { path: 'my-courses', ...workspacePage('my-courses', 'My courses', 'Your enrolled courses and progress.') },
  { path: 'learning-paths', ...workspacePage('roadmap', 'Learning paths', 'Follow a roadmap designed around your goals.') },
  { path: 'learning/:id', ...workspacePage('lesson', 'Course player', 'Learn through focused, hands-on lessons.') },
  { path: 'ai-tutor', ...workspacePage('tutor', 'AI Tutor', 'Your always-on intelligent learning companion.') },
  { path: 'ai/quiz-generator', ...workspacePage('quiz', 'AI Quiz Generator', 'Generate practice quizzes tailored to your learning goals.') },
  { path: 'ai/code-explainer', ...workspacePage('code', 'AI Code Explainer', 'Understand and debug code with an AI assistant.') },
  { path: 'assignments', ...workspacePage('assignments', 'Assignments', 'Submit work and track feedback.') },
  { path: 'progress', ...workspacePage('progress', 'Progress analytics', 'Understand your learning momentum.') },
  { path: 'instructor', ...workspacePage('instructor', 'Instructor dashboard', 'Manage courses and learner outcomes.', 'teacher') },
  { path: 'instructor/course-builder', ...workspacePage('builder', 'Curriculum builder', 'Create engaging course curriculum.', 'teacher') },
  { path: 'admin', ...workspacePage('admin', 'Admin governance', 'Manage your learning organization securely.', 'admin') },
  { path: '**', redirectTo: '' },
];
