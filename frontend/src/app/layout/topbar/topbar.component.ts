import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TranslationService } from '../../core/translation.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TopbarComponent {
  readonly auth = inject(AuthService);
  readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();

  searchQuery = '';
  userMenuOpen = false;

  get currentLanguageLabel(): string {
    return this.translation.currentLanguage === 'en' ? 'العربية' : 'English';
  }

  get currentLanguageCode(): string {
    return this.translation.currentLanguage === 'en' ? 'AR' : 'EN';
  }

  get accountName(): string {
    return this.auth.currentAccount()?.name ?? 'Learner';
  }

  get accountRole(): string {
    const role = this.auth.currentAccount()?.role;
    if (!role) return 'Learner';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  get accountRoleBadgeClass(): string {
    const role = this.auth.currentAccount()?.role;
    if (role === 'teacher') return 'badge-teacher';
    if (role === 'admin') return 'badge-admin';
    return 'badge-student';
  }

  get accountInitials(): string {
    return (this.auth.currentAccount()?.name ?? 'L')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  get roleModeLabel(): string {
    const role = this.auth.currentAccount()?.role;
    if (role === 'teacher') return 'Instructor Mode';
    if (role === 'admin') return 'Admin Console';
    return 'Student Mode';
  }

  get roleModeIcon(): string {
    const role = this.auth.currentAccount()?.role;
    if (role === 'teacher') return 'cast_for_education';
    if (role === 'admin') return 'admin_panel_settings';
    return 'school';
  }

  get dropdownLinks(): Array<{ label: string; icon: string; route: string }> {
    const role = this.auth.currentAccount()?.role;
    if (role === 'teacher') {
      return [
        { label: 'Instructor Hub', icon: 'cast_for_education', route: '/instructor' },
        { label: 'Curriculum Builder', icon: 'edit_note', route: '/instructor/course-builder' },
        { label: 'AI Quiz Studio', icon: 'quiz', route: '/ai/quiz-generator' },
        { label: 'AI Code Reviewer', icon: 'terminal', route: '/ai/code-explainer' },
        { label: 'Course Catalog Preview', icon: 'travel_explore', route: '/courses' },
      ];
    }
    if (role === 'admin') {
      return [
        { label: 'Admin Governance', icon: 'admin_panel_settings', route: '/admin' },
        { label: 'Curriculum Builder', icon: 'edit_note', route: '/instructor/course-builder' },
        { label: 'Course Catalog', icon: 'travel_explore', route: '/courses' },
      ];
    }
    return [
      { label: 'Student Dashboard', icon: 'space_dashboard', route: '/dashboard' },
      { label: 'My Enrolled Courses', icon: 'menu_book', route: '/my-courses' },
      { label: 'Assignments', icon: 'assignment', route: '/assignments' },
      { label: 'Progress Analytics', icon: 'insights', route: '/progress' },
      { label: 'AI Tutor Companion', icon: 'auto_awesome', route: '/ai-tutor' },
    ];
  }

  get pageTitle(): string {
    const url = this.router.url.split('?')[0].split('#')[0];
    if (url === '/dashboard') return 'Dashboard';
    if (url === '/student') return 'Student Account';
    if (url === '/my-courses') return 'My Courses';
    if (url === '/learning-paths') return 'Learning Paths';
    if (url.startsWith('/learning')) return 'Course Player';
    if (url === '/ai-tutor') return 'AI Tutor Companion';
    if (url === '/ai/quiz-generator') return 'AI Quiz Generator';
    if (url === '/ai/code-explainer') return 'AI Code Explainer';
    if (url === '/assignments') return 'Assignments & Submissions';
    if (url === '/progress') return 'Progress Analytics';
    if (url === '/instructor') return 'Instructor Dashboard';
    if (url === '/instructor/course-builder') return 'Curriculum Builder';
    if (url === '/admin') return 'Admin Governance';
    return 'Workspace';
  }

  toggleLanguage(): void {
    this.translation.toggleLanguage();
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  onSearchSubmit(): void {
    const q = this.searchQuery.trim();
    if (q) {
      this.router.navigate(['/courses'], { queryParams: { q } });
      this.searchQuery = '';
    }
  }

  async signOut(): Promise<void> {
    try {
      this.closeUserMenu();
      await firstValueFrom(this.auth.logout());
      await this.router.navigateByUrl('/');
    } catch {
      await this.router.navigateByUrl('/');
    }
  }
}
