import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CourseService } from '../core/course.service';
import { SeoService } from '../core/seo.service';
import { CourseCardComponent } from '../shared/course-card.component';

@Component({
  selector: 'app-platform-page', standalone: true, imports: [RouterLink, FormsModule, CourseCardComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './platform-page.component.html',
})
export class PlatformPageComponent implements OnInit {
  readonly service = inject(CourseService);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  view = 'home'; title = ''; description = ''; query = '';
  readonly features = [{ icon: 'route', title: 'Adaptive Learning Paths', text: 'Personalized roadmaps that evolve with your goals and progress.' }, { icon: 'auto_awesome', title: 'AI-Powered Tutoring', text: 'Get unstuck faster with an intelligent learning companion.' }, { icon: 'terminal', title: 'Build Real Projects', text: 'Apply what you learn in production-style environments.' }];
  readonly modules = ['The JavaScript Foundation', 'Modern Syntax & Data Structures', 'Asynchronous JavaScript', 'Production Patterns'];
  ngOnInit(): void { this.route.data.subscribe(data => { this.view = data['view'] ?? 'home'; this.title = data['title'] ?? 'NexaLearn AI'; this.description = data['description'] ?? 'A modern learning platform powered by AI.'; this.seo.update(this.title, this.description); }); }
  filteredCourses() { const term = this.query.toLowerCase(); return this.service.courses.filter(course => `${course.title} ${course.category}`.toLowerCase().includes(term)); }
}
