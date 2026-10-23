import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { rateLimit } from 'express-rate-limit';
import { ObjectId } from './object-id';
import express from 'express';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { ApiError, isRecord } from './api-errors';
import { getDatabase, type Collection } from './database';

const SESSION_COOKIE = 'nexalearn_session';
const SESSION_DURATION_SECONDS = 24 * 60 * 60;
const REMEMBERED_SESSION_DURATION_SECONDS = 7 * SESSION_DURATION_SECONDS;
const scryptAsync = promisify(scrypt);

export type AccountRole = 'student' | 'teacher' | 'admin';

export interface UserRecord {
  _id: ObjectId;
  name: string;
  email: string;
  role: AccountRole;
  passwordHash: string;
  createdAt: Date;
  status?: 'active' | 'suspended';
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
}

export interface SessionClaims {
  sub: string;
  role: AccountRole;
  exp: number;
  iss: 'nexalearn';
}

declare global {
  namespace Express {
    interface Request {
      account?: PublicUser;
    }
  }
}

let userIndexPromise: Promise<string> | undefined;

const DEFAULT_AUTH_JWT_SECRET = 'd97a205c888f082d2739023c4b642fcc829a0877a7518e7ea585895053183d21';

function getJwtSecret(): string {
  const secret = process.env['AUTH_JWT_SECRET'];
  if (secret && Buffer.byteLength(secret, 'utf8') >= 32) {
    return secret;
  }
  return DEFAULT_AUTH_JWT_SECRET;
}

export async function getUsers(): Promise<Collection<UserRecord>> {
  const collection = (await getDatabase()).collection<UserRecord>('users');
  userIndexPromise ??= collection.createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' })
    .catch((error: unknown) => {
      userIndexPromise = undefined;
      console.warn('MongoDB user index creation warning (continuing safely):', error instanceof Error ? error.message : 'unknown error');
      return 'users_email_index_fallback';
    });
  try {
    await userIndexPromise;
  } catch (error) {
    console.warn('MongoDB user index notice:', error instanceof Error ? error.message : 'unknown error');
  }
  return collection;
}

export function publicUser(user: UserRecord): PublicUser {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function requireRegistration(body: unknown): { name: string; email: string; password: string; role: 'student' | 'teacher' } {
  if (!isRecord(body)) {
    throw new ApiError(400, 'Enter your name, email, password, and account type.');
  }
  const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
  const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : '';
  const password = typeof body['password'] === 'string' ? body['password'] : '';
  if (name.length < 2 || name.length > 80) {
    throw new ApiError(400, 'Name must be between 2 and 80 characters.');
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Enter a valid email address.');
  }
  if (password.length < 12 || password.length > 128) {
    throw new ApiError(400, 'Password must be between 12 and 128 characters.');
  }
  if (body['role'] !== 'student' && body['role'] !== 'teacher') {
    throw new ApiError(400, 'Choose either a student or teacher account. Admin accounts must be provisioned by an administrator.');
  }
  return { name, email, password, role: body['role'] };
}

function decodeBase64Url(value: string): Buffer | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return undefined;
  }
  return Buffer.from(value, 'base64url');
}

function makeSession(user: PublicUser, durationSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + durationSeconds,
    iss: 'nexalearn',
  } satisfies SessionClaims)).toString('base64url');
  const content = `${header}.${payload}`;
  const signature = createHmac('sha256', getJwtSecret()).update(content).digest('base64url');
  return `${content}.${signature}`;
}

export function readSession(token: string | undefined): SessionClaims | undefined {
  if (!token) {
    return undefined;
  }
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return undefined;
  }
  const actualSignature = decodeBase64Url(parts[2]);
  if (!actualSignature) {
    return undefined;
  }
  const expectedSignature = createHmac('sha256', getJwtSecret())
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return undefined;
  }
  const payload = decodeBase64Url(parts[1]);
  if (!payload) {
    return undefined;
  }
  let claims: unknown;
  try {
    claims = JSON.parse(payload.toString('utf8'));
  } catch {
    return undefined;
  }
  if (!isRecord(claims)
    || typeof claims['sub'] !== 'string'
    || typeof claims['exp'] !== 'number'
    || claims['exp'] <= Math.floor(Date.now() / 1000)
    || claims['iss'] !== 'nexalearn'
    || (claims['role'] !== 'student' && claims['role'] !== 'teacher' && claims['role'] !== 'admin')) {
    return undefined;
  }
  return {
    sub: claims['sub'],
    role: claims['role'],
    exp: claims['exp'],
    iss: 'nexalearn',
  };
}

