import { ObjectId } from './object-id';
import { Router, type RequestHandler } from 'express';
import { ApiError, isRecord } from './api-errors';
import { requireAccount, type AccountRole } from './auth-api';
import { getDatabase, type Collection, type Db, type Document } from './database';
import {
  parseOptionalDate,
  parsePagination,
  requireObjectId,
  requireRequestBody,
  requireString,
} from './validation';

type CourseStatus = 'draft' | 'published';
type EnrollmentStatus = 'active' | 'completed';
type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

interface CourseModuleRecord {
  title: string;
  lessons: number;
  duration: string;
  topics: string[];
}

interface CourseRecord {
  _id: ObjectId;
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  duration: string;
  instructorId: ObjectId;
  status: CourseStatus;
  modules: CourseModuleRecord[];
  lessonCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

interface EnrollmentRecord {
  _id: ObjectId;
  studentId: ObjectId;
  courseId: ObjectId;
  progress: number;
  status: EnrollmentStatus;
  enrolledAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  completedAt?: Date;
}

interface AuditRecord {
  _id: ObjectId;
  actorId: ObjectId;
  action: string;
  targetType: string;
  targetId: ObjectId;
  createdAt: Date;
  metadata?: Record<string, string>;
}

interface CourseInput {
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  duration: string;
  modules: CourseModuleRecord[];
  lessonCount: number;
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  status: 'active' | 'suspended';
  createdAt: Date;
}

const courseIndexSetup = new WeakMap<Db, Promise<void>>();

async function ensureIndexes(db: Db): Promise<void> {
  let setup = courseIndexSetup.get(db);
  if (!setup) {
    setup = Promise.all([
      db.collection<CourseRecord>('courses').createIndex(
        { status: 1, createdAt: -1 },
        { name: 'courses_status_created_at' },
      ),
      db.collection<CourseRecord>('courses').createIndex(
        { instructorId: 1, status: 1, updatedAt: -1 },
        { name: 'courses_instructor_status_updated_at' },
      ),
      db.collection<EnrollmentRecord>('enrollments').createIndex(
        { studentId: 1, courseId: 1 },
        { unique: true, name: 'enrollments_student_course_unique' },
      ),
      db.collection<EnrollmentRecord>('enrollments').createIndex(
        { studentId: 1, updatedAt: -1 },
        { name: 'enrollments_student_updated_at' },
      ),
      db.collection<EnrollmentRecord>('enrollments').createIndex(
        { courseId: 1, status: 1 },
        { name: 'enrollments_course_status' },
      ),
      db.collection<AuditRecord>('auditLogs').createIndex(
        { createdAt: -1, _id: -1 },
        { name: 'audit_created_at' },
      ),
      db.collection<AuditRecord>('auditLogs').createIndex(
        { targetType: 1, targetId: 1, createdAt: -1 },
        { name: 'audit_target_created_at' },
      ),
    ]).then(() => undefined).catch((error: unknown) => {
      courseIndexSetup.delete(db);
      console.warn('Database index creation notice (continuing safely):', error instanceof Error ? error.message : 'unknown');
    });
    courseIndexSetup.set(db, setup);
  }
  await setup;
}

async function getDomainCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDatabase();
  await ensureIndexes(db);
  return db.collection<T>(name);
}

function requireAccountId(value: unknown): ObjectId {
  if (typeof value !== 'string' || !ObjectId.isValid(value)) {
    throw new ApiError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
  }
  return new ObjectId(value);
}

function validateTopics(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30) {
    throw new ApiError(400, 'Each course module must have no more than 30 topics.', 'INVALID_COURSE');
  }
  return value.map((topic, index) => requireString(topic, `Topic ${index + 1}`, 2, 160));
}

