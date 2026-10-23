import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:4301';

class SessionClient {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  async request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = new Headers(options.headers || {});
    
    if (this.cookies.size > 0) {
      const cookieHeader = Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      headers.set('cookie', cookieHeader);
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof String)) {
      headers.set('content-type', 'application/json');
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, { ...options, headers });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const parts = setCookie.split(',').flatMap(s => s.split(';'));
      for (const part of parts) {
        const trimmed = part.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx);
          const val = trimmed.slice(eqIdx + 1);
          if (!['path', 'expires', 'httponly', 'samesite', 'domain', 'secure'].includes(key.toLowerCase())) {
            this.cookies.set(key, val);
          }
        }
      }
    }

    let json = null;
    const text = await response.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }

    return { status: response.status, headers: response.headers, data: json };
  }
}

async function runComprehensiveTests() {
  console.log('--- Starting Comprehensive Student & Teacher Test Suite ---');

  const student = new SessionClient('Student');
  const teacher = new SessionClient('Teacher');

  // ==========================================
  // 1. PUBLIC ENDPOINTS
  // ==========================================
  console.log('\n[1] Testing Public Endpoints...');
  const healthRes = await student.request('/api/health');
  assert.equal(healthRes.status, 200, 'Health endpoint should return 200');
  console.log('✔ Health check OK');

  const publicCoursesRes = await student.request('/api/courses');
  assert.equal(publicCoursesRes.status, 200, 'Public courses catalog should return 200');
  assert.ok(Array.isArray(publicCoursesRes.data.data), 'Courses catalog should return an array');
  console.log(`✔ Public courses returned: ${publicCoursesRes.data.data.length} courses found`);
  const sampleCourse = publicCoursesRes.data.data[0];
  assert.ok(sampleCourse, 'Should have at least one course in catalog');

  const singleCourseRes = await student.request(`/api/courses/${sampleCourse.id}`);
  assert.equal(singleCourseRes.status, 200, 'Single course detail should return 200');
  assert.equal(singleCourseRes.data.data.id, sampleCourse.id);
  console.log(`✔ Single course detail verified for: "${singleCourseRes.data.data.title}"`);

  // ==========================================
  // 2. STUDENT FLOW
  // ==========================================
  console.log('\n[2] Testing Student Flow...');
  
  // Login
  const studentLoginRes = await student.request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'demo.student@nexalearn.test',
      password: 'Demo-WIGSMNJb4p6GbF__Joa5E2Q5!',
      rememberMe: true,
    },
  });
  assert.equal(studentLoginRes.status, 200, 'Student login should succeed');
  assert.equal(studentLoginRes.data.data.user.role, 'student');
  console.log(`✔ Student logged in: ${studentLoginRes.data.data.user.name} (${studentLoginRes.data.data.user.email})`);

  // Verify auth/me
  const studentMeRes = await student.request('/api/auth/me');
  assert.equal(studentMeRes.status, 200);
  assert.equal(studentMeRes.data.data.user.role, 'student');
  console.log('✔ Student session (/api/auth/me) verified');

  // Verify Student cannot access Teacher overview (RBAC test)
  const studentTeacherCheck = await student.request('/api/teacher/overview');
  assert.equal(studentTeacherCheck.status, 403, 'Student must be forbidden (403) from teacher overview');
  console.log('✔ RBAC security: Student correctly denied access (403) to /api/teacher/overview');

  // Student enrolls in sample course
  console.log(`Attempting student enrollment in course: ${sampleCourse.id}...`);
  const enrollRes = await student.request('/api/me/enrollments', {
    method: 'POST',
    body: { courseId: sampleCourse.id },
  });
  assert.ok([200, 201].includes(enrollRes.status), `Enrollment status should be 200 or 201, got ${enrollRes.status}`);
  const enrollmentId = enrollRes.data.data.id;
  console.log(`✔ Student enrolled successfully, enrollment ID: ${enrollmentId}`);

  // List student enrollments
  const enrollmentsListRes = await student.request('/api/me/enrollments');
  assert.equal(enrollmentsListRes.status, 200);
  const foundEnrollment = enrollmentsListRes.data.data.find(e => e.id === enrollmentId);
  assert.ok(foundEnrollment, 'Newly enrolled course must appear in student enrollments');
  console.log(`✔ Student enrollment list verified, found course: "${foundEnrollment.course.title}"`);

  // Update enrollment progress
  const progressUpdateRes = await student.request(`/api/me/enrollments/${enrollmentId}/progress`, {
    method: 'PATCH',
    body: { progress: 65 },
  });
  assert.equal(progressUpdateRes.status, 200);
  assert.equal(progressUpdateRes.data.data.progress, 65);
  console.log('✔ Student enrollment progress successfully updated to 65%');

  // Check aggregate progress
  const myProgressRes = await student.request('/api/me/progress');
  assert.equal(myProgressRes.status, 200);
  assert.ok(myProgressRes.data.data.coursesEnrolled >= 1);
  console.log(`✔ Student aggregate progress: ${JSON.stringify(myProgressRes.data.data)}`);

  // ==========================================
  // 3. TEACHER FLOW
  // ==========================================
  console.log('\n[3] Testing Teacher Flow...');

  // Login
  const teacherLoginRes = await teacher.request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'demo.teacher@nexalearn.test',
      password: 'Demo-JgotYvqm_vNm7OE4f-4cqPrD!',
      rememberMe: true,
    },
  });
  assert.equal(teacherLoginRes.status, 200, 'Teacher login should succeed');
  assert.equal(teacherLoginRes.data.data.user.role, 'teacher');
  console.log(`✔ Teacher logged in: ${teacherLoginRes.data.data.user.name} (${teacherLoginRes.data.data.user.email})`);

  // Teacher Overview
  const teacherOverviewRes = await teacher.request('/api/teacher/overview');
  assert.equal(teacherOverviewRes.status, 200);
  console.log(`✔ Teacher overview telemetry: ${JSON.stringify(teacherOverviewRes.data.data)}`);

  // Teacher Courses
  const teacherCoursesRes = await teacher.request('/api/teacher/courses');
  assert.equal(teacherCoursesRes.status, 200);
  console.log(`✔ Teacher course count: ${teacherCoursesRes.data.data.length}`);

  // Teacher Creates a Course
  const newCoursePayload = {
    title: 'Test Automated Mastery Course',
    description: 'A comprehensive automated course created to test the end-to-end authoring and publishing lifecycle.',
    category: 'Development',
    level: 'Advanced',
    duration: '8 hours',
    modules: [
      {
        title: 'Module 1: Introduction to Automated Testing',
        lessons: 3,
        duration: '1h 30m',
        topics: ['Testing Principles', 'Mocking & Fixtures', 'End-to-End Validation'],
      },
    ],
  };

  const createCourseRes = await teacher.request('/api/teacher/courses', {
    method: 'POST',
    body: newCoursePayload,
  });
  assert.equal(createCourseRes.status, 201, 'Course creation should return 201');
  const createdCourseId = createCourseRes.data.data.id;
  assert.equal(createCourseRes.data.data.status, 'draft');
  console.log(`✔ Teacher created draft course "${createCourseRes.data.data.title}", ID: ${createdCourseId}`);

  // Teacher Updates Course
  const updatedCoursePayload = {
    ...newCoursePayload,
    title: 'Test Automated Mastery Course - Updated Edition',
    description: 'An updated description for the comprehensive automated course created to test lifecycle.',
  };
  const updateCourseRes = await teacher.request(`/api/teacher/courses/${createdCourseId}`, {
    method: 'PUT',
    body: updatedCoursePayload,
  });
  assert.equal(updateCourseRes.status, 200);
  assert.equal(updateCourseRes.data.data.title, updatedCoursePayload.title);
  console.log('✔ Teacher updated course details successfully');

  // Teacher Publishes Course
  const publishCourseRes = await teacher.request(`/api/teacher/courses/${createdCourseId}/status`, {
    method: 'PATCH',
    body: { status: 'published' },
  });
  assert.equal(publishCourseRes.status, 200);
  assert.equal(publishCourseRes.data.data.status, 'published');
  console.log('✔ Teacher published the course to public catalog');

  // Student checks if newly published course appears in catalog
  const studentCheckCatalog = await student.request(`/api/courses/${createdCourseId}`);
  assert.equal(studentCheckCatalog.status, 200);
  assert.equal(studentCheckCatalog.data.data.title, updatedCoursePayload.title);
  console.log('✔ Student can now see newly published course in public catalog');

  // Teacher Unpublishes Course back to draft
  const unpublishRes = await teacher.request(`/api/teacher/courses/${createdCourseId}/status`, {
    method: 'PATCH',
    body: { status: 'draft' },
  });
  assert.equal(unpublishRes.status, 200);
  assert.equal(unpublishRes.data.data.status, 'draft');
  console.log('✔ Teacher unpublished course back to draft');

  // Student cannot see draft course
  const studentCheckDraft = await student.request(`/api/courses/${createdCourseId}`);
  assert.equal(studentCheckDraft.status, 404, 'Draft course must not be visible to students (404)');
  console.log('✔ Verified: Draft course is correctly hidden (404) from students');

  // Teacher deletes the draft course
  const deleteCourseRes = await teacher.request(`/api/teacher/courses/${createdCourseId}`, {
    method: 'DELETE',
  });
  assert.equal(deleteCourseRes.status, 204, 'Deleting draft course should return 204');
  console.log('✔ Teacher successfully deleted the draft course');

  // Verify it is gone
  const verifyDeleteRes = await teacher.request(`/api/teacher/courses/${createdCourseId}`, {
    method: 'PUT',
    body: updatedCoursePayload,
  });
  assert.equal(verifyDeleteRes.status, 404);
  console.log('✔ Verified course is completely removed');

  // ==========================================
  // 4. LOGOUT & CLEANUP
  // ==========================================
  console.log('\n[4] Testing Logout...');
  const studentLogout = await student.request('/api/auth/logout', { method: 'POST' });
  assert.equal(studentLogout.status, 204, 'Student logout should return 204 No Content');
  const studentMeAfterLogout = await student.request('/api/auth/me');
  assert.equal(studentMeAfterLogout.status, 401);
  console.log('✔ Student logged out successfully (me returns 401)');

  const teacherLogout = await teacher.request('/api/auth/logout', { method: 'POST' });
  assert.equal(teacherLogout.status, 204, 'Teacher logout should return 204 No Content');
  const teacherMeAfterLogout = await teacher.request('/api/auth/me');
  assert.equal(teacherMeAfterLogout.status, 401);
  console.log('✔ Teacher logged out successfully (me returns 401)');

  console.log('\n======================================================');
  console.log('🎉 ALL BACKEND STUDENT & TEACHER API TESTS PASSED 100%!');
  console.log('======================================================');
}

runComprehensiveTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
