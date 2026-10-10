import { readFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { ObjectId } from './object-id';
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

interface UpdateResult { matchedCount: number; modifiedCount: number; upsertedId?: ObjectId; upsertedCount: number; }
interface InsertResult { insertedId: ObjectId; }
interface DeleteResult { deletedCount: number; }

export interface Collection<T extends Document> {
  createIndex(keys: Record<string, 1 | -1>, options?: { unique?: boolean; name?: string }): Promise<string>;
  find(filter?: Filter, options?: { projection?: Projection }): Cursor<T>;
  findOne(filter?: Filter, options?: { projection?: Projection }): Promise<T | null>;
  insertOne(document: T): Promise<InsertResult>;
  updateOne(filter: Filter, update: Filter, options?: { upsert?: boolean }): Promise<UpdateResult>;
  replaceOne(filter: Filter, replacement: T): Promise<UpdateResult>;
  deleteOne(filter: Filter): Promise<DeleteResult>;
  countDocuments(filter?: Filter): Promise<number>;
  aggregate<R extends Document>(pipeline: Filter[]): Cursor<R>;
}

export interface Db { collection<T extends Document = Document>(name: string): Collection<T>; }

let pool: Pool | undefined;
let setupPromise: Promise<void> | undefined;
let db: Db | undefined;

function getPool(): Pool {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new ApiError(503, 'The data service is not configured. Set DATABASE_URL.', 'DATABASE_NOT_CONFIGURED');
  }
  if (!pool) {
    const rootCertificatePath = process.env['DATABASE_SSL_ROOT_CERT'];
    const ssl = process.env['DATABASE_SSL'] === 'disable'
      ? false
      : rootCertificatePath
        ? { ca: readFileSync(rootCertificatePath, 'utf8'), rejectUnauthorized: true }
        // Supabase pooler uses a provider certificate chain not trusted by every Node host.
        // TLS remains enabled; configure DATABASE_SSL_ROOT_CERT to enable CA verification.
        : { rejectUnauthorized: false };
    pool = new Pool({
      connectionString,
      max: Number(process.env['DATABASE_POOL_SIZE'] || (process.env['VERCEL'] ? 1 : 5)),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      ssl,
      application_name: 'nexalearn-api',
    });
    pool.on('error', (error) => console.error('PostgreSQL idle client error:', error.message));
  }
  return pool;
}

function ensureSchema(): Promise<void> {
  setupPromise ??= getPool().query(`
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
  `).then(() => undefined).catch((error: unknown) => {
    setupPromise = undefined;
    throw error;
  });
  return setupPromise;
}

function asJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function revive(value: any, key = ''): any {
  if (Array.isArray(value)) return value.map(item => revive(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, revive(child, childKey)]));
  }
  if (typeof value === 'string' && (key === '_id' || key.endsWith('Id')) && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  if (typeof value === 'string' && /(?:At|Date)$/.test(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return value;
}

function normalize(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

function getPath(value: any, path: string): any {
  return path.split('.').reduce((current, part) => current?.[part], value);
}

function compileFilter(filter: Filter = {}, firstParameter = 2): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const add = (value: unknown): string => {
    values.push(value);
    return `$${firstParameter + values.length - 1}`;
  };
  const clauses: string[] = [];
  for (const [key, raw] of Object.entries(filter)) {
    if (key === '$or' || key === '$and') {
      if (!Array.isArray(raw) || !raw.length) { clauses.push(key === '$or' ? 'FALSE' : 'TRUE'); continue; }
      const alternatives = raw.map((item: Filter) => {
        const nested = compileFilter(item, firstParameter + values.length);
        values.push(...nested.values);
        return `(${nested.sql})`;
      });
      clauses.push(`(${alternatives.join(key === '$or' ? ' OR ' : ' AND ')})`);
      continue;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(key)) { clauses.push('FALSE'); continue; }
    const expression = `document->>'${key}'`;
    if (raw instanceof RegExp) {
      clauses.push(`${expression} ~* ${add(raw.source)}`);
      continue;
    }
    if (raw && typeof raw === 'object' && !(raw instanceof Date) && !(raw instanceof ObjectId) && !Array.isArray(raw)) {
      const operators = Object.entries(raw);
      const conditions = operators.map(([operator, operand]) => {
        if (operator === '$in' && Array.isArray(operand)) return `${expression} = ANY(${add(operand.map((item: unknown) => String(normalize(item))))}::text[])`;
        if (operator === '$ne') return `${expression} IS DISTINCT FROM ${add(String(normalize(operand)))}`;
        if (operator === '$eq') return `${expression} = ${add(String(normalize(operand)))}`;
        return 'FALSE';
      });
      clauses.push(conditions.length ? `(${conditions.join(' AND ')})` : 'TRUE');
      continue;
    }
    clauses.push(`${expression} = ${add(String(normalize(raw)))}`);
  }
  return { sql: clauses.length ? clauses.join(' AND ') : 'TRUE', values };
}

function equal(a: any, b: any): boolean {
  if (a instanceof RegExp) return typeof b === 'string' && a.test(b);
  if (b instanceof RegExp) return typeof a === 'string' && b.test(a);
  a = normalize(a); b = normalize(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

function matches(document: Document, filter: Filter = {}): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return Array.isArray(expected) && expected.some((item: Filter) => matches(document, item));
    if (key === '$and') return Array.isArray(expected) && expected.every((item: Filter) => matches(document, item));
    const actual = getPath(document, key);
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !(expected instanceof ObjectId) && !(expected instanceof RegExp) && !Array.isArray(expected)) {
      return Object.entries(expected).every(([operator, operand]) => {
        if (operator === '$in') return Array.isArray(operand) && operand.some((item: unknown) => equal(actual, item));
        if (operator === '$ne') return !equal(actual, operand);
        if (operator === '$eq') return equal(actual, operand);
        return false;
      });
    }
    return equal(actual, expected);
  });
}

function project<T extends Document>(document: T, projection?: Projection): T {
  if (!projection || !Object.keys(projection).length) return document;
  const include = Object.entries(projection).filter(([, value]) => value === 1).map(([key]) => key);
  if (include.length) {
    const out: Document = {};
    for (const key of include) {
      const value = getPath(document, key);
      if (value !== undefined) out[key] = value;
    }
    if (projection['_id'] !== 0 && document['_id'] !== undefined) out['_id'] = document['_id'];
    return out as T;
  }
  const out = { ...document };
  for (const [key, value] of Object.entries(projection)) if (value === 0) delete out[key];
  return out as T;
}

function updateDocument<T extends Document>(document: T, update: Filter): T {
  const result: Document = { ...document };
  for (const [key, value] of Object.entries(update['$set'] ?? {})) result[key] = value;
  for (const key of Object.keys(update['$unset'] ?? {})) delete result[key];
  return result as T;
}

class PgCursor<T extends Document> implements Cursor<T> {
  constructor(private readonly load: (sort: Record<string, 1 | -1>, skip: number, limit: number) => Promise<T[]>) {}
  private sortOrder: Record<string, 1 | -1> = {};
  private offset = 0;
  private max = Number.MAX_SAFE_INTEGER;
  sort(order: Record<string, 1 | -1>): Cursor<T> { this.sortOrder = order; return this; }
  skip(count: number): Cursor<T> { this.offset = count; return this; }
  limit(count: number): Cursor<T> { this.max = count; return this; }
  async toArray(): Promise<T[]> {
    return this.load(this.sortOrder, this.offset, this.max);
  }
}

class PgCollection<T extends Document> implements Collection<T> {
  constructor(private readonly collectionName: string, private readonly pg: Pool) {}

