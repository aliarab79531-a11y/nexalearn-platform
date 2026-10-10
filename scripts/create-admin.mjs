import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!connectionString || !name || !email || !password) {
  console.error('Set DATABASE_URL, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in the environment or .env file.');
  process.exitCode = 1;
} else if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
  console.error('Use a 2–80 character name, valid email, and 12–128 character password.');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nexalearn_documents (
        collection text NOT NULL,
        id char(24) NOT NULL,
        document jsonb NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS nexalearn_documents_collection_idx ON nexalearn_documents(collection);
      CREATE UNIQUE INDEX IF NOT EXISTS nexalearn_users_email_unique
        ON nexalearn_documents ((document->>'email')) WHERE collection = 'users';
      CREATE UNIQUE INDEX IF NOT EXISTS nexalearn_enrollments_student_course_unique
        ON nexalearn_documents ((document->>'studentId'), (document->>'courseId')) WHERE collection = 'enrollments';
      CREATE INDEX IF NOT EXISTS nexalearn_courses_status_created_idx
        ON nexalearn_documents ((document->>'status'), (document->>'createdAt')) WHERE collection = 'courses';
      CREATE INDEX IF NOT EXISTS nexalearn_courses_instructor_status_updated_idx
        ON nexalearn_documents ((document->>'instructorId'), (document->>'status'), (document->>'updatedAt')) WHERE collection = 'courses';
      CREATE INDEX IF NOT EXISTS nexalearn_enrollments_student_updated_idx
        ON nexalearn_documents ((document->>'studentId'), (document->>'updatedAt')) WHERE collection = 'enrollments';
      CREATE INDEX IF NOT EXISTS nexalearn_enrollments_course_status_idx
        ON nexalearn_documents ((document->>'courseId'), (document->>'status')) WHERE collection = 'enrollments';
      CREATE INDEX IF NOT EXISTS nexalearn_audit_created_idx
        ON nexalearn_documents ((document->>'createdAt')) WHERE collection = 'auditLogs';
      CREATE INDEX IF NOT EXISTS nexalearn_audit_target_created_idx
        ON nexalearn_documents ((document->>'targetType'), (document->>'targetId'), (document->>'createdAt')) WHERE collection = 'auditLogs';
    `);
    const id = randomBytes(12).toString('hex');
    const salt = randomBytes(16);
    const passwordHash = `${salt.toString('hex')}.${scryptSync(password, salt, 64).toString('hex')}`;
    const document = { _id: id, name, email, role: 'admin', status: 'active', passwordHash, createdAt: new Date().toISOString() };
    await pool.query('INSERT INTO nexalearn_documents(collection,id,document) VALUES($1,$2,$3::jsonb)', ['users', id, JSON.stringify(document)]);
    console.log(`Admin account created for ${email}.`);
  } catch (error) {
    if (error?.code === '23505') console.error('An account with this email already exists. Admin provisioning does not overwrite accounts.');
    else console.error('Admin account provisioning failed:', error?.code ?? 'database error');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
