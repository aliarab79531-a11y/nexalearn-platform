import { afterNextRender, Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './layout/navbar.component';
import { SidebarComponent } from './layout/sidebar.component';
import { SiteFooterComponent } from './layout/site-footer.component';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, SiteFooterComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  sidebarOpen = false;
  private readonly protectedRoutes = [
    '/student',
    '/dashboard',
    '/my-courses',
    '/learning-paths',
    '/learning',
    '/ai-tutor',
    '/ai',
    '/instructor',
    '/admin',
    '/assignments',
    '/progress',
  ] as const;

  constructor() {
    afterNextRender(() => {
      void this.auth.ensureSession();
    });
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  isPublic(): boolean {
    const currentPath = this.router.url.split('?')[0].split('#')[0] || '/';
    return !this.protectedRoutes.some(
      (path) => currentPath === path || currentPath.startsWith(`${path}/`),
    );
  }
}
