import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { SiteFooterComponent } from '../site-footer/site-footer.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, TopbarComponent, SiteFooterComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MainLayoutComponent {
  private readonly router = inject(Router);
  sidebarOpen = false;

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closeSidebar();
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