  async createIndex(_keys: Record<string, 1 | -1>, options: { unique?: boolean; name?: string } = {}): Promise<string> {
    await ensureSchema();
    if (options.unique && options.name === 'users_email_unique') return 'nexalearn_users_email_unique';
    if (options.unique && options.name === 'enrollments_student_course_unique') return 'nexalearn_enrollments_student_course_unique';
    return options.name ?? 'document_collection_idx';
  }

  private async select(filter: Filter = {}, projection?: Projection, sort: Record<string, 1 | -1> = {}, skip = 0, limit = Number.MAX_SAFE_INTEGER, client: Pool | PoolClient = this.pg): Promise<T[]> {
    await ensureSchema();
    const compiled = compileFilter(filter, 2);
    const values: unknown[] = [this.collectionName, ...compiled.values];
    const ordering = Object.entries(sort).filter(([key]) => /^[a-zA-Z0-9_]+$/.test(key))
      .map(([key, direction]) => `document->>'${key}' ${direction === -1 ? 'DESC' : 'ASC'} NULLS LAST`);
    const orderSql = ordering.length ? ` ORDER BY ${ordering.join(', ')}` : '';
    const limitIndex = values.push(Number.isFinite(limit) ? limit : Number.MAX_SAFE_INTEGER);
    const offsetIndex = values.push(skip);
    const result = await client.query(
      `SELECT document FROM nexalearn_documents WHERE collection=$1 AND (${compiled.sql})${orderSql} LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );
    return result.rows.map(row => project(revive(row.document) as T, projection));
  }

  find(filter: Filter = {}, options: { projection?: Projection } = {}): Cursor<T> {
    return new PgCursor((sort, skip, limit) => this.select(filter, options.projection, sort, skip, limit));
  }

  async findOne(filter: Filter = {}, options: { projection?: Projection } = {}): Promise<T | null> {
    return (await this.find(filter, options).limit(1).toArray())[0] ?? null;
  }

  async insertOne(document: T): Promise<InsertResult> {
    await ensureSchema();
    const id = document['_id'] instanceof ObjectId ? document['_id'] : new ObjectId(String(document['_id']));
    const normalized = { ...document, _id: id };
    await this.pg.query('INSERT INTO nexalearn_documents(collection, id, document) VALUES($1, $2, $3::jsonb)', [this.collectionName, id.toHexString(), JSON.stringify(normalized)]);
    return { insertedId: id };
  }

  async updateOne(filter: Filter, update: Filter, options: { upsert?: boolean } = {}): Promise<UpdateResult> {
    await ensureSchema();
    const client: PoolClient = await this.pg.connect();
    try {
      await client.query('BEGIN');
      const compiled = compileFilter(filter, 2);
      const result = await client.query(
        `SELECT id, document FROM nexalearn_documents WHERE collection=$1 AND (${compiled.sql}) ORDER BY id LIMIT 1 FOR UPDATE`,
        [this.collectionName, ...compiled.values],
      );
      const row = result.rows[0] ? { id: result.rows[0].id.trim(), document: revive(result.rows[0].document) as T } : undefined;
      if (row) {
        const updated = updateDocument(row.document, update);
        await client.query('UPDATE nexalearn_documents SET document=$3::jsonb WHERE collection=$1 AND id=$2', [this.collectionName, row.id, JSON.stringify(updated)]);
        await client.query('COMMIT');
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }
      if (options.upsert) {
        const base: Document = {};
        for (const [key, value] of Object.entries(filter)) if (!key.startsWith('$') && !(value && typeof value === 'object' && Object.keys(value).some(k => k.startsWith('$')))) base[key] = value;
        Object.assign(base, update['$setOnInsert'] ?? {});
        Object.assign(base, update['$set'] ?? {});
        base['_id'] ??= new ObjectId();
        const id = base['_id'] instanceof ObjectId ? base['_id'] : new ObjectId(String(base['_id']));
        base['_id'] = id;
        await client.query('INSERT INTO nexalearn_documents(collection,id,document) VALUES($1,$2,$3::jsonb)', [this.collectionName, id.toHexString(), JSON.stringify(base)]);
        await client.query('COMMIT');
        return { matchedCount: 0, modifiedCount: 0, upsertedId: id, upsertedCount: 1 };
      }
      await client.query('COMMIT');
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async replaceOne(filter: Filter, replacement: T): Promise<UpdateResult> {
    await ensureSchema();
    const current = await this.findOne(filter, { projection: { _id: 1 } });
    if (!current) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    const id = current['_id'] instanceof ObjectId ? current['_id'] : new ObjectId(String(current['_id']));
    const document = { ...replacement, _id: id };
    await this.pg.query('UPDATE nexalearn_documents SET document=$3::jsonb WHERE collection=$1 AND id=$2', [this.collectionName, id.toHexString(), JSON.stringify(document)]);
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }

  async deleteOne(filter: Filter): Promise<DeleteResult> {
    await ensureSchema();
    const row = await this.findOne(filter, { projection: { _id: 1 } });
    if (!row) return { deletedCount: 0 };
    const id = row['_id'] instanceof ObjectId ? row['_id'].toHexString() : String(row['_id']);
    const result = await this.pg.query('DELETE FROM nexalearn_documents WHERE collection=$1 AND id=$2', [this.collectionName, id]);
    return { deletedCount: result.rowCount ?? 0 };
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    await ensureSchema();
    const compiled = compileFilter(filter, 2);
    const result = await this.pg.query(`SELECT count(*)::int AS count FROM nexalearn_documents WHERE collection=$1 AND (${compiled.sql})`, [this.collectionName, ...compiled.values]);
    return result.rows[0].count;
  }

  aggregate<R extends Document>(pipeline: Filter[]): Cursor<R> {
    return new PgCursor(async (_sort, _skip, _limit) => {
      let rows: any[] = await this.select({}, undefined, {}, 0, Number.MAX_SAFE_INTEGER);
      for (const stage of pipeline) {
        if (stage['$match']) rows = rows.filter(row => matches(row, stage['$match']));
        if (stage['$group']) {
          const group = stage['$group'];
          const output: Document = { _id: group['_id'] };
          for (const [key, accumulator] of Object.entries(group)) {
            if (key === '_id' || !accumulator || typeof accumulator !== 'object') continue;
            const op = Object.keys(accumulator as object)[0]; const expression = (accumulator as any)[op];
            if (op === '$sum') output[key] = rows.reduce((sum, row) => sum + Number(resolveExpression(expression, row)), 0);
            if (op === '$avg') output[key] = rows.length ? rows.reduce((sum, row) => sum + Number(resolveExpression(expression, row)), 0) / rows.length : null;
          }
          rows = rows.length ? [output] : [];
        }
      }
      return rows as R[];
    });
  }
}

function resolveExpression(expression: any, row: Document): any {
  if (Array.isArray(expression)) return expression.map(item => resolveExpression(item, row));
  if (typeof expression === 'string' && expression.startsWith('$')) return getPath(row, expression.slice(1));
  if (expression && typeof expression === 'object' && '$cond' in expression) {
    const [condition, yes, no] = expression['$cond'];
    const [left, right] = condition['$eq'];
    return equal(resolveExpression(left, row), resolveExpression(right, row)) ? resolveExpression(yes, row) : resolveExpression(no, row);
  }
  return expression;
}

export async function getDatabase(): Promise<Db> {
  try {
    await ensureSchema();
    db ??= { collection: <T extends Document>(name: string) => new PgCollection<T>(name, getPool()) };
    return db;
  } catch (error) {
    console.error('PostgreSQL connection or schema initialization failed:', error instanceof Error ? error.message : 'unknown error');
    throw new ApiError(503, 'The data service could not be reached. Check Supabase connectivity and try again.', 'DATABASE_UNAVAILABLE');
  }
}

export async function closeDatabase(): Promise<void> {
  const current = pool;
  pool = undefined;
  db = undefined;
  setupPromise = undefined;
  if (current) await current.end();
}
