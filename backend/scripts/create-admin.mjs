import { randomBytes, scryptSync } from 'node:crypto';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!uri || !name || !email || !password) {
  console.error('Set MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in the environment or .env file.');
  process.exitCode = 1;
} else if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
  console.error('Use a 2–80 character name, valid email, and 12–128 character password.');
  process.exitCode = 1;
} else {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB_NAME || undefined);
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' });
    const salt = randomBytes(16);
    const passwordHash = `${salt.toString('hex')}.${scryptSync(password, salt, 64).toString('hex')}`;
    await users.insertOne({ name, email, role: 'admin', status: 'active', passwordHash, createdAt: new Date() });
    console.log(`Admin account created for ${email}.`);
  } catch (error) {
    if (error?.code === 11000) console.error('An account with this email already exists. Admin provisioning does not overwrite accounts.');
    else console.error('Admin account provisioning failed:', error?.code ?? 'database error');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
