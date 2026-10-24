import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TranslationService } from '../../core/translation.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  readonly translation = inject(TranslationService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logoutError = '';
  signingOut = false;
  mobileMenuOpen = false;
  aiDropdownOpen = false;
  userDropdownOpen = false;
  portalsDropdownOpen = false;
  demoDropdownOpen = false;
  authPending = false;

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) {
      this.closeAllDropdowns();
    }
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
    this.closeAllDropdowns();
  }

  toggleAiDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.aiDropdownOpen = !this.aiDropdownOpen;
    if (this.aiDropdownOpen) {
      this.userDropdownOpen = false;
      this.portalsDropdownOpen = false;
      this.demoDropdownOpen = false;
    }
  }

  closeAiDropdown(): void {
    this.aiDropdownOpen = false;
  }

  togglePortalsDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.portalsDropdownOpen = !this.portalsDropdownOpen;
    if (this.portalsDropdownOpen) {
      this.aiDropdownOpen = false;
      this.userDropdownOpen = false;
      this.demoDropdownOpen = false;
    }
  }

  closePortalsDropdown(): void {
    this.portalsDropdownOpen = false;
  }

  toggleDemoDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.demoDropdownOpen = !this.demoDropdownOpen;
    if (this.demoDropdownOpen) {
      this.aiDropdownOpen = false;
      this.userDropdownOpen = false;
      this.portalsDropdownOpen = false;
    }
  }

  closeDemoDropdown(): void {
    this.demoDropdownOpen = false;
  }

  toggleUserDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.userDropdownOpen = !this.userDropdownOpen;
    if (this.userDropdownOpen) {
      this.aiDropdownOpen = false;
      this.portalsDropdownOpen = false;
      this.demoDropdownOpen = false;
    }
  }

  closeUserDropdown(): void {
    this.userDropdownOpen = false;
  }

  closeAllDropdowns(): void {
    this.aiDropdownOpen = false;
    this.userDropdownOpen = false;
    this.portalsDropdownOpen = false;
    this.demoDropdownOpen = false;
  }

  toggleLanguage(): void {
    this.translation.toggleLanguage();
  }

  get currentLanguageLabel(): string {
    return this.translation.currentLanguage === 'en' ? 'العربية' : 'English';
  }

  get currentLanguageFull(): string {
    return this.translation.currentLanguage === 'en' ? 'العربية' : 'English';
  }

  get accountHome(): string {
    const role = this.auth.currentAccount()?.role ?? 'student';
    return role === 'admin' ? '/admin' : role === 'teacher' ? '/instructor' : '/dashboard';
  }

  get accountName(): string {
    return this.auth.currentAccount()?.name ?? 'Learner';
  }

  get accountEmail(): string {
    return this.auth.currentAccount()?.email ?? '';
  }

  get accountRole(): string {
    const role = this.auth.currentAccount()?.role;
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  get accountInitials(): string {
    return (this.auth.currentAccount()?.name ?? 'L')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(name => name[0]?.toUpperCase() ?? '')
      .join('');
  }

  get isTeacher(): boolean {
    return this.auth.currentAccount()?.role === 'teacher';
  }

  get isStudent(): boolean {
    return this.auth.currentAccount()?.role === 'student';
  }

  get isAdmin(): boolean {
    return this.auth.currentAccount()?.role === 'admin';
  }

  async quickLogin(role: 'student' | 'teacher'): Promise<void> {
    const creds = role === 'teacher'
      ? { email: 'demo.teacher@nexalearn.test', password: 'Demo-JgotYvqm_vNm7OE4f-4cqPrD!' }
      : { email: 'demo.student@nexalearn.test', password: 'Demo-WIGSMNJb4p6GbF__Joa5E2Q5!' };
    try {
      this.authPending = true;
      const res = await firstValueFrom(this.auth.login(creds.email, creds.password, true));
      this.closeMobileMenu();
      this.closeAllDropdowns();
      const dest = res.data.user.role === 'teacher' ? '/instructor' : '/dashboard';
      await this.router.navigateByUrl(dest);
    } catch {
      await this.router.navigateByUrl('/auth/login');
    } finally {
      this.authPending = false;
    }
  }

  async signOut(): Promise<void> {
    if (this.signingOut) {
      return;
    }
    this.signingOut = true;
    try {
      await firstValueFrom(this.auth.logout());
      this.logoutError = '';
      this.closeMobileMenu();
      this.closeAllDropdowns();
      await this.router.navigateByUrl('/');
    } catch {
      this.logoutError = 'Sign out could not be completed. Please try again.';
    } finally {
      this.signingOut = false;
    }
  }
}
