import { Injectable } from '@angular/core';
import { Course, Metric } from './models';

@Injectable({ providedIn: 'root' })
export class CourseService {
  readonly courses: Course[] = [
    { id: 'javascript-mastery', title: 'JavaScript Mastery & Modern ES6+', category: 'Development', level: 'Intermediate', lessons: 42, duration: '18h 30m', progress: 68, students: '12.4k', color: '#f7df1e', icon: 'code' },
    { id: 'python-data-science', title: 'Python for Data Science', category: 'Data Science', level: 'Beginner', lessons: 36, duration: '14h 10m', progress: 32, students: '9.8k', color: '#dbeafe', icon: 'data_object' },
    { id: 'ai-fundamentals', title: 'AI Fundamentals', category: 'Artificial Intelligence', level: 'Beginner', lessons: 28, duration: '9h 45m', progress: 0, students: '21.1k', color: '#ede9fe', icon: 'psychology' },
    { id: 'reactive-angular', title: 'Angular 20: Reactive Applications', category: 'Development', level: 'Advanced', lessons: 51, duration: '22h 20m', progress: 0, students: '7.6k', color: '#fee2e2', icon: 'layers' },
  ];
  readonly metrics: Metric[] = [
    { label: 'Learning Streak', value: '12 days', detail: '+2 from last week', icon: 'local_fire_department', tone: 'orange' },
    { label: 'Hours Learned', value: '24.5h', detail: '+18% this month', icon: 'schedule', tone: 'blue' },
    { label: 'Courses Completed', value: '08', detail: 'Top 12% of learners', icon: 'school', tone: 'purple' },
    { label: 'Average Score', value: '92%', detail: '+4% from last month', icon: 'military_tech', tone: 'teal' },
  ];
  getCourse(id: string): Course { return this.courses.find(course => course.id === id) ?? this.courses[0]; }
}
