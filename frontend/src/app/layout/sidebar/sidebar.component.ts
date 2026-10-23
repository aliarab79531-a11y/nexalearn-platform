import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TranslationService } from '../../core/translation.service';

export interface SidebarLink {
  label: string;
  icon: string;
  route: string;
  badge?: string;
  badgeClass?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  readonly translation = inject(TranslationService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  logoutError = '';

  // Student Navigation (Learning, AI Studio, Academic)
  readonly studentLearningItems: SidebarLink[] = [
    { label: 'Dashboard', icon: 'space_dashboard', route: '/dashboard' },
    { label: 'My Courses', icon: 'menu_book', route: '/my-courses' },
    { label: 'Learning Paths', icon: 'alt_route', route: '/learning-paths' },
    { label: 'Explore Courses', icon: 'travel_explore', route: '/courses' },
  ];

  readonly studentAiItems: SidebarLink[] = [
    { label: 'AI Tutor', icon: 'auto_awesome', route: '/ai-tutor', badge: 'LIVE', badgeClass: 'badge-glow' },
    { label: 'Quiz Generator', icon: 'quiz', route: '/ai/quiz-generator' },
    { label: 'Code Explainer', icon: 'code_blocks', route: '/ai/code-explainer' },
  ];

  readonly studentAcademicItems: SidebarLink[] = [
    { label: 'Assignments', icon: 'assignment', route: '/assignments' },
    { label: 'Progress Analytics', icon: 'insights', route: '/progress' },
  ];

  // Teacher / Instructor Navigation (Strictly segregated!)
  readonly teacherItems: SidebarLink[] = [
    { label: 'Instructor Hub', icon: 'cast_for_education', route: '/instructor' },
    { label: 'Curriculum Builder', icon: 'edit_note', route: '/instructor/course-builder' },
    { label: 'Course Catalog Preview', icon: 'travel_explore', route: '/courses' },
  ];

  readonly teacherAiItems: SidebarLink[] = [
    { label: 'AI Quiz Studio', icon: 'quiz', route: '/ai/quiz-generator', badge: 'SMART', badgeClass: 'badge-glow' },
    { label: 'AI Code Reviewer', icon: 'terminal', route: '/ai/code-explainer' },
    { label: 'AI Teaching Assistant', icon: 'auto_awesome', route: '/ai-tutor' },
  ];

  // Admin Navigation
  readonly adminItems: SidebarLink[] = [
    { label: 'Admin Governance', icon: 'admin_panel_settings', route: '/admin' },
    { label: 'Curriculum Builder', icon: 'edit_note', route: '/instructor/course-builder' },
    { label: 'Course Catalog', icon: 'travel_explore', route: '/courses' },
  ];

  // Backwards compatibility aliases
  get learningItems(): SidebarLink[] { return this.studentLearningItems; }
  get aiItems(): SidebarLink[] { return this.studentAiItems; }
  get academicItems(): SidebarLink[] { return this.studentAcademicItems; }

  get brandTag(): string {
    const role = this.auth.currentAccount()?.role;
    if (role === 'teacher') return 'INSTRUCTOR';
    if (role === 'admin') return 'ADMIN';
    return 'STUDENT';
  }

  toggleLanguage(): void {
    this.translation.toggleLanguage();
  }

  get currentLanguageLabel(): string {
    return this.translation.currentLanguage === 'en' ? 'العربية' : 'English';
  }

  get currentLanguageCode(): string {
    return this.translation.currentLanguage === 'en' ? 'AR' : 'EN';
  }

  get accountName(): string {
    return this.auth.currentAccount()?.name ?? 'Guest User';
  }

  get accountEmail(): string {
    return this.auth.currentAccount()?.email ?? '';
  }

  get accountInitials(): string {
    return (this.auth.currentAccount()?.name ?? 'G')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(name => name[0]?.toUpperCase() ?? '')
      .join('');
  }

  get accountRole(): string {
    const role = this.auth.currentAccount()?.role;
    return role ? role[0].toUpperCase() + role.slice(1) : 'Guest';
  }

  get roleBadgeClass(): string {
    const role = this.auth.currentAccount()?.role;
    if (role === 'teacher') return 'role-teacher';
    if (role === 'admin') return 'role-admin';
    return 'role-student';
  }

  get accountHome(): string {
    const role = this.auth.currentAccount()?.role ?? 'student';
    return role === 'admin' ? '/admin' : role === 'teacher' ? '/instructor' : '/dashboard';
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.auth.logout());
      this.logoutError = '';
      await this.router.navigateByUrl('/');
    } catch {
      this.logoutError = 'Sign out could not be completed. Please try again.';
    }
  }
}
