export interface Course {
  id: string; title: string; category: string; level: string; lessons: number;
  duration: string; progress?: number; students: string; color: string; icon: string;
  description: string; instructor: string; instructorTitle: string; rating: string;
  reviews: string; price: string; callToAction: string; outcomes: string[];
  projects: string[]; tools: string[]; modules: CourseModule[];
}
export interface CourseModule {
  title: string; lessons: number; duration: string; topics: string[];
}
export interface Metric { label: string; value: string; detail: string; icon: string; tone: string; }
export interface NavItem { label: string; icon: string; route: string; }
