const { Pool } = require("pg");
const ObjectId = require("../utils/objectId");

let pool;
let setupPromise;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing from environment variables. Please check your .env file."
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_SIZE || (process.env.VERCEL ? 1 : 5)),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
      application_name: "nexalearn-backend-api",
    });

    pool.on("error", (error) => {
      console.error("PostgreSQL idle client error:", error.message);
    });
  }

  return pool;
}

async function ensureSchema() {
  if (!setupPromise) {
    setupPromise = getPool().query(`
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
    `).then(() => undefined).catch((error) => {
      setupPromise = undefined;
      throw error;
    });
  }
  return setupPromise;
}

function normalize(value) {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
}

function revive(value, key = "") {
  if (Array.isArray(value)) return value.map((item) => revive(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, revive(v, k)])
    );
  }
  if (typeof value === "string" && (key === "_id" || key.endsWith("Id")) && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  if (typeof value === "string" && /(?:At|Date)$/.test(key)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

function getPath(obj, path) {
  return path.split(".").reduce((curr, p) => curr?.[p], obj);
}

function compileFilter(filter = {}, firstParam = 2) {
  const values = [];
  const add = (val) => {
    values.push(val);
    return `$${firstParam + values.length - 1}`;
  };

  const clauses = [];
  for (const [key, raw] of Object.entries(filter)) {
    if (key === "$or" || key === "$and") {
      if (!Array.isArray(raw) || !raw.length) {
        clauses.push(key === "$or" ? "FALSE" : "TRUE");
        continue;
      }
      const alternatives = raw.map((item) => {
        const nested = compileFilter(item, firstParam + values.length);
        values.push(...nested.values);
        return `(${nested.sql})`;
      });
      clauses.push(`(${alternatives.join(key === "$or" ? " OR " : " AND ")})`);
      continue;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      clauses.push("FALSE");
      continue;
    }

    const expr = `document->>'${key}'`;

    if (raw instanceof RegExp) {
      clauses.push(`${expr} ~* ${add(raw.source)}`);
      continue;
    }

    if (
      raw &&
      typeof raw === "object" &&
      !(raw instanceof Date) &&
      !(raw instanceof ObjectId) &&
      !Array.isArray(raw)
    ) {
      const ops = Object.entries(raw);
      const conditions = ops.map(([op, operand]) => {
        if (op === "$in" && Array.isArray(operand)) {
          return `${expr} = ANY(${add(operand.map((i) => String(normalize(i))))}::text[])`;
        }
        if (op === "$ne") return `${expr} IS DISTINCT FROM ${add(String(normalize(operand)))}`;
        if (op === "$eq") return `${expr} = ${add(String(normalize(operand)))}`;
        return "FALSE";
      });
      clauses.push(conditions.length ? `(${conditions.join(" AND ")})` : "TRUE");
      continue;
    }

    clauses.push(`${expr} = ${add(String(normalize(raw)))}`);
  }

  return { sql: clauses.length ? clauses.join(" AND ") : "TRUE", values };
}

function project(doc, projection) {
  if (!projection || !Object.keys(projection).length) return doc;
  const include = Object.entries(projection)
    .filter(([, v]) => v === 1)
    .map(([k]) => k);

  if (include.length) {
    const out = {};
    for (const k of include) {
      const v = getPath(doc, k);
      if (v !== undefined) out[k] = v;
    }
    if (projection["_id"] !== 0 && doc["_id"] !== undefined) {
      out["_id"] = doc["_id"];
    }
    return out;
  }

  const out = { ...doc };
  for (const [k, v] of Object.entries(projection)) {
    if (v === 0) delete out[k];
  }
  return out;
}

class PgCursor {
  constructor(load) {
    this.load = load;
    this.sortOrder = {};
    this.offset = 0;
    this.max = Number.MAX_SAFE_INTEGER;
  }

  sort(order) {
    this.sortOrder = order;
    return this;
  }

  skip(count) {
    this.offset = count;
    return this;
  }

  limit(count) {
    this.max = count;
    return this;
  }

  async toArray() {
    return this.load(this.sortOrder, this.offset, this.max);
  }
}

class PgCollection {
  constructor(collectionName, pg) {
    this.collectionName = collectionName;
    this.pg = pg;
  }

  async select(filter = {}, projection, sort = {}, skip = 0, limit = Number.MAX_SAFE_INTEGER) {
    await ensureSchema();
    const compiled = compileFilter(filter, 2);
    const values = [this.collectionName, ...compiled.values];

    const ordering = Object.entries(sort)
      .filter(([k]) => /^[a-zA-Z0-9_]+$/.test(k))
      .map(([k, dir]) => `document->>'${k}' ${dir === -1 ? "DESC" : "ASC"} NULLS LAST`);

    const orderSql = ordering.length ? ` ORDER BY ${ordering.join(", ")}` : "";
    const limitIndex = values.push(Number.isFinite(limit) ? limit : Number.MAX_SAFE_INTEGER);
    const offsetIndex = values.push(skip);

    const result = await this.pg.query(
      `SELECT document FROM nexalearn_documents WHERE collection=$1 AND (${compiled.sql})${orderSql} LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );

    return result.rows.map((row) => project(revive(row.document), projection));
  }

  find(filter = {}, options = {}) {
    return new PgCursor((sort, skip, limit) =>
      this.select(filter, options.projection, sort, skip, limit)
    );
  }

  async findOne(filter = {}, options = {}) {
    const list = await this.find(filter, options).limit(1).toArray();
    return list[0] || null;
  }

  async insertOne(document) {
    await ensureSchema();
    const id =
      document._id instanceof ObjectId
        ? document._id
        : new ObjectId(document._id ? String(document._id) : undefined);
    const normalized = { ...document, _id: id };

    await this.pg.query(
      `INSERT INTO nexalearn_documents(collection, id, document) VALUES($1, $2, $3::jsonb)`,
      [this.collectionName, id.toHexString(), JSON.stringify(normalized)]
    );

    return { insertedId: id };
  }

  async updateOne(filter, update, options = {}) {
    await ensureSchema();
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      const compiled = compileFilter(filter, 2);
      const res = await client.query(
        `SELECT id, document FROM nexalearn_documents WHERE collection=$1 AND (${compiled.sql}) ORDER BY id LIMIT 1 FOR UPDATE`,
        [this.collectionName, ...compiled.values]
      );

      const row = res.rows[0]
        ? { id: res.rows[0].id.trim(), document: revive(res.rows[0].document) }
        : undefined;

      if (row) {
        const updated = { ...row.document };
        for (const [k, v] of Object.entries(update.$set || {})) updated[k] = v;
        for (const k of Object.keys(update.$unset || {})) delete updated[k];

        await client.query(
          `UPDATE nexalearn_documents SET document=$3::jsonb WHERE collection=$1 AND id=$2`,
          [this.collectionName, row.id, JSON.stringify(updated)]
        );
        await client.query("COMMIT");
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }

      if (options.upsert) {
        const base = {};
        for (const [k, v] of Object.entries(filter)) {
          if (!k.startsWith("$") && !(v && typeof v === "object")) base[k] = v;
        }
        Object.assign(base, update.$setOnInsert || {});
        Object.assign(base, update.$set || {});
        base._id = base._id ? new ObjectId(String(base._id)) : new ObjectId();

        await client.query(
          `INSERT INTO nexalearn_documents(collection, id, document) VALUES($1, $2, $3::jsonb)`,
          [this.collectionName, base._id.toHexString(), JSON.stringify(base)]
        );
        await client.query("COMMIT");
        return { matchedCount: 0, modifiedCount: 0, upsertedId: base._id, upsertedCount: 1 };
      }

      await client.query("COMMIT");
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async replaceOne(filter, replacement) {
    await ensureSchema();
    const current = await this.findOne(filter, { projection: { _id: 1 } });
    if (!current) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    const id = current._id instanceof ObjectId ? current._id : new ObjectId(String(current._id));
    const document = { ...replacement, _id: id };

    await this.pg.query(
      `UPDATE nexalearn_documents SET document=$3::jsonb WHERE collection=$1 AND id=$2`,
      [this.collectionName, id.toHexString(), JSON.stringify(document)]
    );
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }

  async deleteOne(filter) {
    await ensureSchema();
    const row = await this.findOne(filter, { projection: { _id: 1 } });
    if (!row) return { deletedCount: 0 };
    const id = row._id instanceof ObjectId ? row._id.toHexString() : String(row._id);

    const res = await this.pg.query(
      `DELETE FROM nexalearn_documents WHERE collection=$1 AND id=$2`,
      [this.collectionName, id]
    );
    return { deletedCount: res.rowCount || 0 };
  }

  async countDocuments(filter = {}) {
    await ensureSchema();
    const compiled = compileFilter(filter, 2);
    const res = await this.pg.query(
      `SELECT count(*)::int AS count FROM nexalearn_documents WHERE collection=$1 AND (${compiled.sql})`,
      [this.collectionName, ...compiled.values]
    );
    return res.rows[0].count;
  }

  aggregate(pipeline) {
    return new PgCursor(async () => {
      let rows = await this.select({}, undefined, {}, 0, Number.MAX_SAFE_INTEGER);
      for (const stage of pipeline) {
        if (stage.$match) {
          rows = rows.filter((r) => {
            return Object.entries(stage.$match).every(([k, expected]) => {
              const actual = getPath(r, k);
              if (expected && typeof expected === "object" && "$in" in expected) {
                return (
                  Array.isArray(expected.$in) &&
                  expected.$in.some((item) => String(actual) === String(item))
                );
              }
              return String(actual) === String(expected);
            });
          });
        }
        if (stage.$group) {
          const group = stage.$group;
          const output = { _id: group._id };
          for (const [key, accumulator] of Object.entries(group)) {
            if (key === "_id" || !accumulator || typeof accumulator !== "object") continue;
            const op = Object.keys(accumulator)[0];
            const expression = accumulator[op];
            if (op === "$sum") {
              output[key] = rows.reduce((sum, r) => {
                if (typeof expression === "number") return sum + expression;
                if (expression && expression.$cond) {
                  const [cond, yes, no] = expression.$cond;
                  const [left, right] = cond.$eq || [];
                  const leftVal = left.startsWith("$") ? getPath(r, left.slice(1)) : left;
                  return sum + (leftVal === right ? yes : no);
                }
                return sum + 1;
              }, 0);
            }
            if (op === "$avg") {
              const exprKey = typeof expression === "string" && expression.startsWith("$") ? expression.slice(1) : expression;
              output[key] = rows.length
                ? rows.reduce((sum, r) => sum + Number(getPath(r, exprKey) || 0), 0) / rows.length
                : 0;
            }
          }
          rows = rows.length ? [output] : [];
        }
      }
      return rows;
    });
  }
}

async function getDatabase() {
  await ensureSchema();
  return {
    collection: (name) => new PgCollection(name, getPool()),
  };
}

async function connectDB() {
  console.log("Connecting to Supabase PostgreSQL database...");
  await ensureSchema();
  console.log("Supabase PostgreSQL connected and schema verified.");
}

module.exports = {
  getPool,
  getDatabase,
  connectDB,
  collection: (name) => new PgCollection(name, getPool()),
};