export function validateCourseInput(value: unknown): CourseInput {
  const body = requireRequestBody(value);
  const title = requireString(body['title'], 'Title', 3, 120);
  const description = requireString(body['description'], 'Description', 20, 3000);
  const category = requireString(body['category'], 'Category', 2, 60);
  const duration = requireString(body['duration'], 'Duration', 2, 40);
  const level = body['level'];
  if (level !== 'Beginner' && level !== 'Intermediate' && level !== 'Advanced') {
    throw new ApiError(400, 'Level must be Beginner, Intermediate, or Advanced.', 'INVALID_COURSE');
  }
  if (!Array.isArray(body['modules']) || body['modules'].length < 1 || body['modules'].length > 60) {
    throw new ApiError(400, 'A course must contain between 1 and 60 modules.', 'INVALID_COURSE');
  }
  let lessonCount = 0;
  const modules = body['modules'].map((rawModule, index): CourseModuleRecord => {
    if (!isRecord(rawModule)) {
      throw new ApiError(400, `Module ${index + 1} is invalid.`, 'INVALID_COURSE');
    }
    const lessons = rawModule['lessons'];
    if (typeof lessons !== 'number' || !Number.isInteger(lessons) || lessons < 1 || lessons > 1000) {
      throw new ApiError(400, `Module ${index + 1} must have between 1 and 1000 lessons.`, 'INVALID_COURSE');
    }
    lessonCount += lessons;
    const module = {
      title: requireString(rawModule['title'], `Module ${index + 1} title`, 3, 120),
      lessons,
      duration: requireString(rawModule['duration'], `Module ${index + 1} duration`, 1, 40),
      topics: validateTopics(rawModule['topics']),
    };
    return module;
  });
  if (lessonCount > 1000) {
    throw new ApiError(400, 'A course cannot exceed 1000 lessons.', 'INVALID_COURSE');
  }
  return { title, description, category, duration, level, modules, lessonCount };
}

function safeSearchPattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function courseResponse(course: CourseRecord, instructorName: string) {
  return {
    id: course._id.toHexString(),
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    duration: course.duration,
    lessons: course.lessonCount,
    modules: course.modules,
    instructor: instructorName,
    status: course.status,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    publishedAt: course.publishedAt ?? null,
  };
}

async function getInstructorNames(courses: CourseRecord[]): Promise<Map<string, string>> {
  const ids = [...new Map(courses.map(course => [course.instructorId.toHexString(), course.instructorId])).values()];
  if (!ids.length) {
    return new Map();
  }
  const users = await getDomainCollection<{ _id: ObjectId; name: string }>('users');
  const instructors = await users.find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray();
  return new Map(instructors.map(instructor => [instructor._id.toHexString(), instructor.name]));
}

async function appendAudit(
  db: Db,
  actorId: ObjectId,
  action: string,
  targetType: string,
  targetId: ObjectId,
  metadata?: Record<string, string>,
): Promise<void> {
  await db.collection<AuditRecord>('auditLogs').insertOne({
    _id: new ObjectId(),
    actorId,
    action,
    targetType,
    targetId,
    createdAt: new Date(),
    ...(metadata ? { metadata } : {}),
  });
}

function paginationMeta(total: number, page: number, limit: number) {
  const pages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    pages,
    hasNextPage: page < pages,
    hasPreviousPage: page > 1 && pages > 0,
  };
}

function requireTargetUserStatus(value: unknown): 'active' | 'suspended' {
  if (value !== 'active' && value !== 'suspended') {
    throw new ApiError(400, 'Status must be active or suspended.', 'INVALID_STATUS');
  }
  return value;
}

function requireManagedRole(value: unknown): 'student' | 'teacher' {
  if (value !== 'student' && value !== 'teacher') {
    throw new ApiError(400, 'Managed accounts can only be students or teachers.', 'INVALID_ROLE');
  }
  return value;
}

