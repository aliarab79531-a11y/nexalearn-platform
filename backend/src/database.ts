import dns from 'node:dns';
import { MongoClient, ObjectId, type Db as MongoDatabase } from 'mongodb';
import { ApiError } from './api-errors';

export type Document = Record<string, any>;
type Projection = Record<string, 0 | 1>;
type Filter = Record<string, any>;

interface Cursor<T> {
  sort(order: Record<string, 1 | -1>): Cursor<T>;
  skip(count: number): Cursor<T>;
  limit(count: number): Cursor<T>;
  toArray(): Promise<T[]>;
}

export interface Collection<T extends Document> {
  createIndex(keys: Record<string, 1 | -1>, options?: { unique?: boolean; name?: string }): Promise<string>;
  find(filter?: Filter, options?: { projection?: Projection }): Cursor<T>;
  findOne(filter?: Filter, options?: { projection?: Projection }): Promise<T | null>;
  insertOne(document: T): Promise<{ insertedId: ObjectId }>;
  updateOne(filter: Filter, update: Filter, options?: { upsert?: boolean }): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: ObjectId; upsertedCount: number }>;
  replaceOne(filter: Filter, replacement: T): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount: number }>;
  deleteOne(filter: Filter): Promise<{ deletedCount: number }>;
  countDocuments(filter?: Filter): Promise<number>;
  aggregate<R extends Document>(pipeline: Filter[]): Cursor<R>;
}

export interface Db { collection<T extends Document = Document>(name: string): Collection<T>; }

function matchValue(actual: any, expected: any): boolean {
  if (actual === expected) return true;
  if (actual instanceof ObjectId && expected instanceof ObjectId) {
    return actual.equals(expected);
  }
  if (actual instanceof ObjectId && typeof expected === 'string') {
    return actual.toHexString() === expected;
  }
  if (typeof actual === 'string' && expected instanceof ObjectId) {
    return actual === expected.toHexString();
  }
  if (expected && typeof expected === 'object') {
    if ('$ne' in expected) {
      return !matchValue(actual, expected.$ne);
    }
    if (expected instanceof RegExp && typeof actual === 'string') {
      return expected.test(actual);
    }
  }
  return false;
}

function matchFilter(doc: Document, filter?: Filter): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(value)) {
      if (!value.some(sub => matchFilter(doc, sub))) return false;
      continue;
    }
    if (!matchValue(doc[key], value)) return false;
  }
  return true;
}

function applyProjection<T extends Document>(doc: T, projection?: Projection): T {
  if (!projection) return { ...doc };
  const result: any = { ...doc };
  for (const [key, val] of Object.entries(projection)) {
    if (val === 0) delete result[key];
  }
  return result;
}

class InMemoryCursor<T extends Document> implements Cursor<T> {
  private _sort?: Record<string, 1 | -1>;
  private _skip = 0;
  private _limit?: number;

  constructor(private docs: T[], private projection?: Projection) {}

  sort(order: Record<string, 1 | -1>): Cursor<T> {
    this._sort = order;
    return this;
  }

  skip(count: number): Cursor<T> {
    this._skip = count;
    return this;
  }

  limit(count: number): Cursor<T> {
    this._limit = count;
    return this;
  }

  async toArray(): Promise<T[]> {
    let list = [...this.docs];
    if (this._sort) {
      list.sort((a, b) => {
        for (const [field, dir] of Object.entries(this._sort!)) {
          const valA = (a as any)[field];
          const valB = (b as any)[field];
          if (valA < valB) return dir === 1 ? -1 : 1;
          if (valA > valB) return dir === 1 ? 1 : -1;
        }
        return 0;
      });
    }
    if (this._skip > 0) {
      list = list.slice(this._skip);
    }
    if (this._limit !== undefined) {
      list = list.slice(0, this._limit);
    }
    return list.map(d => applyProjection(d, this.projection));
  }
}

class InMemoryCollection<T extends Document> implements Collection<T> {
  constructor(public store: T[]) {}

  async createIndex(): Promise<string> {
    return 'ok';
  }

  find(filter?: Filter, options?: { projection?: Projection }): Cursor<T> {
    const matched = this.store.filter(doc => matchFilter(doc, filter));
    return new InMemoryCursor<T>(matched, options?.projection);
  }

  async findOne(filter?: Filter, options?: { projection?: Projection }): Promise<T | null> {
    const found = this.store.find(doc => matchFilter(doc, filter));
    if (!found) return null;
    return applyProjection(found, options?.projection);
  }

  async insertOne(document: T): Promise<{ insertedId: ObjectId }> {
    const docAny = document as any;
    if (!docAny['_id']) {
      docAny['_id'] = new ObjectId();
    }
    this.store.push({ ...document });
    return { insertedId: docAny['_id'] };
  }

