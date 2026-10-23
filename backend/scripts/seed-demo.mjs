import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';

if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_ENABLED !== 'true') {
  console.error('Demo seeding is disabled in production. Set DEMO_SEED_ENABLED=true only for a disposable demo database.');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('Set MONGO_URI in backend/.env before seeding demo data.');
  process.exit(1);
}

const passwordHash = (password) => {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}.${scryptSync(password, salt, 64).toString('hex')}`;
};
const credentialsPath = resolve('.demo-credentials.txt');
const credentials = [];
const client = new MongoClient(process.env.MONGO_URI, { maxPoolSize: 2 });
try {
  await client.connect();
  const db = client.db(process.env.MONGO_DB_NAME || undefined);
  const users = db.collection('users');
  const courses = db.collection('courses');
  const enrollments = db.collection('enrollments');
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' }),
    enrollments.createIndex({ studentId: 1, courseId: 1 }, { unique: true, name: 'enrollments_student_course_unique' }),
  ]);

  async function ensureUser(email, name, role) {
    const existing = await users.findOne({ email });
    if (existing) {
      if (existing.role !== role || existing.status === 'suspended') throw new Error(`Existing demo account ${email} has an unexpected role or status.`);
      return { id: existing._id, created: false };
    }
    const password = `Demo-${randomBytes(18).toString('base64url')}!`;
    const result = await users.insertOne({ name, email, role, passwordHash: passwordHash(password), status: 'active', createdAt: new Date() });
    credentials.push({ name, email, password });
    return { id: result.insertedId, created: true };
  }

  const teacher = await ensureUser('demo.teacher@nexalearn.test', 'NexaLearn Demo Teacher', 'teacher');
  const student = await ensureUser('demo.student@nexalearn.test', 'NexaLearn Demo Student', 'student');
  const courseSeeds = [
    { title: 'JavaScript Foundations', description: 'Build a confident foundation in modern JavaScript, from variables and functions to practical browser projects.', category: 'Development', level: 'Beginner', duration: '4 weeks', modules: [{ title: 'JavaScript essentials', lessons: 4, duration: '1 week', topics: ['Variables and values', 'Functions and scope'] }, { title: 'Working with the browser', lessons: 4, duration: '1 week', topics: ['DOM selection', 'Events and forms'] }, { title: 'Build a mini project', lessons: 5, duration: '2 weeks', topics: ['Plan a feature', 'Debug and polish'] }] },
    { title: 'Python for Data Analysis', description: 'Explore data cleaning, analysis, and clear visual storytelling with a practical Python workflow.', category: 'Data Science', level: 'Intermediate', duration: '6 weeks', modules: [{ title: 'Python data toolkit', lessons: 4, duration: '2 weeks', topics: ['Data frames', 'Selecting and cleaning'] }, { title: 'Analyze a real dataset', lessons: 5, duration: '2 weeks', topics: ['Summaries and trends', 'Handle missing values'] }, { title: 'Share your findings', lessons: 4, duration: '2 weeks', topics: ['Charts that explain', 'Present a conclusion'] }] },
    { title: 'Build Responsible AI Products', description: 'Design useful AI features with clear evaluation, responsible data choices, and a learner-centered product plan.', category: 'Artificial Intelligence', level: 'Beginner', duration: '3 weeks', modules: [{ title: 'Frame an AI opportunity', lessons: 3, duration: '1 week', topics: ['Choose a user problem', 'Define success'] }, { title: 'Prototype and evaluate', lessons: 4, duration: '1 week', topics: ['Build a small prototype', 'Check quality and risks'] }, { title: 'Plan a responsible launch', lessons: 3, duration: '1 week', topics: ['Prepare a rollout', 'Measure user outcomes'] }] },
  ];
  const courseDocs = [];
  for (const seed of courseSeeds) {
    let course = await courses.findOne({ title: seed.title });
    if (course && String(course.instructorId) !== String(teacher.id)) throw new Error(`Course ${seed.title} already exists under another instructor.`);
    if (!course) {
      const now = new Date();
      const result = await courses.insertOne({ ...seed, instructorId: teacher.id, status: 'published', lessonCount: seed.modules.reduce((n, module) => n + module.lessons, 0), createdAt: now, updatedAt: now, publishedAt: now });
      course = { _id: result.insertedId };
    }
    courseDocs.push(course);
  }
  let enrollmentsCreated = 0;
  for (const [index, progress] of [35, 100].entries()) {
    const course = courseDocs[index];
    const exists = await enrollments.findOne({ studentId: student.id, courseId: course._id });
    if (!exists) {
      const now = new Date();
      await enrollments.insertOne({ studentId: student.id, courseId: course._id, progress, status: progress === 100 ? 'completed' : 'active', enrolledAt: now, updatedAt: now, lastAccessedAt: now, ...(progress === 100 ? { completedAt: now } : {}) });
      enrollmentsCreated += 1;
    }
  }
  if (credentials.length) {
    const content = ['NexaLearn development demo account credentials', 'Keep this file private. Do not commit or share it.', '', ...credentials.flatMap((account) => [account.name, `Email: ${account.email}`, `Password: ${account.password}`, ''])].join('\n');
    writeFileSync(credentialsPath, `${content}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  console.log(`Demo seed complete. New accounts: ${credentials.length}; enrollments created: ${enrollmentsCreated}.`);
  if (credentials.length) console.log('New demo login credentials saved to ignored file .demo-credentials.txt.');
  else if (!existsSync(credentialsPath)) console.log('Accounts already existed; their passwords were not changed and cannot be recovered by this script.');
} catch (error) {
  console.error('Demo seeding failed:', error?.code ?? error?.message ?? 'database error');
  process.exitCode = 1;
} finally {
  await client.close();
}
