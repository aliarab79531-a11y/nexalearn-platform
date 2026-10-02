import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './layout/navbar.component';
import { SidebarComponent } from './layout/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  sidebarOpen = false;
  isPublic(): boolean {
    return ![
      '/dashboard',
      '/my-courses',
      '/learning',
      '/ai-tutor',
      '/ai/',
      '/instructor',
      '/admin',
      '/assignments',
      '/progress',
    ].some((path) => this.router.url.startsWith(path));
  }
}
