import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { TranslationService } from '../core/translation.service';

@Component({
  selector: 'app-navbar', standalone: true, imports: [RouterLink, RouterLinkActive],
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

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  toggleLanguage(): void {
    this.translation.toggleLanguage();
  }

  get currentLanguageLabel(): string {
    return this.translation.currentLanguage === 'en' ? 'AR' : 'EN';
  }

  get accountHome(): string {
    const role = this.auth.currentAccount()?.role ?? 'student';
    return role === 'admin' ? '/admin' : role === 'teacher' ? '/instructor' : '/dashboard';
  }

  get accountInitials(): string {
    return (this.auth.currentAccount()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(name => name[0]?.toUpperCase() ?? '')
      .join('');
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
      await this.router.navigateByUrl('/');
    } catch {
      this.logoutError = 'Sign out could not be completed. Please try again.';
    } finally {
      this.signingOut = false;
    }
  }
}
