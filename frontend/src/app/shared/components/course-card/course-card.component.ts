import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Course } from '../../../core/models';

@Component({
  selector: 'app-course-card', standalone: true, imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './course-card.component.html',
})
export class CourseCardComponent {
  @Input({ required: true }) course!: Course;
  @Input() continue = false;
}
