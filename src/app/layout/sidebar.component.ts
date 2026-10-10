import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NavItem } from '../core/models';
import { AuthService } from '../core/auth.service';
import { TranslationService } from '../core/translation.service';

@Component({
  selector: 'app-sidebar', standalone: true, imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  readonly translation = inject(TranslationService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  logoutError = '';

  readonly studentItems: NavItem[] = [
    { label: 'Student Account', icon: 'school', route: '/student' },
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'My Courses', icon: 'menu_book', route: '/my-courses' },
    { label: 'Explore Courses', icon: 'travel_explore', route: '/courses' },
    { label: 'Learning Path', icon: 'route', route: '/learning-paths' },
    { label: 'AI Tutor', icon: 'auto_awesome', route: '/ai-tutor' },
    { label: 'Quizzes', icon: 'quiz', route: '/ai/quiz-generator' },
  ];

  toggleLanguage(): void {
    this.translation.toggleLanguage();
  }

  get currentLanguageLabel(): string {
    return this.translation.currentLanguage === 'en' ? 'AR' : 'EN';
  }

  get accountInitials(): string {
    return (this.auth.currentAccount()?.name ?? 'G')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(name => name[0]?.toUpperCase() ?? '')
      .join('');
  }

  get accountRoleLabel(): string {
    const role = this.auth.currentAccount()?.role;
    return role ? role[0].toUpperCase() + role.slice(1) : 'Signed out';
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