export function createDomainRouter(): Router {
  const router = Router();
  const studentOnly = requireAccount('student');
  const teacherOnly = requireAccount('teacher');
  const adminOnly = requireAccount('admin');

  router.get('/courses', async (request, response) => {
    const { page, limit, skip } = parsePagination(request.query['page'], request.query['limit']);
    const filter: Document = { status: 'published' };
    if (typeof request.query['q'] === 'string' && request.query['q'].trim()) {
      const search = safeSearchPattern(request.query['q'].trim().slice(0, 80));
      filter['$or'] = [{ title: search }, { description: search }, { category: search }];
    }
    if (typeof request.query['category'] === 'string' && request.query['category'].length <= 60) {
      filter['category'] = request.query['category'];
    }
    if (typeof request.query['level'] === 'string') {
      if (!['Beginner', 'Intermediate', 'Advanced'].includes(request.query['level'])) {
        throw new ApiError(400, 'Level must be Beginner, Intermediate, or Advanced.', 'INVALID_LEVEL');
      }
      filter['level'] = request.query['level'];
    }
    const coursesCollection = await getDomainCollection<CourseRecord>('courses');
    const [courses, total] = await Promise.all([
      coursesCollection.find(filter)
        .sort({ publishedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      coursesCollection.countDocuments(filter),
    ]);
    const instructorNames = await getInstructorNames(courses);
    response.json({
      data: courses.map(course => courseResponse(course, instructorNames.get(course.instructorId.toHexString()) ?? 'NexaLearn Instructor')),
      meta: paginationMeta(total, page, limit),
    });
  });

  router.get('/courses/:courseId', async (request, response) => {
    const courseId = new ObjectId(requireObjectId(request.params['courseId'], 'course ID'));
    const course = await (await getDomainCollection<CourseRecord>('courses'))
      .findOne({ _id: courseId, status: 'published' });
    if (!course) {
      throw new ApiError(404, 'Course not found.', 'COURSE_NOT_FOUND');
    }
    const names = await getInstructorNames([course]);
    response.json({
      data: courseResponse(course, names.get(course.instructorId.toHexString()) ?? 'NexaLearn Instructor'),
    });
  });

  router.get('/me/enrollments', studentOnly, async (request, response) => {
    const studentId = requireAccountId(request.account?.id);
    const { page, limit, skip } = parsePagination(request.query['page'], request.query['limit']);
    const enrollments = await getDomainCollection<EnrollmentRecord>('enrollments');
    const filter = { studentId };
    const [rows, total] = await Promise.all([
      enrollments.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      enrollments.countDocuments(filter),
    ]);
    const courseIds = rows.map(row => row.courseId);
    const courses = courseIds.length
      ? await (await getDomainCollection<CourseRecord>('courses')).find({ _id: { $in: courseIds } }).toArray()
      : [];
    const courseMap = new Map<string, CourseRecord>(courses.map(course => [course._id.toHexString(), course]));
    const names = await getInstructorNames(courses);
    response.json({
      data: rows.map(enrollment => {
        const course = courseMap.get(enrollment.courseId.toHexString());
        return {
          id: enrollment._id.toHexString(),
          progress: enrollment.progress,
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          updatedAt: enrollment.updatedAt,
          lastAccessedAt: enrollment.lastAccessedAt,
          completedAt: enrollment.completedAt ?? null,
          course: course
            ? courseResponse(course, names.get(course.instructorId.toHexString()) ?? 'NexaLearn Instructor')
            : null,
        };
      }),
      meta: paginationMeta(total, page, limit),
    });
  });

  router.post('/me/enrollments', studentOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const studentId = requireAccountId(request.account?.id);
    const courseId = new ObjectId(requireObjectId(body['courseId'], 'course ID'));
    const course = await (await getDomainCollection<CourseRecord>('courses'))
      .findOne({ _id: courseId, status: 'published' }, { projection: { _id: 1 } });
    if (!course) {
      throw new ApiError(404, 'Published course not found.', 'COURSE_NOT_FOUND');
    }
    const now = new Date();
    const result = await (await getDomainCollection<EnrollmentRecord>('enrollments')).updateOne(
      { studentId, courseId },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          studentId,
          courseId,
          progress: 0,
          status: 'active',
          enrolledAt: now,
          updatedAt: now,
          lastAccessedAt: now,
        },
      },
      { upsert: true },
    );
    const enrollment = await (await getDomainCollection<EnrollmentRecord>('enrollments'))
      .findOne({ studentId, courseId });
    if (!enrollment) {
      throw new ApiError(500, 'Enrollment could not be saved.', 'ENROLLMENT_FAILED');
    }
    response.status(result.upsertedCount ? 201 : 200).json({
      data: {
        id: enrollment._id.toHexString(),
        courseId: courseId.toHexString(),
        progress: enrollment.progress,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      },
    });
  });

  router.patch('/me/enrollments/:enrollmentId/progress', studentOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const enrollmentId = new ObjectId(requireObjectId(request.params['enrollmentId'], 'enrollment ID'));
    const studentId = requireAccountId(request.account?.id);
    const progress = body['progress'];
    if (typeof progress !== 'number' || !Number.isInteger(progress) || progress < 0 || progress > 100) {
      throw new ApiError(400, 'Progress must be a whole number between 0 and 100.', 'INVALID_PROGRESS');
    }
    const now = new Date();
    const update: Document = {
      $set: {
        progress,
        status: progress === 100 ? 'completed' : 'active',
        updatedAt: now,
        lastAccessedAt: now,
        ...(progress === 100 ? { completedAt: now } : {}),
      },
    };
    if (progress < 100) {
      update['$unset'] = { completedAt: '' };
    }
    const result = await (await getDomainCollection<EnrollmentRecord>('enrollments')).updateOne(
      { _id: enrollmentId, studentId },
      update,
    );
    if (!result.matchedCount) {
      throw new ApiError(404, 'Enrollment not found.', 'ENROLLMENT_NOT_FOUND');
    }
    response.json({ data: { id: enrollmentId.toHexString(), progress, status: progress === 100 ? 'completed' : 'active' } });
  });

  router.get('/me/progress', studentOnly, async (request, response) => {
    const studentId = requireAccountId(request.account?.id);
    const enrollments = await getDomainCollection<EnrollmentRecord>('enrollments');
    const [rows] = await enrollments.aggregate<{ _id: null; enrolled: number; completed: number; averageProgress: number }>([
      { $match: { studentId } },
      {
        $group: {
          _id: null,
          enrolled: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          averageProgress: { $avg: '$progress' },
        },
      },
    ]).toArray();
    response.json({
      data: {
        coursesEnrolled: rows?.enrolled ?? 0,
        coursesCompleted: rows?.completed ?? 0,
        averageProgress: Math.round(rows?.averageProgress ?? 0),
      },
    });
  });

  router.get('/teacher/courses', teacherOnly, async (request, response) => {
    const instructorId = requireAccountId(request.account?.id);
    const { page, limit, skip } = parsePagination(request.query['page'], request.query['limit']);
    const filter = { instructorId };
    const courses = await getDomainCollection<CourseRecord>('courses');
    const [rows, total] = await Promise.all([
      courses.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      courses.countDocuments(filter),
    ]);
    response.json({
      data: rows.map(course => courseResponse(course, request.account?.name ?? 'Instructor')),
      meta: paginationMeta(total, page, limit),
    });
  });

  router.get('/teacher/overview', teacherOnly, async (request, response) => {
    const instructorId = requireAccountId(request.account?.id);
    const courses = await getDomainCollection<CourseRecord>('courses');
    const courseRows = await courses.find({ instructorId }, { projection: { _id: 1, status: 1 } }).toArray();
    const courseIds = courseRows.map(course => course._id);
    const enrollments = await getDomainCollection<EnrollmentRecord>('enrollments');
    const [enrollmentCounts] = await enrollments.aggregate<{ students: number; completed: number }>([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: null, students: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
    ]).toArray();
    response.json({
      data: {
        courses: courseRows.length,
        publishedCourses: courseRows.filter(course => course.status === 'published').length,
        draftCourses: courseRows.filter(course => course.status === 'draft').length,
        enrolledLearners: enrollmentCounts?.students ?? 0,
        completedEnrollments: enrollmentCounts?.completed ?? 0,
      },
    });
  });

  router.post('/teacher/courses', teacherOnly, async (request, response) => {
    const input = validateCourseInput(request.body);
    const now = new Date();
    const course: CourseRecord = {
      _id: new ObjectId(),
      ...input,
      instructorId: requireAccountId(request.account?.id),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await (await getDomainCollection<CourseRecord>('courses')).insertOne(course);
    response.status(201).json({ data: courseResponse(course, request.account?.name ?? 'Instructor') });
  });

  router.put('/teacher/courses/:courseId', teacherOnly, async (request, response) => {
    const input = validateCourseInput(request.body);
    const courseId = new ObjectId(requireObjectId(request.params['courseId'], 'course ID'));
    const instructorId = requireAccountId(request.account?.id);
    const existing = await (await getDomainCollection<CourseRecord>('courses'))
      .findOne({ _id: courseId, instructorId });
    if (!existing) {
      throw new ApiError(404, 'Course not found in your teaching workspace.', 'COURSE_NOT_FOUND');
    }
    const updated: CourseRecord = {
      ...existing,
      ...input,
      status: 'draft',
      updatedAt: new Date(),
      publishedAt: undefined,
    };
    await (await getDomainCollection<CourseRecord>('courses')).replaceOne(
      { _id: courseId, instructorId },
      updated,
    );
    response.json({ data: courseResponse(updated, request.account?.name ?? 'Instructor') });
  });

  router.patch('/teacher/courses/:courseId/status', teacherOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    if (body['status'] !== 'draft' && body['status'] !== 'published') {
      throw new ApiError(400, 'Status must be draft or published.', 'INVALID_STATUS');
    }
    const courseId = new ObjectId(requireObjectId(request.params['courseId'], 'course ID'));
    const instructorId = requireAccountId(request.account?.id);
    const courses = await getDomainCollection<CourseRecord>('courses');
    const course = await courses.findOne({ _id: courseId, instructorId });
    if (!course) {
      throw new ApiError(404, 'Course not found in your teaching workspace.', 'COURSE_NOT_FOUND');
    }
    if (body['status'] === 'published' && (
      course.description.length < 40
      || course.modules.length === 0
      || course.lessonCount === 0
    )) {
      throw new ApiError(400, 'Add a complete description and at least one lesson before publishing.', 'COURSE_INCOMPLETE');
    }
    const now = new Date();
    await courses.updateOne(
      { _id: courseId, instructorId },
      {
        $set: {
          status: body['status'],
          updatedAt: now,
          ...(body['status'] === 'published' ? { publishedAt: now } : {}),
        },
        ...(body['status'] === 'draft' ? { $unset: { publishedAt: '' } } : {}),
      },
    );
    response.json({ data: { id: courseId.toHexString(), status: body['status'] } });
  });

  router.delete('/teacher/courses/:courseId', teacherOnly, async (request, response) => {
    const courseId = new ObjectId(requireObjectId(request.params['courseId'], 'course ID'));
    const instructorId = requireAccountId(request.account?.id);
    const courses = await getDomainCollection<CourseRecord>('courses');
    const course = await courses.findOne(
      { _id: courseId, instructorId, status: 'draft' },
      { projection: { _id: 1 } },
    );
    if (!course) {
      const ownedCourse = await courses.findOne(
        { _id: courseId, instructorId },
        { projection: { _id: 1 } },
      );
      if (!ownedCourse) {
        throw new ApiError(404, 'Course not found in your teaching workspace.', 'COURSE_NOT_FOUND');
      }
      throw new ApiError(409, 'Only draft courses can be deleted. Unpublish the course first.', 'COURSE_MUST_BE_DRAFT');
    }
    const enrollmentCount = await (await getDomainCollection<EnrollmentRecord>('enrollments'))
      .countDocuments({ courseId });
    if (enrollmentCount) {
      throw new ApiError(409, 'Courses with learner enrollments cannot be deleted. Unpublish the course instead.', 'COURSE_HAS_ENROLLMENTS');
    }
    const result = await courses.deleteOne({ _id: courseId, instructorId, status: 'draft' });
    if (!result.deletedCount) {
      throw new ApiError(409, 'The course status changed. Refresh and try again.', 'COURSE_STATUS_CHANGED');
    }
    response.status(204).end();
  });

  router.get('/admin/overview', adminOnly, async (_request, response) => {
    const db = await getDatabase();
    const users = db.collection('users');
    const courses = await getDomainCollection<CourseRecord>('courses');
    const enrollments = await getDomainCollection<EnrollmentRecord>('enrollments');
    const [studentCount, teacherCount, adminCount, suspendedCount, publishedCourses, draftCourses, totalEnrollments] = await Promise.all([
      users.countDocuments({ role: 'student', status: { $ne: 'suspended' } }),
      users.countDocuments({ role: 'teacher', status: { $ne: 'suspended' } }),
      users.countDocuments({ role: 'admin', status: { $ne: 'suspended' } }),
      users.countDocuments({ status: 'suspended' }),
      courses.countDocuments({ status: 'published' }),
      courses.countDocuments({ status: 'draft' }),
      enrollments.countDocuments({}),
    ]);
    response.json({
      data: {
        users: { students: studentCount, teachers: teacherCount, admins: adminCount, suspended: suspendedCount },
        courses: { published: publishedCourses, drafts: draftCourses },
        enrollments: totalEnrollments,
      },
    });
  });

  router.get('/admin/users', adminOnly, async (request, response) => {
    const { page, limit, skip } = parsePagination(request.query['page'], request.query['limit']);
    const filter: Document = {};
    if (typeof request.query['role'] === 'string') {
      if (!['student', 'teacher', 'admin'].includes(request.query['role'])) {
        throw new ApiError(400, 'Role filter is invalid.', 'INVALID_ROLE');
      }
      filter['role'] = request.query['role'];
    }
    if (typeof request.query['status'] === 'string') {
      if (!['active', 'suspended'].includes(request.query['status'])) {
        throw new ApiError(400, 'Status filter is invalid.', 'INVALID_STATUS');
      }
      filter['status'] = request.query['status'];
    }
    if (typeof request.query['q'] === 'string' && request.query['q'].trim()) {
      const search = safeSearchPattern(request.query['q'].trim().slice(0, 80));
      filter['$or'] = [{ name: search }, { email: search }];
    }
    const users = await getDomainCollection<{
      _id: ObjectId;
      name: string;
      email: string;
      role: AccountRole;
      status?: 'active' | 'suspended';
      createdAt: Date;
    }>('users');
    const [rows, total] = await Promise.all([
      users.find(filter, { projection: { passwordHash: 0 } })
        .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      users.countDocuments(filter),
    ]);
    const data: ApiUser[] = rows.map(user => ({
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status ?? 'active',
      createdAt: user.createdAt,
    }));
    response.json({ data, meta: paginationMeta(total, page, limit) });
  });

  router.patch('/admin/users/:userId/status', adminOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const status = requireTargetUserStatus(body['status']);
    const targetId = new ObjectId(requireObjectId(request.params['userId'], 'user ID'));
    const actorId = requireAccountId(request.account?.id);
    const db = await getDatabase();
    const users = db.collection<{
      _id: ObjectId;
      role: AccountRole;
      status?: 'active' | 'suspended';
    }>('users');
    const target = await users.findOne({ _id: targetId }, { projection: { role: 1, status: 1 } });
    if (!target) {
      throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
    }
    if (target.role === 'admin' || targetId.equals(actorId)) {
      throw new ApiError(403, 'Administrator accounts cannot be changed here.', 'PROTECTED_ACCOUNT');
    }
    await users.updateOne({ _id: targetId }, { $set: { status } });
    await appendAudit(db, actorId, `user.${status}`, 'user', targetId);
    response.json({ data: { id: targetId.toHexString(), status } });
  });

  router.patch('/admin/users/:userId/role', adminOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const role = requireManagedRole(body['role']);
    const targetId = new ObjectId(requireObjectId(request.params['userId'], 'user ID'));
    const actorId = requireAccountId(request.account?.id);
    const db = await getDatabase();
    const users = db.collection<{ _id: ObjectId; role: AccountRole }>('users');
    const target = await users.findOne({ _id: targetId }, { projection: { role: 1 } });
    if (!target) {
      throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
    }
    if (target.role === 'admin' || targetId.equals(actorId)) {
      throw new ApiError(403, 'Administrator accounts cannot be changed here.', 'PROTECTED_ACCOUNT');
    }
    await users.updateOne({ _id: targetId }, { $set: { role } });
    await appendAudit(db, actorId, 'user.role_changed', 'user', targetId, { role });
    response.json({ data: { id: targetId.toHexString(), role } });
  });

  router.get('/admin/audit-log', adminOnly, async (request, response) => {
    const { page, limit, skip } = parsePagination(request.query['page'], request.query['limit']);
    const logs = await getDomainCollection<AuditRecord>('auditLogs');
    const [rows, total] = await Promise.all([
      logs.find({}).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      logs.countDocuments({}),
    ]);
    const actorIds = [...new Map(rows.map(row => [row.actorId.toHexString(), row.actorId])).values()];
    const users = actorIds.length
      ? await (await getDomainCollection<{ _id: ObjectId; name: string }>('users'))
        .find({ _id: { $in: actorIds } }, { projection: { name: 1 } }).toArray()
      : [];
    const names = new Map(users.map(user => [user._id.toHexString(), user.name]));
    response.json({
      data: rows.map(row => ({
        id: row._id.toHexString(),
        actor: names.get(row.actorId.toHexString()) ?? 'Deleted account',
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId.toHexString(),
        metadata: row.metadata ?? {},
        createdAt: row.createdAt,
      })),
      meta: paginationMeta(total, page, limit),
    });
  });

  return router;
}