  async updateOne(filter: Filter, update: Filter, options?: { upsert?: boolean }): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: ObjectId; upsertedCount: number }> {
    const index = this.store.findIndex(doc => matchFilter(doc, filter));
    if (index >= 0) {
      const doc = this.store[index]!;
      if (update['$set']) {
        Object.assign(doc, update['$set']);
      } else {
        Object.assign(doc, update);
      }
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    if (options?.upsert) {
      const newDoc: any = { _id: new ObjectId(), ...(update['$set'] || update), ...filter };
      this.store.push(newDoc);
      return { matchedCount: 0, modifiedCount: 0, upsertedId: newDoc._id, upsertedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }

  async replaceOne(filter: Filter, replacement: T): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount: number }> {
    const index = this.store.findIndex(doc => matchFilter(doc, filter));
    if (index >= 0) {
      this.store[index] = { ...replacement, _id: (this.store[index] as any)['_id'] };
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }

  async deleteOne(filter: Filter): Promise<{ deletedCount: number }> {
    const index = this.store.findIndex(doc => matchFilter(doc, filter));
    if (index >= 0) {
      this.store.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async countDocuments(filter?: Filter): Promise<number> {
    return this.store.filter(doc => matchFilter(doc, filter)).length;
  }

  aggregate<R extends Document>(pipeline: Filter[]): Cursor<R> {
    let list: any[] = [...this.store];
    for (const stage of pipeline) {
      if (stage['$match']) {
        list = list.filter(doc => matchFilter(doc, stage['$match']));
      }
    }
    return new InMemoryCursor<R>(list);
  }
}

const teacherId = new ObjectId('670868f00000000000000001');
const studentId = new ObjectId('670868f00000000000000002');
const course1Id = new ObjectId('670868f00000000000000011');
const course2Id = new ObjectId('670868f00000000000000012');
const course3Id = new ObjectId('670868f00000000000000013');

const memoryStores = new Map<string, InMemoryCollection<any>>([
  ['users', new InMemoryCollection<any>([
    {
      _id: teacherId,
      name: 'NexaLearn Demo Teacher',
      email: 'demo.teacher@nexalearn.test',
      role: 'teacher',
      passwordHash: '965bae8e05a9ac5b3aa76eb2da9703de.e2c07be970672d2222ec40314971e2892e6a35fe28ccb8d9ae28b0bc3154704907f0a4d97131eedf59b15493843b104aca416298d1991ba293a9ceb24b0eae1b',
      status: 'active',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      _id: studentId,
      name: 'NexaLearn Demo Student',
      email: 'demo.student@nexalearn.test',
      role: 'student',
      passwordHash: 'd5d7a596a2191a78d09f3fbd604b85a8.418f766f06c72e6b95ed93507da666a638101ca4de12f659825e87fa71fbb94dbc811392b086084188bc7d77a78f8a820cb57cb2ab6e0c30a714e23ebedc208e',
      status: 'active',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
  ])],
  ['courses', new InMemoryCollection<any>([
    {
      _id: course1Id,
      title: 'JavaScript Foundations',
      description: 'Build a confident foundation in modern JavaScript, from variables and functions to practical browser projects.',
      category: 'Development',
      level: 'Beginner',
      duration: '4 weeks',
      instructorId: teacherId,
      status: 'published',
      lessonCount: 13,
      modules: [
        { title: 'JavaScript essentials', lessons: 4, duration: '1 week', topics: ['Variables and values', 'Functions and scope'] },
        { title: 'Working with the browser', lessons: 4, duration: '1 week', topics: ['DOM selection', 'Events and forms'] },
        { title: 'Build a mini project', lessons: 5, duration: '2 weeks', topics: ['Plan a feature', 'Debug and polish'] },
      ],
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
      publishedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      _id: course2Id,
      title: 'Python for Data Analysis',
      description: 'Explore data cleaning, analysis, and clear visual storytelling with a practical Python workflow.',
      category: 'Data Science',
      level: 'Intermediate',
      duration: '6 weeks',
      instructorId: teacherId,
      status: 'published',
      lessonCount: 13,
      modules: [
        { title: 'Python data toolkit', lessons: 4, duration: '2 weeks', topics: ['Data frames', 'Selecting and cleaning'] },
        { title: 'Analyze a real dataset', lessons: 5, duration: '2 weeks', topics: ['Summaries and trends', 'Handle missing values'] },
        { title: 'Share your findings', lessons: 4, duration: '2 weeks', topics: ['Charts that explain', 'Present a conclusion'] },
      ],
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
      publishedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      _id: course3Id,
      title: 'Build Responsible AI Products',
      description: 'Design useful AI features with clear evaluation, responsible data choices, and a learner-centered product plan.',
      category: 'Artificial Intelligence',
      level: 'Beginner',
      duration: '3 weeks',
      instructorId: teacherId,
      status: 'published',
      lessonCount: 10,
      modules: [
        { title: 'Frame an AI opportunity', lessons: 3, duration: '1 week', topics: ['Choose a user problem', 'Define success'] },
        { title: 'Prototype and evaluate', lessons: 4, duration: '1 week', topics: ['Build a small prototype', 'Check quality and risks'] },
        { title: 'Plan a responsible launch', lessons: 3, duration: '1 week', topics: ['Prepare a rollout', 'Measure user outcomes'] },
      ],
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
      publishedAt: new Date('2026-10-01T00:00:00Z'),
    },
  ])],
  ['enrollments', new InMemoryCollection<any>([
    {
      _id: new ObjectId('670868f00000000000000021'),
      studentId,
      courseId: course1Id,
      progress: 35,
      status: 'active',
      enrolledAt: new Date('2026-10-05T00:00:00Z'),
      updatedAt: new Date('2026-10-05T00:00:00Z'),
      lastAccessedAt: new Date('2026-10-05T00:00:00Z'),
    },
    {
      _id: new ObjectId('670868f00000000000000022'),
      studentId,
      courseId: course2Id,
      progress: 100,
      status: 'completed',
      enrolledAt: new Date('2026-10-02T00:00:00Z'),
      updatedAt: new Date('2026-10-08T00:00:00Z'),
      lastAccessedAt: new Date('2026-10-08T00:00:00Z'),
      completedAt: new Date('2026-10-08T00:00:00Z'),
    },
  ])],
  ['auditLogs', new InMemoryCollection<any>([])],
]);

const inMemoryDb: Db = {
  collection: <T extends Document>(name: string) => {
    let col = memoryStores.get(name);
    if (!col) {
      col = new InMemoryCollection<any>([]);
      memoryStores.set(name, col);
    }
    return col as unknown as Collection<T>;
  },
};

let client: MongoClient | undefined;
let database: MongoDatabase | undefined;
let connectPromise: Promise<MongoDatabase> | undefined;

async function connect(): Promise<MongoDatabase> {
  if (database) return database;
  if (!connectPromise) {
    try {
      const dnsServers = process.env['MONGO_DNS_SERVERS']
        ?.split(',')
        .map((server) => server.trim())
        .filter(Boolean);
      if (dnsServers?.length) dns.setServers(dnsServers);
    } catch {
      // dns.setServers may not be supported in some serverless environments; ignore safely
    }

    const uri = process.env['MONGO_URI'];
    if (!uri) throw new ApiError(503, 'The data service is not configured. Set MONGO_URI.', 'DATABASE_NOT_CONFIGURED');
    
    // Serverless functions have 10-15s timeouts; connect timeout default 4s
    const timeoutMs = Math.min(Number(process.env['MONGO_TIMEOUT_MS'] || 4000), 12000);
    const mongoClient = new MongoClient(uri, {
      maxPoolSize: Number(process.env['MONGO_POOL_SIZE'] || 5),
      serverSelectionTimeoutMS: timeoutMs,
      connectTimeoutMS: timeoutMs,
    });
    client = mongoClient;
    const connectWithTimeout = Promise.race([
      mongoClient.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MongoDB connection timed out')), timeoutMs)),
    ]);
    connectPromise = connectWithTimeout.then((connected) => {
      database = connected.db(process.env['MONGO_DB_NAME'] || undefined);
      return database;
    }).catch((error: unknown) => {
      connectPromise = undefined;
      client = undefined;
      throw error;
    });
  }
  return connectPromise;
}

let lastAtlasFailureTime = 0;
const ATLAS_RETRY_INTERVAL_MS = 10_000;

export async function getDatabase(): Promise<Db> {
  const uri = process.env['MONGO_URI'];
  const canAttemptAtlas = Boolean(uri && uri.trim() && (Date.now() - lastAtlasFailureTime > ATLAS_RETRY_INTERVAL_MS));

  if (canAttemptAtlas) {
    try {
      const mongo = await connect();
      return { collection: <T extends Document>(name: string) => mongo.collection(name) as unknown as Collection<T> };
    } catch (error) {
      lastAtlasFailureTime = Date.now();
      console.warn('MongoDB connection failed, gracefully falling back to in-memory store:', error instanceof Error ? error.message : 'unknown error');
      return inMemoryDb;
    }
  }
  if (!uri || !uri.trim()) {
    console.info('No MONGO_URI set; using ready-to-run demo in-memory database store.');
  }
  return inMemoryDb;
}

export async function closeDatabase(): Promise<void> {
  const current = client;
  client = undefined;
  database = undefined;
  connectPromise = undefined;
  if (current) await current.close();
}
