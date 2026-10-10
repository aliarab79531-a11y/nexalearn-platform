import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const credentialsPath = resolve('.demo-credentials.txt');

if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_ENABLED !== 'true') {
  console.error('Demo seeding is disabled in production. Set DEMO_SEED_ENABLED=true only for a disposable demo database.');
  process.exit(1);
}
if (!connectionString) {
  console.error('Set DATABASE_URL in .env before seeding demo data.');
  process.exit(1);
}

function passwordHash(password) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}.${scryptSync(password, salt, 64).toString('hex')}`;
}

function newId() { return randomBytes(12).toString('hex'); }
function nowIso() { return new Date().toISOString(); }

const ssl = process.env.DATABASE_SSL === 'disable'
  ? false
  : process.env.DATABASE_SSL_ROOT_CERT
    ? { ca: readFileSync(process.env.DATABASE_SSL_ROOT_CERT, 'utf8'), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
const pool = new Pool({
  connectionString,
  max: 2,
  connectionTimeoutMillis: 10_000,
  ssl,
  application_name: 'nexalearn-demo-seed',
});

const existingCredentials = existsSync(credentialsPath)
  ? readFileSync(credentialsPath, 'utf8')
  : '';
const newlyCreatedCredentials = [];

async function ensureUser(client, { email, name, role }) {
  const found = await client.query(
    "SELECT id, document FROM nexalearn_documents WHERE collection='users' AND document->>'email'=$1 LIMIT 1",
    [email],
  );
  if (found.rows[0]) {
    const user = found.rows[0].document;
    if (user.role !== role || user.status === 'suspended') {
      throw new Error(`The existing demo account ${email} has an unexpected role or status.`);
    }
    return { id: found.rows[0].id.trim(), created: false };
  }

  const password = `Demo-${randomBytes(18).toString('base64url')}!`;
  const id = newId();
  const document = {
    _id: id,
    name,
    email,
    role,
    passwordHash: passwordHash(password),
    status: 'active',
    createdAt: nowIso(),
  };
  await client.query(
    'INSERT INTO nexalearn_documents(collection,id,document) VALUES($1,$2,$3::jsonb)',
    ['users', id, JSON.stringify(document)],
  );
  newlyCreatedCredentials.push({ name, email, password });
  return { id, created: true };
}

const courses = [
  {
    key: 'javascript-foundations',
    title: 'JavaScript Foundations',
    description: 'Build a confident foundation in modern JavaScript, from variables and functions to practical browser projects.',
    category: 'Development', level: 'Beginner', duration: '4 weeks',
    modules: [
      { title: 'JavaScript essentials', lessons: 4, duration: '1 week', topics: ['Variables and values', 'Functions and scope'] },
      { title: 'Working with the browser', lessons: 4, duration: '1 week', topics: ['DOM selection', 'Events and forms'] },
      { title: 'Build a mini project', lessons: 5, duration: '2 weeks', topics: ['Plan a feature', 'Debug and polish'] },
    ],
  },
  {
    key: 'python-data-analysis',
    title: 'Python for Data Analysis',
    description: 'Explore data cleaning, analysis, and clear visual storytelling with a practical Python workflow.',
    category: 'Data Science', level: 'Intermediate', duration: '6 weeks',
    modules: [
      { title: 'Python data toolkit', lessons: 4, duration: '2 weeks', topics: ['Data frames', 'Selecting and cleaning'] },
      { title: 'Analyze a real dataset', lessons: 5, duration: '2 weeks', topics: ['Summaries and trends', 'Handle missing values'] },
      { title: 'Share your findings', lessons: 4, duration: '2 weeks', topics: ['Charts that explain', 'Present a conclusion'] },
    ],
  },
  {
    key: 'responsible-ai-products',
    title: 'Build Responsible AI Products',
    description: 'Design useful AI features with clear evaluation, responsible data choices, and a learner-centered product plan.',
    category: 'Artificial Intelligence', level: 'Beginner', duration: '3 weeks',
    modules: [
      { title: 'Frame an AI opportunity', lessons: 3, duration: '1 week', topics: ['Choose a user problem', 'Define success'] },
      { title: 'Prototype and evaluate', lessons: 4, duration: '1 week', topics: ['Build a small prototype', 'Check quality and risks'] },
      { title: 'Plan a responsible launch', lessons: 3, duration: '1 week', topics: ['Prepare a rollout', 'Measure user outcomes'] },
    ],
  },
];

async function ensureCourse(client, course, instructorId) {
  const title = course.title;
  const existing = await client.query(
    "SELECT id, document FROM nexalearn_documents WHERE collection='courses' AND document->>'title'=$1 LIMIT 1",
    [title],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].document.instructorId !== instructorId) {
      throw new Error(`A course named ${title} already exists under another instructor.`);
    }
    return { id: existing.rows[0].id.trim(), created: false };
  }

  const id = newId();
  const now = nowIso();
  const document = {
    _id: id,
    title,
    description: course.description,
    category: course.category,
    level: course.level,
    duration: course.duration,
    instructorId,
    status: 'published',
    modules: course.modules,
    lessonCount: course.modules.reduce((total, module) => total + module.lessons, 0),
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
  await client.query(
    'INSERT INTO nexalearn_documents(collection,id,document) VALUES($1,$2,$3::jsonb)',
    ['courses', id, JSON.stringify(document)],
  );
  return { id, created: true };
}

async function ensureEnrollment(client, studentId, courseId, progress) {
  const found = await client.query(
    "SELECT id FROM nexalearn_documents WHERE collection='enrollments' AND document->>'studentId'=$1 AND document->>'courseId'=$2 LIMIT 1",
    [studentId, courseId],
  );
  if (found.rows[0]) return false;
  const now = nowIso();
  const completed = progress === 100;
  const document = {
    _id: newId(), studentId, courseId, progress,
    status: completed ? 'completed' : 'active',
    enrolledAt: now, updatedAt: now, lastAccessedAt: now,
    ...(completed ? { completedAt: now } : {}),
  };
  await client.query(
    'INSERT INTO nexalearn_documents(collection,id,document) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',
    ['enrollments', document._id, JSON.stringify(document)],
  );
  return true;
}

let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query(`
    CREATE TABLE IF NOT EXISTS nexalearn_documents (
      collection text NOT NULL,
      id char(24) NOT NULL,
      document jsonb NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS nexalearn_documents_collection_idx ON nexalearn_documents(collection);
    CREATE UNIQUE INDEX IF NOT EXISTS nexalearn_users_email_unique
      ON nexalearn_documents ((document->>'email')) WHERE collection='users';
    CREATE UNIQUE INDEX IF NOT EXISTS nexalearn_enrollments_student_course_unique
      ON nexalearn_documents ((document->>'studentId'), (document->>'courseId')) WHERE collection='enrollments';
  `);

  const teacher = await ensureUser(client, {
    email: 'demo.teacher@nexalearn.test', name: 'NexaLearn Demo Teacher', role: 'teacher',
  });
  const student = await ensureUser(client, {
    email: 'demo.student@nexalearn.test', name: 'NexaLearn Demo Student', role: 'student',
  });
  const courseResults = [];
  for (const course of courses) courseResults.push(await ensureCourse(client, course, teacher.id));
  const enrollmentResults = [
    await ensureEnrollment(client, student.id, courseResults[0].id, 35),
    await ensureEnrollment(client, student.id, courseResults[1].id, 100),
  ];
  await client.query('COMMIT');

  if (newlyCreatedCredentials.length) {
    const content = [
      'NexaLearn development demo account credentials',
      'Keep this file private. Do not commit or share it.',
      '',
      ...newlyCreatedCredentials.flatMap(account => [
        `${account.name}`,
        `Email: ${account.email}`,
        `Password: ${account.password}`,
        '',
      ]),
    ].join('\n');
    writeFileSync(credentialsPath, `${content}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  const usersCreated = Number(teacher.created) + Number(student.created);
  const coursesCreated = courseResults.filter(result => result.created).length;
  const enrollmentsCreated = enrollmentResults.filter(Boolean).length;
  console.log(`Demo seed complete. New accounts: ${usersCreated}; new published courses: ${coursesCreated}; new enrollments: ${enrollmentsCreated}.`);
  if (newlyCreatedCredentials.length) console.log('New demo login credentials saved to ignored file .demo-credentials.txt.');
  else if (!existsSync(credentialsPath)) console.log('Accounts already existed; their passwords were not changed and cannot be recovered by this script.');
  console.log('Demo accounts: demo.teacher@nexalearn.test, demo.student@nexalearn.test.');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => undefined);
  console.error('Demo seeding failed:', error?.code ?? error?.message ?? 'database error');
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
