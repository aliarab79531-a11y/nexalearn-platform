import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { AccountRole } from './auth.service';

export interface ApiPage<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiCourseModule {
  title: string;
  lessons: number;
  duration: string;
  topics: string[];
}

export interface ApiCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  lessons: number;
  modules: ApiCourseModule[];
  instructor: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ApiEnrollment {
  id: string;
  progress: number;
  status: 'active' | 'completed';
  enrolledAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  completedAt: string | null;
  course: ApiCourse | null;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface ApiCourseInput {
  title: string;
  description: string;
  category: string;
  level: ApiCourse['level'];
  duration: string;
  modules: ApiCourseModule[];
}

@Injectable({ providedIn: 'root' })
export class LearningApiService {
  private readonly http = inject(HttpClient);

  listCourses(options: { page?: number; limit?: number; query?: string; category?: string; level?: string } = {}): Observable<ApiPage<ApiCourse>> {
    let params = new HttpParams();
    if (options.page !== undefined) params = params.set('page', options.page);
    if (options.limit !== undefined) params = params.set('limit', options.limit);
    if (options.query) params = params.set('q', options.query);
    if (options.category) params = params.set('category', options.category);
    if (options.level) params = params.set('level', options.level);
    return this.http.get<ApiPage<ApiCourse>>('/api/courses', { params });
  }

  getCourse(courseId: string): Observable<{ data: ApiCourse }> {
    return this.http.get<{ data: ApiCourse }>(`/api/courses/${encodeURIComponent(courseId)}`);
  }

  listEnrollments(page = 1, limit = 20): Observable<ApiPage<ApiEnrollment>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ApiPage<ApiEnrollment>>('/api/me/enrollments', { params, withCredentials: true });
  }

  enroll(courseId: string): Observable<{ data: Pick<ApiEnrollment, 'id' | 'progress' | 'status' | 'enrolledAt'> & { courseId: string } }> {
    return this.http.post<{ data: Pick<ApiEnrollment, 'id' | 'progress' | 'status' | 'enrolledAt'> & { courseId: string } }>(
      '/api/me/enrollments',
      { courseId },
      { withCredentials: true },
    );
  }

  updateProgress(enrollmentId: string, progress: number): Observable<{ data: { id: string; progress: number; status: ApiEnrollment['status'] } }> {
    return this.http.patch<{ data: { id: string; progress: number; status: ApiEnrollment['status'] } }>(
      `/api/me/enrollments/${encodeURIComponent(enrollmentId)}/progress`,
      { progress },
      { withCredentials: true },
    );
  }

  studentProgress(): Observable<{ data: { coursesEnrolled: number; coursesCompleted: number; averageProgress: number } }> {
    return this.http.get<{ data: { coursesEnrolled: number; coursesCompleted: number; averageProgress: number } }>(
      '/api/me/progress',
      { withCredentials: true },
    );
  }

  teacherCourses(page = 1, limit = 20): Observable<ApiPage<ApiCourse>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ApiPage<ApiCourse>>('/api/teacher/courses', { params, withCredentials: true });
  }

  teacherOverview(): Observable<{ data: { courses: number; publishedCourses: number; draftCourses: number; enrolledLearners: number; completedEnrollments: number } }> {
    return this.http.get<{ data: { courses: number; publishedCourses: number; draftCourses: number; enrolledLearners: number; completedEnrollments: number } }>(
      '/api/teacher/overview',
      { withCredentials: true },
    );
  }

  createCourse(input: ApiCourseInput): Observable<{ data: ApiCourse }> {
    return this.http.post<{ data: ApiCourse }>('/api/teacher/courses', input, { withCredentials: true });
  }

  updateCourse(courseId: string, input: ApiCourseInput): Observable<{ data: ApiCourse }> {
    return this.http.put<{ data: ApiCourse }>(
      `/api/teacher/courses/${encodeURIComponent(courseId)}`,
      input,
      { withCredentials: true },
    );
  }

  setCourseStatus(courseId: string, status: ApiCourse['status']): Observable<{ data: { id: string; status: ApiCourse['status'] } }> {
    return this.http.patch<{ data: { id: string; status: ApiCourse['status'] } }>(
      `/api/teacher/courses/${encodeURIComponent(courseId)}/status`,
      { status },
      { withCredentials: true },
    );
  }

  deleteCourse(courseId: string): Observable<void> {
    return this.http.delete<void>(`/api/teacher/courses/${encodeURIComponent(courseId)}`, { withCredentials: true });
  }

  adminOverview(): Observable<{ data: { users: { students: number; teachers: number; admins: number; suspended: number }; courses: { published: number; drafts: number }; enrollments: number } }> {
    return this.http.get<{ data: { users: { students: number; teachers: number; admins: number; suspended: number }; courses: { published: number; drafts: number }; enrollments: number } }>(
      '/api/admin/overview',
      { withCredentials: true },
    );
  }

  adminUsers(options: { page?: number; limit?: number; role?: AccountRole; status?: ManagedUser['status']; query?: string } = {}): Observable<ApiPage<ManagedUser>> {
    let params = new HttpParams();
    if (options.page !== undefined) params = params.set('page', options.page);
    if (options.limit !== undefined) params = params.set('limit', options.limit);
    if (options.role) params = params.set('role', options.role);
    if (options.status) params = params.set('status', options.status);
    if (options.query) params = params.set('q', options.query);
    return this.http.get<ApiPage<ManagedUser>>('/api/admin/users', { params, withCredentials: true });
  }

  setUserStatus(userId: string, status: ManagedUser['status']): Observable<{ data: { id: string; status: ManagedUser['status'] } }> {
    return this.http.patch<{ data: { id: string; status: ManagedUser['status'] } }>(
      `/api/admin/users/${encodeURIComponent(userId)}/status`,
      { status },
      { withCredentials: true },
    );
  }

  setUserRole(userId: string, role: Exclude<AccountRole, 'admin'>): Observable<{ data: { id: string; role: Exclude<AccountRole, 'admin'> } }> {
    return this.http.patch<{ data: { id: string; role: Exclude<AccountRole, 'admin'> } }>(
      `/api/admin/users/${encodeURIComponent(userId)}/role`,
      { role },
      { withCredentials: true },
    );
  }

  adminAuditLog(page = 1, limit = 20): Observable<ApiPage<{
    id: string;
    actor: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, string>;
    createdAt: string;
  }>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ApiPage<{
      id: string;
      actor: string;
      action: string;
      targetType: string;
      targetId: string;
      metadata: Record<string, string>;
      createdAt: string;
    }>>('/api/admin/audit-log', { params, withCredentials: true });
  }
}
