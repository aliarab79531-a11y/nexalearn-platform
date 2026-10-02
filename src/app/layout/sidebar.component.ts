import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../core/models';

@Component({
  selector: 'app-sidebar', standalone: true, imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  readonly items: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' }, { label: 'My Courses', icon: 'menu_book', route: '/my-courses' },
    { label: 'Explore Courses', icon: 'travel_explore', route: '/courses' }, { label: 'Learning Path', icon: 'route', route: '/learning-paths' },
    { label: 'AI Tutor', icon: 'auto_awesome', route: '/ai-tutor' }, { label: 'Quizzes', icon: 'quiz', route: '/ai/quiz-generator' },
  ];
}