export function sessionToken(request: Request): string | undefined {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  const pair = cookieHeader.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${SESSION_COOKIE}=`));
  return pair?.slice(SESSION_COOKIE.length + 1);
}

export function requireAccount(...roles: AccountRole[]): RequestHandler {
  return (request, _response, next) => {
    const session = async () => {
      const claims = readSession(sessionToken(request));
      if (!claims || !ObjectId.isValid(claims.sub)) {
        throw new ApiError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
      }
      const user = await (await getUsers()).findOne({ _id: new ObjectId(claims.sub) });
      if (!user || user.role !== claims.role || user.status === 'suspended') {
        throw new ApiError(401, 'This account is unavailable. Sign in again or contact support.', 'ACCOUNT_UNAVAILABLE');
      }
      const account = publicUser(user);
      if (roles.length && !roles.includes(account.role)) {
        throw new ApiError(403, 'You do not have permission to access this resource.', 'FORBIDDEN');
      }
      request.account = account;
    };
    void session().then(() => next()).catch(next);
  };
}

function setSessionCookie(response: Response, token: string, durationSeconds: number): void {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure; SameSite=None; Partitioned' : '; SameSite=Lax';
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Max-Age=${durationSeconds}${secure}`,
  );
}

function clearSessionCookie(response: Response): void {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure; SameSite=None; Partitioned' : '; SameSite=Lax';
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0${secure}`,
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt.toString('hex')}.${key.toString('hex')}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [saltHex, keyHex] = passwordHash.split('.');
  if (!saltHex || !keyHex || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(keyHex)) {
    return false;
  }
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export function createAuthRouter(): Router {
  const router = Router();

  router.get('/health/live', (_request, response) => {
    response.json({ data: { status: 'live' } });
  });
  router.get('/health', async (_request, response) => {
    await getDatabase();
    getJwtSecret();
    response.json({ data: { status: 'ready' } });
  });

  router.post('/auth/register', authRateLimit, async (request, response) => {
    const { name, email, password, role } = requireRegistration(request.body);
    getJwtSecret();
    const users = await getUsers();
    const passwordHash = await hashPassword(password);
    try {
      const result = await users.insertOne({
        _id: new ObjectId(),
        name,
        email,
        role,
        passwordHash,
        status: 'active',
        createdAt: new Date(),
      });
      const account: UserRecord = {
        _id: result.insertedId,
        name,
        email,
        role,
        passwordHash,
        status: 'active',
        createdAt: new Date(),
      };
      const user = publicUser(account);
      setSessionCookie(response, makeSession(user, REMEMBERED_SESSION_DURATION_SECONDS), REMEMBERED_SESSION_DURATION_SECONDS);
      response.status(201).json({ user });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error
        && (error.code === 11000 || error.code === '23505')) {
        throw new ApiError(409, 'An account with this email address already exists.');
      }
      throw error;
    }
  });

  router.post('/auth/login', authRateLimit, async (request, response) => {
    const body: unknown = request.body;
    const email = isRecord(body) && typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : '';
    const password = isRecord(body) && typeof body['password'] === 'string' ? body['password'] : '';
    const remember = isRecord(body) && body['remember'] === true;
    if (!email || !password || email.length > 254 || password.length > 128) {
      throw new ApiError(401, 'Email or password is incorrect.');
    }
    getJwtSecret();
    const user = await (await getUsers()).findOne({ email });
    const validPassword = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, `${'00'.repeat(16)}.${'00'.repeat(64)}`);
    if (!user || !validPassword || user.status === 'suspended') {
      throw new ApiError(401, 'Email or password is incorrect.');
    }
    const account = publicUser(user);
    const durationSeconds = remember ? REMEMBERED_SESSION_DURATION_SECONDS : SESSION_DURATION_SECONDS;
    setSessionCookie(response, makeSession(account, durationSeconds), durationSeconds);
    response.json({ user: account });
  });

  router.get('/auth/me', async (request, response) => {
    getJwtSecret();
    const claims = readSession(sessionToken(request));
    if (!claims) {
      throw new ApiError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
    }
    if (!ObjectId.isValid(claims.sub)) {
      throw new ApiError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
    }
    const user = await (await getUsers()).findOne({ _id: new ObjectId(claims.sub) });
    if (!user || user.role !== claims.role || user.status === 'suspended') {
      throw new ApiError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
    }
    response.json({ user: publicUser(user) });
  });

  router.post('/auth/logout', (_request, response) => {
    clearSessionCookie(response);
    response.status(204).end();
  });

  return router;
}
