import { afterNextRender, Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MainLayoutComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    afterNextRender(() => {
      void this.auth.ensureSession();
    });
  }

  isPublic(): boolean {
    const currentPath = this.router.url.split('?')[0].split('#')[0] || '/';
    const protectedRoutes = [
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
    ];
    return !protectedRoutes.some(path => currentPath === path || currentPath.startsWith(`${path}/`));
  }

}
