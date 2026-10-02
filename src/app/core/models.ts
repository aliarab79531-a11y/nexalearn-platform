export interface Course {
  id: string; title: string; category: string; level: string; lessons: number;
  duration: string; progress?: number; students: string; color: string; icon: string;
}
export interface Metric { label: string; value: string; detail: string; icon: string; tone: string; }
export interface NavItem { label: string; icon: string; route: string; }
