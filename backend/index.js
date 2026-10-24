// backend/src/app.ts
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";

// backend/src/api-errors.ts
var ApiError = class extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var apiErrorHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message }
    });
    return;
  }
  if (isRecord(error) && (error["code"] === 11e3 || error["code"] === "23505")) {
    response.status(409).json({
      error: { code: "ALREADY_EXISTS", message: "A record with these details already exists." }
    });
    return;
  }
  if (isRecord(error) && typeof error["code"] === "string" && (/^(08|23|28|3D)/.test(error["code"]) || /^(ECONN|ETIMEDOUT|EAI_AGAIN)/.test(error["code"]))) {
    console.error("MongoDB API request failed:", error["code"]);
    response.status(503).json({
      error: { code: "DATABASE_UNAVAILABLE", message: "The data service is temporarily unavailable." }
    });
    return;
  }
  if (isRecord(error) && typeof error["status"] === "number" && error["status"] >= 400 && error["status"] < 500) {
    const tooLarge = error["status"] === 413;
    response.status(error["status"]).json({
      error: {
        code: tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
        message: tooLarge ? "Request body is too large." : "The request body is invalid."
      }
    });
    return;
  }
  console.error("Unhandled API request error:", error);
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "The request could not be completed." }
  });
};

// backend/src/auth-api.ts
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { rateLimit } from "express-rate-limit";

// backend/src/object-id.ts
import { ObjectId } from "mongodb";

// backend/src/auth-api.ts
import { Router } from "express";

// backend/src/database.ts
import dns from "node:dns";
import { MongoClient, ObjectId as ObjectId2 } from "mongodb";
function matchValue(actual, expected) {
  if (actual === expected) return true;
  if (actual instanceof ObjectId2 && expected instanceof ObjectId2) {
    return actual.equals(expected);
  }
  if (actual instanceof ObjectId2 && typeof expected === "string") {
    return actual.toHexString() === expected;
  }
  if (typeof actual === "string" && expected instanceof ObjectId2) {
    return actual === expected.toHexString();
  }
  if (expected && typeof expected === "object") {
    if ("$ne" in expected) {
      return !matchValue(actual, expected.$ne);
    }
    if (expected instanceof RegExp && typeof actual === "string") {
      return expected.test(actual);
    }
  }
  return false;
}
function matchFilter(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(value)) {
      if (!value.some((sub) => matchFilter(doc, sub))) return false;
      continue;
    }
    if (!matchValue(doc[key], value)) return false;
  }
  return true;
}
function applyProjection(doc, projection) {
  if (!projection) return { ...doc };
  const result = { ...doc };
  for (const [key, val] of Object.entries(projection)) {
    if (val === 0) delete result[key];
  }
  return result;
}
var InMemoryCursor = class {
  constructor(docs, projection) {
    this.docs = docs;
    this.projection = projection;
  }
  docs;
  projection;
  _sort;
  _skip = 0;
  _limit;
  sort(order) {
    this._sort = order;
    return this;
  }
  skip(count) {
    this._skip = count;
    return this;
  }
  limit(count) {
    this._limit = count;
    return this;
  }
  async toArray() {
    let list = [...this.docs];
    if (this._sort) {
      list.sort((a, b) => {
        for (const [field, dir] of Object.entries(this._sort)) {
          const valA = a[field];
          const valB = b[field];
          if (valA < valB) return dir === 1 ? -1 : 1;
          if (valA > valB) return dir === 1 ? 1 : -1;
        }
        return 0;
      });
    }
    if (this._skip > 0) {
      list = list.slice(this._skip);
    }
    if (this._limit !== void 0) {
      list = list.slice(0, this._limit);
    }
    return list.map((d) => applyProjection(d, this.projection));
  }
};
var InMemoryCollection = class {
  constructor(store) {
    this.store = store;
  }
  store;
  async createIndex() {
    return "ok";
  }
  find(filter, options) {
    const matched = this.store.filter((doc) => matchFilter(doc, filter));
    return new InMemoryCursor(matched, options?.projection);
  }
  async findOne(filter, options) {
    const found = this.store.find((doc) => matchFilter(doc, filter));
    if (!found) return null;
    return applyProjection(found, options?.projection);
  }
  async insertOne(document) {
    const docAny = document;
    if (!docAny["_id"]) {
      docAny["_id"] = new ObjectId2();
    }
    this.store.push({ ...document });
    return { insertedId: docAny["_id"] };
  }
  async updateOne(filter, update, options) {
    const index = this.store.findIndex((doc) => matchFilter(doc, filter));
    if (index >= 0) {
      const doc = this.store[index];
      if (update["$set"]) {
        Object.assign(doc, update["$set"]);
      } else {
        Object.assign(doc, update);
      }
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    if (options?.upsert) {
      const newDoc = { _id: new ObjectId2(), ...update["$set"] || update, ...filter };
      this.store.push(newDoc);
      return { matchedCount: 0, modifiedCount: 0, upsertedId: newDoc._id, upsertedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }
  async replaceOne(filter, replacement) {
    const index = this.store.findIndex((doc) => matchFilter(doc, filter));
    if (index >= 0) {
      this.store[index] = { ...replacement, _id: this.store[index]["_id"] };
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }
  async deleteOne(filter) {
    const index = this.store.findIndex((doc) => matchFilter(doc, filter));
    if (index >= 0) {
      this.store.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
  async countDocuments(filter) {
    return this.store.filter((doc) => matchFilter(doc, filter)).length;
  }
  aggregate(pipeline) {
    let list = [...this.store];
    for (const stage of pipeline) {
      if (stage["$match"]) {
        list = list.filter((doc) => matchFilter(doc, stage["$match"]));
      }
    }
    return new InMemoryCursor(list);
  }
};
var teacherId = new ObjectId2("670868f00000000000000001");
var studentId = new ObjectId2("670868f00000000000000002");
var course1Id = new ObjectId2("670868f00000000000000011");
var course2Id = new ObjectId2("670868f00000000000000012");
var course3Id = new ObjectId2("670868f00000000000000013");
var memoryStores = /* @__PURE__ */ new Map([
  ["users", new InMemoryCollection([
    {
      _id: teacherId,
      name: "NexaLearn Demo Teacher",
      email: "demo.teacher@nexalearn.test",
      role: "teacher",
      passwordHash: "965bae8e05a9ac5b3aa76eb2da9703de.e2c07be970672d2222ec40314971e2892e6a35fe28ccb8d9ae28b0bc3154704907f0a4d97131eedf59b15493843b104aca416298d1991ba293a9ceb24b0eae1b",
      status: "active",
      createdAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z")
    },
    {
      _id: studentId,
      name: "NexaLearn Demo Student",
      email: "demo.student@nexalearn.test",
      role: "student",
      passwordHash: "d5d7a596a2191a78d09f3fbd604b85a8.418f766f06c72e6b95ed93507da666a638101ca4de12f659825e87fa71fbb94dbc811392b086084188bc7d77a78f8a820cb57cb2ab6e0c30a714e23ebedc208e",
      status: "active",
      createdAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z")
    }
  ])],
  ["courses", new InMemoryCollection([
    {
      _id: course1Id,
      title: "JavaScript Foundations",
      description: "Build a confident foundation in modern JavaScript, from variables and functions to practical browser projects.",
      category: "Development",
      level: "Beginner",
      duration: "4 weeks",
      instructorId: teacherId,
      status: "published",
      lessonCount: 13,
      modules: [
        { title: "JavaScript essentials", lessons: 4, duration: "1 week", topics: ["Variables and values", "Functions and scope"] },
        { title: "Working with the browser", lessons: 4, duration: "1 week", topics: ["DOM selection", "Events and forms"] },
        { title: "Build a mini project", lessons: 5, duration: "2 weeks", topics: ["Plan a feature", "Debug and polish"] }
      ],
      createdAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z"),
      updatedAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z"),
      publishedAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z")
    },
    {
      _id: course2Id,
      title: "Python for Data Analysis",
      description: "Explore data cleaning, analysis, and clear visual storytelling with a practical Python workflow.",
      category: "Data Science",
      level: "Intermediate",
      duration: "6 weeks",
      instructorId: teacherId,
      status: "published",
      lessonCount: 13,
      modules: [
        { title: "Python data toolkit", lessons: 4, duration: "2 weeks", topics: ["Data frames", "Selecting and cleaning"] },
        { title: "Analyze a real dataset", lessons: 5, duration: "2 weeks", topics: ["Summaries and trends", "Handle missing values"] },
        { title: "Share your findings", lessons: 4, duration: "2 weeks", topics: ["Charts that explain", "Present a conclusion"] }
      ],
      createdAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z"),
      updatedAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z"),
      publishedAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z")
    },
    {
      _id: course3Id,
      title: "Build Responsible AI Products",
      description: "Design useful AI features with clear evaluation, responsible data choices, and a learner-centered product plan.",
      category: "Artificial Intelligence",
      level: "Beginner",
      duration: "3 weeks",
      instructorId: teacherId,
      status: "published",
      lessonCount: 10,
      modules: [
        { title: "Frame an AI opportunity", lessons: 3, duration: "1 week", topics: ["Choose a user problem", "Define success"] },
        { title: "Prototype and evaluate", lessons: 4, duration: "1 week", topics: ["Build a small prototype", "Check quality and risks"] },
        { title: "Plan a responsible launch", lessons: 3, duration: "1 week", topics: ["Prepare a rollout", "Measure user outcomes"] }
      ],
      createdAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z"),
      updatedAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z"),
      publishedAt: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z")
    }
  ])],
  ["enrollments", new InMemoryCollection([
    {
      _id: new ObjectId2("670868f00000000000000021"),
      studentId,
      courseId: course1Id,
      progress: 35,
      status: "active",
      enrolledAt: /* @__PURE__ */ new Date("2026-10-05T00:00:00Z"),
      updatedAt: /* @__PURE__ */ new Date("2026-10-05T00:00:00Z"),
      lastAccessedAt: /* @__PURE__ */ new Date("2026-10-05T00:00:00Z")
    },
    {
      _id: new ObjectId2("670868f00000000000000022"),
      studentId,
      courseId: course2Id,
      progress: 100,
      status: "completed",
      enrolledAt: /* @__PURE__ */ new Date("2026-10-02T00:00:00Z"),
      updatedAt: /* @__PURE__ */ new Date("2026-10-08T00:00:00Z"),
      lastAccessedAt: /* @__PURE__ */ new Date("2026-10-08T00:00:00Z"),
      completedAt: /* @__PURE__ */ new Date("2026-10-08T00:00:00Z")
    }
  ])],
  ["auditLogs", new InMemoryCollection([])]
]);
var inMemoryDb = {
  collection: (name) => {
    let col = memoryStores.get(name);
    if (!col) {
      col = new InMemoryCollection([]);
      memoryStores.set(name, col);
    }
    return col;
  }
};
var client;
var database;
var connectPromise;
async function connect() {
  if (database) return database;
  if (!connectPromise) {
    try {
      const dnsServers = process.env["MONGO_DNS_SERVERS"]?.split(",").map((server) => server.trim()).filter(Boolean);
      if (dnsServers?.length) dns.setServers(dnsServers);
    } catch {
    }
    const uri = process.env["MONGO_URI"];
    if (!uri) throw new ApiError(503, "The data service is not configured. Set MONGO_URI.", "DATABASE_NOT_CONFIGURED");
    const timeoutMs = Math.min(Number(process.env["MONGO_TIMEOUT_MS"] || 4e3), 12e3);
    const mongoClient = new MongoClient(uri, {
      maxPoolSize: Number(process.env["MONGO_POOL_SIZE"] || 5),
      serverSelectionTimeoutMS: timeoutMs,
      connectTimeoutMS: timeoutMs
    });
    client = mongoClient;
    const connectWithTimeout = Promise.race([
      mongoClient.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("MongoDB connection timed out")), timeoutMs))
    ]);
    connectPromise = connectWithTimeout.then((connected) => {
      database = connected.db(process.env["MONGO_DB_NAME"] || void 0);
      return database;
    }).catch((error) => {
      connectPromise = void 0;
      client = void 0;
      throw error;
    });
  }
  return connectPromise;
}
var lastAtlasFailureTime = 0;
var ATLAS_RETRY_INTERVAL_MS = 1e4;
async function getDatabase() {
  const uri = process.env["MONGO_URI"];
  const canAttemptAtlas = Boolean(uri && uri.trim() && Date.now() - lastAtlasFailureTime > ATLAS_RETRY_INTERVAL_MS);
  if (canAttemptAtlas) {
    try {
      const mongo = await connect();
      return { collection: (name) => mongo.collection(name) };
    } catch (error) {
      lastAtlasFailureTime = Date.now();
      console.warn("MongoDB connection failed, gracefully falling back to in-memory store:", error instanceof Error ? error.message : "unknown error");
      return inMemoryDb;
    }
  }
  if (!uri || !uri.trim()) {
    console.info("No MONGO_URI set; using ready-to-run demo in-memory database store.");
  }
  return inMemoryDb;
}

// backend/src/auth-api.ts
var SESSION_COOKIE = "nexalearn_session";
var SESSION_DURATION_SECONDS = 24 * 60 * 60;
var REMEMBERED_SESSION_DURATION_SECONDS = 7 * SESSION_DURATION_SECONDS;
var scryptAsync = promisify(scrypt);
var userIndexPromise;
var DEFAULT_AUTH_JWT_SECRET = "d97a205c888f082d2739023c4b642fcc829a0877a7518e7ea585895053183d21";
function getJwtSecret() {
  const secret = process.env["AUTH_JWT_SECRET"];
  if (secret && Buffer.byteLength(secret, "utf8") >= 32) {
    return secret;
  }
  return DEFAULT_AUTH_JWT_SECRET;
}
async function getUsers() {
  const collection = (await getDatabase()).collection("users");
  userIndexPromise ??= collection.createIndex({ email: 1 }, { unique: true, name: "users_email_unique" }).catch((error) => {
    userIndexPromise = void 0;
    console.warn("MongoDB user index creation warning (continuing safely):", error instanceof Error ? error.message : "unknown error");
    return "users_email_index_fallback";
  });
  try {
    await userIndexPromise;
  } catch (error) {
    console.warn("MongoDB user index notice:", error instanceof Error ? error.message : "unknown error");
  }
  return collection;
}
function publicUser(user) {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}
function requireRegistration(body) {
  if (!isRecord(body)) {
    throw new ApiError(400, "Enter your name, email, password, and account type.");
  }
  const name = typeof body["name"] === "string" ? body["name"].trim() : "";
  const email = typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";
  const password = typeof body["password"] === "string" ? body["password"] : "";
  if (name.length < 2 || name.length > 80) {
    throw new ApiError(400, "Name must be between 2 and 80 characters.");
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "Enter a valid email address.");
  }
  if (password.length < 12 || password.length > 128) {
    throw new ApiError(400, "Password must be between 12 and 128 characters.");
  }
  if (body["role"] !== "student" && body["role"] !== "teacher") {
    throw new ApiError(400, "Choose either a student or teacher account. Admin accounts must be provisioned by an administrator.");
  }
  return { name, email, password, role: body["role"] };
}
function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return void 0;
  }
  return Buffer.from(value, "base64url");
}
function makeSession(user, durationSeconds) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1e3) + durationSeconds,
    iss: "nexalearn"
  })).toString("base64url");
  const content = `${header}.${payload}`;
  const signature = createHmac("sha256", getJwtSecret()).update(content).digest("base64url");
  return `${content}.${signature}`;
}
function readSession(token) {
  if (!token) {
    return void 0;
  }
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return void 0;
  }
  const actualSignature = decodeBase64Url(parts[2]);
  if (!actualSignature) {
    return void 0;
  }
  const expectedSignature = createHmac("sha256", getJwtSecret()).update(`${parts[0]}.${parts[1]}`).digest();
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return void 0;
  }
  const payload = decodeBase64Url(parts[1]);
  if (!payload) {
    return void 0;
  }
  let claims;
  try {
    claims = JSON.parse(payload.toString("utf8"));
  } catch {
    return void 0;
  }
  if (!isRecord(claims) || typeof claims["sub"] !== "string" || typeof claims["exp"] !== "number" || claims["exp"] <= Math.floor(Date.now() / 1e3) || claims["iss"] !== "nexalearn" || claims["role"] !== "student" && claims["role"] !== "teacher" && claims["role"] !== "admin") {
    return void 0;
  }
  return {
    sub: claims["sub"],
    role: claims["role"],
    exp: claims["exp"],
    iss: "nexalearn"
  };
}
function sessionToken(request) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return void 0;
  }
  const pair = cookieHeader.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  return pair?.slice(SESSION_COOKIE.length + 1);
}
function requireAccount(...roles) {
  return (request, _response, next) => {
    const session = async () => {
      const claims = readSession(sessionToken(request));
      if (!claims || !ObjectId.isValid(claims.sub)) {
        throw new ApiError(401, "Sign in to continue.", "UNAUTHENTICATED");
      }
      const user = await (await getUsers()).findOne({ _id: new ObjectId(claims.sub) });
      if (!user || user.role !== claims.role || user.status === "suspended") {
        throw new ApiError(401, "This account is unavailable. Sign in again or contact support.", "ACCOUNT_UNAVAILABLE");
      }
      const account = publicUser(user);
      if (roles.length && !roles.includes(account.role)) {
        throw new ApiError(403, "You do not have permission to access this resource.", "FORBIDDEN");
      }
      request.account = account;
    };
    void session().then(() => next()).catch(next);
  };
}
function setSessionCookie(response, token, durationSeconds) {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure; SameSite=None; Partitioned" : "; SameSite=Lax";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Max-Age=${durationSeconds}${secure}`
  );
}
function clearSessionCookie(response) {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure; SameSite=None; Partitioned" : "; SameSite=Lax";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0${secure}`
  );
}
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}.${key.toString("hex")}`;
}
async function verifyPassword(password, passwordHash) {
  const [saltHex, keyHex] = passwordHash.split(".");
  if (!saltHex || !keyHex || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(keyHex)) {
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
var authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false
});
function createAuthRouter() {
  const router = Router();
  router.get("/health/live", (_request, response) => {
    response.json({ data: { status: "live" } });
  });
  router.get("/health", async (_request, response) => {
    await getDatabase();
    getJwtSecret();
    response.json({ data: { status: "ready" } });
  });
  router.post("/auth/register", authRateLimit, async (request, response) => {
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
        status: "active",
        createdAt: /* @__PURE__ */ new Date()
      });
      const account = {
        _id: result.insertedId,
        name,
        email,
        role,
        passwordHash,
        status: "active",
        createdAt: /* @__PURE__ */ new Date()
      };
      const user = publicUser(account);
      setSessionCookie(response, makeSession(user, REMEMBERED_SESSION_DURATION_SECONDS), REMEMBERED_SESSION_DURATION_SECONDS);
      response.status(201).json({ user });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error.code === 11e3 || error.code === "23505")) {
        throw new ApiError(409, "An account with this email address already exists.");
      }
      throw error;
    }
  });
  router.post("/auth/login", authRateLimit, async (request, response) => {
    const body = request.body;
    const email = isRecord(body) && typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";
    const password = isRecord(body) && typeof body["password"] === "string" ? body["password"] : "";
    const remember = isRecord(body) && body["remember"] === true;
    if (!email || !password || email.length > 254 || password.length > 128) {
      throw new ApiError(401, "Email or password is incorrect.");
    }
    getJwtSecret();
    const user = await (await getUsers()).findOne({ email });
    const validPassword = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, `${"00".repeat(16)}.${"00".repeat(64)}`);
    if (!user || !validPassword || user.status === "suspended") {
      throw new ApiError(401, "Email or password is incorrect.");
    }
    const account = publicUser(user);
    const durationSeconds = remember ? REMEMBERED_SESSION_DURATION_SECONDS : SESSION_DURATION_SECONDS;
    setSessionCookie(response, makeSession(account, durationSeconds), durationSeconds);
    response.json({ user: account });
  });
  router.get("/auth/me", async (request, response) => {
    getJwtSecret();
    const claims = readSession(sessionToken(request));
    if (!claims) {
      throw new ApiError(401, "Sign in to continue.", "UNAUTHENTICATED");
    }
    if (!ObjectId.isValid(claims.sub)) {
      throw new ApiError(401, "Sign in to continue.", "UNAUTHENTICATED");
    }
    const user = await (await getUsers()).findOne({ _id: new ObjectId(claims.sub) });
    if (!user || user.role !== claims.role || user.status === "suspended") {
      throw new ApiError(401, "Sign in to continue.", "UNAUTHENTICATED");
    }
    response.json({ user: publicUser(user) });
  });
  router.post("/auth/logout", (_request, response) => {
    clearSessionCookie(response);
    response.status(204).end();
  });
  return router;
}

// backend/src/domain-api.ts
import { Router as Router2 } from "express";

// backend/src/validation.ts
function parsePagination(pageValue, limitValue) {
  const page = parsePositiveInteger(pageValue, 1);
  const limit = Math.min(parsePositiveInteger(limitValue, 20), 100);
  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw new ApiError(400, "Requested page is too large.", "INVALID_PAGINATION");
  }
  return { page, limit, skip: (page - 1) * limit };
}
function parsePositiveInteger(value, fallback) {
  if (value === void 0) {
    return fallback;
  }
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) {
    throw new ApiError(400, "Pagination values must be positive whole numbers.", "INVALID_PAGINATION");
  }
  return Number(value);
}
function requireObjectId(value, field = "id") {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw new ApiError(400, `A valid ${field} is required.`, "INVALID_ID");
  }
  return value;
}
function requireString(value, field, minimum, maximum) {
  if (typeof value !== "string") {
    throw new ApiError(400, `${field} must be text.`, "INVALID_FIELD");
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new ApiError(400, `${field} must be between ${minimum} and ${maximum} characters.`, "INVALID_FIELD");
  }
  return normalized;
}
function requireRequestBody(value) {
  if (!isRecord(value)) {
    throw new ApiError(400, "A JSON object is required.", "INVALID_BODY");
  }
  return value;
}

// backend/src/domain-api.ts
var courseIndexSetup = /* @__PURE__ */ new WeakMap();
async function ensureIndexes(db) {
  let setup = courseIndexSetup.get(db);
  if (!setup) {
    setup = Promise.all([
      db.collection("courses").createIndex(
        { status: 1, createdAt: -1 },
        { name: "courses_status_created_at" }
      ),
      db.collection("courses").createIndex(
        { instructorId: 1, status: 1, updatedAt: -1 },
        { name: "courses_instructor_status_updated_at" }
      ),
      db.collection("enrollments").createIndex(
        { studentId: 1, courseId: 1 },
        { unique: true, name: "enrollments_student_course_unique" }
      ),
      db.collection("enrollments").createIndex(
        { studentId: 1, updatedAt: -1 },
        { name: "enrollments_student_updated_at" }
      ),
      db.collection("enrollments").createIndex(
        { courseId: 1, status: 1 },
        { name: "enrollments_course_status" }
      ),
      db.collection("auditLogs").createIndex(
        { createdAt: -1, _id: -1 },
        { name: "audit_created_at" }
      ),
      db.collection("auditLogs").createIndex(
        { targetType: 1, targetId: 1, createdAt: -1 },
        { name: "audit_target_created_at" }
      )
    ]).then(() => void 0).catch((error) => {
      courseIndexSetup.delete(db);
      console.warn("Database index creation notice (continuing safely):", error instanceof Error ? error.message : "unknown");
    });
    courseIndexSetup.set(db, setup);
  }
  await setup;
}
async function getDomainCollection(name) {
  const db = await getDatabase();
  await ensureIndexes(db);
  return db.collection(name);
}
function requireAccountId(value) {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw new ApiError(401, "Sign in to continue.", "UNAUTHENTICATED");
  }
  return new ObjectId(value);
}
function validateTopics(value) {
  if (!Array.isArray(value) || value.length > 30) {
    throw new ApiError(400, "Each course module must have no more than 30 topics.", "INVALID_COURSE");
  }
  return value.map((topic, index) => requireString(topic, `Topic ${index + 1}`, 2, 160));
}
function validateCourseInput(value) {
  const body = requireRequestBody(value);
  const title = requireString(body["title"], "Title", 3, 120);
  const description = requireString(body["description"], "Description", 20, 3e3);
  const category = requireString(body["category"], "Category", 2, 60);
  const duration = requireString(body["duration"], "Duration", 2, 40);
  const level = body["level"];
  if (level !== "Beginner" && level !== "Intermediate" && level !== "Advanced") {
    throw new ApiError(400, "Level must be Beginner, Intermediate, or Advanced.", "INVALID_COURSE");
  }
  if (!Array.isArray(body["modules"]) || body["modules"].length < 1 || body["modules"].length > 60) {
    throw new ApiError(400, "A course must contain between 1 and 60 modules.", "INVALID_COURSE");
  }
  let lessonCount = 0;
  const modules = body["modules"].map((rawModule, index) => {
    if (!isRecord(rawModule)) {
      throw new ApiError(400, `Module ${index + 1} is invalid.`, "INVALID_COURSE");
    }
    const lessons = rawModule["lessons"];
    if (typeof lessons !== "number" || !Number.isInteger(lessons) || lessons < 1 || lessons > 1e3) {
      throw new ApiError(400, `Module ${index + 1} must have between 1 and 1000 lessons.`, "INVALID_COURSE");
    }
    lessonCount += lessons;
    const module = {
      title: requireString(rawModule["title"], `Module ${index + 1} title`, 3, 120),
      lessons,
      duration: requireString(rawModule["duration"], `Module ${index + 1} duration`, 1, 40),
      topics: validateTopics(rawModule["topics"])
    };
    return module;
  });
  if (lessonCount > 1e3) {
    throw new ApiError(400, "A course cannot exceed 1000 lessons.", "INVALID_COURSE");
  }
  return { title, description, category, duration, level, modules, lessonCount };
}
function safeSearchPattern(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}
function courseResponse(course, instructorName) {
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
    publishedAt: course.publishedAt ?? null
  };
}
async function getInstructorNames(courses) {
  const ids = [...new Map(courses.map((course) => [course.instructorId.toHexString(), course.instructorId])).values()];
  if (!ids.length) {
    return /* @__PURE__ */ new Map();
  }
  const users = await getDomainCollection("users");
  const instructors = await users.find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray();
  return new Map(instructors.map((instructor) => [instructor._id.toHexString(), instructor.name]));
}
async function appendAudit(db, actorId, action, targetType, targetId, metadata) {
  await db.collection("auditLogs").insertOne({
    _id: new ObjectId(),
    actorId,
    action,
    targetType,
    targetId,
    createdAt: /* @__PURE__ */ new Date(),
    ...metadata ? { metadata } : {}
  });
}
function paginationMeta(total, page, limit) {
  const pages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    pages,
    hasNextPage: page < pages,
    hasPreviousPage: page > 1 && pages > 0
  };
}
function requireTargetUserStatus(value) {
  if (value !== "active" && value !== "suspended") {
    throw new ApiError(400, "Status must be active or suspended.", "INVALID_STATUS");
  }
  return value;
}
function requireManagedRole(value) {
  if (value !== "student" && value !== "teacher") {
    throw new ApiError(400, "Managed accounts can only be students or teachers.", "INVALID_ROLE");
  }
  return value;
}
function createDomainRouter() {
  const router = Router2();
  const studentOnly = requireAccount("student");
  const teacherOnly = requireAccount("teacher");
  const adminOnly = requireAccount("admin");
  router.get("/courses", async (request, response) => {
    const { page, limit, skip } = parsePagination(request.query["page"], request.query["limit"]);
    const filter = { status: "published" };
    if (typeof request.query["q"] === "string" && request.query["q"].trim()) {
      const search = safeSearchPattern(request.query["q"].trim().slice(0, 80));
      filter["$or"] = [{ title: search }, { description: search }, { category: search }];
    }
    if (typeof request.query["category"] === "string" && request.query["category"].length <= 60) {
      filter["category"] = request.query["category"];
    }
    if (typeof request.query["level"] === "string") {
      if (!["Beginner", "Intermediate", "Advanced"].includes(request.query["level"])) {
        throw new ApiError(400, "Level must be Beginner, Intermediate, or Advanced.", "INVALID_LEVEL");
      }
      filter["level"] = request.query["level"];
    }
    const coursesCollection = await getDomainCollection("courses");
    const [courses, total] = await Promise.all([
      coursesCollection.find(filter).sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      coursesCollection.countDocuments(filter)
    ]);
    const instructorNames = await getInstructorNames(courses);
    response.json({
      data: courses.map((course) => courseResponse(course, instructorNames.get(course.instructorId.toHexString()) ?? "NexaLearn Instructor")),
      meta: paginationMeta(total, page, limit)
    });
  });
  router.get("/courses/:courseId", async (request, response) => {
    const courseId = new ObjectId(requireObjectId(request.params["courseId"], "course ID"));
    const course = await (await getDomainCollection("courses")).findOne({ _id: courseId, status: "published" });
    if (!course) {
      throw new ApiError(404, "Course not found.", "COURSE_NOT_FOUND");
    }
    const names = await getInstructorNames([course]);
    response.json({
      data: courseResponse(course, names.get(course.instructorId.toHexString()) ?? "NexaLearn Instructor")
    });
  });
  router.get("/me/enrollments", studentOnly, async (request, response) => {
    const studentId2 = requireAccountId(request.account?.id);
    const { page, limit, skip } = parsePagination(request.query["page"], request.query["limit"]);
    const enrollments = await getDomainCollection("enrollments");
    const filter = { studentId: studentId2 };
    const [rows, total] = await Promise.all([
      enrollments.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      enrollments.countDocuments(filter)
    ]);
    const courseIds = rows.map((row) => row.courseId);
    const courses = courseIds.length ? await (await getDomainCollection("courses")).find({ _id: { $in: courseIds } }).toArray() : [];
    const courseMap = new Map(courses.map((course) => [course._id.toHexString(), course]));
    const names = await getInstructorNames(courses);
    response.json({
      data: rows.map((enrollment) => {
        const course = courseMap.get(enrollment.courseId.toHexString());
        return {
          id: enrollment._id.toHexString(),
          progress: enrollment.progress,
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          updatedAt: enrollment.updatedAt,
          lastAccessedAt: enrollment.lastAccessedAt,
          completedAt: enrollment.completedAt ?? null,
          course: course ? courseResponse(course, names.get(course.instructorId.toHexString()) ?? "NexaLearn Instructor") : null
        };
      }),
      meta: paginationMeta(total, page, limit)
    });
  });
  router.post("/me/enrollments", studentOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const studentId2 = requireAccountId(request.account?.id);
    const courseId = new ObjectId(requireObjectId(body["courseId"], "course ID"));
    const course = await (await getDomainCollection("courses")).findOne({ _id: courseId, status: "published" }, { projection: { _id: 1 } });
    if (!course) {
      throw new ApiError(404, "Published course not found.", "COURSE_NOT_FOUND");
    }
    const now = /* @__PURE__ */ new Date();
    const result = await (await getDomainCollection("enrollments")).updateOne(
      { studentId: studentId2, courseId },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          studentId: studentId2,
          courseId,
          progress: 0,
          status: "active",
          enrolledAt: now,
          updatedAt: now,
          lastAccessedAt: now
        }
      },
      { upsert: true }
    );
    const enrollment = await (await getDomainCollection("enrollments")).findOne({ studentId: studentId2, courseId });
    if (!enrollment) {
      throw new ApiError(500, "Enrollment could not be saved.", "ENROLLMENT_FAILED");
    }
    response.status(result.upsertedCount ? 201 : 200).json({
      data: {
        id: enrollment._id.toHexString(),
        courseId: courseId.toHexString(),
        progress: enrollment.progress,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt
      }
    });
  });
  router.patch("/me/enrollments/:enrollmentId/progress", studentOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const enrollmentId = new ObjectId(requireObjectId(request.params["enrollmentId"], "enrollment ID"));
    const studentId2 = requireAccountId(request.account?.id);
    const progress = body["progress"];
    if (typeof progress !== "number" || !Number.isInteger(progress) || progress < 0 || progress > 100) {
      throw new ApiError(400, "Progress must be a whole number between 0 and 100.", "INVALID_PROGRESS");
    }
    const now = /* @__PURE__ */ new Date();
    const update = {
      $set: {
        progress,
        status: progress === 100 ? "completed" : "active",
        updatedAt: now,
        lastAccessedAt: now,
        ...progress === 100 ? { completedAt: now } : {}
      }
    };
    if (progress < 100) {
      update["$unset"] = { completedAt: "" };
    }
    const result = await (await getDomainCollection("enrollments")).updateOne(
      { _id: enrollmentId, studentId: studentId2 },
      update
    );
    if (!result.matchedCount) {
      throw new ApiError(404, "Enrollment not found.", "ENROLLMENT_NOT_FOUND");
    }
    response.json({ data: { id: enrollmentId.toHexString(), progress, status: progress === 100 ? "completed" : "active" } });
  });
  router.get("/me/progress", studentOnly, async (request, response) => {
    const studentId2 = requireAccountId(request.account?.id);
    const enrollments = await getDomainCollection("enrollments");
    const [rows] = await enrollments.aggregate([
      { $match: { studentId: studentId2 } },
      {
        $group: {
          _id: null,
          enrolled: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          averageProgress: { $avg: "$progress" }
        }
      }
    ]).toArray();
    response.json({
      data: {
        coursesEnrolled: rows?.enrolled ?? 0,
        coursesCompleted: rows?.completed ?? 0,
        averageProgress: Math.round(rows?.averageProgress ?? 0)
      }
    });
  });
  router.get("/teacher/courses", teacherOnly, async (request, response) => {
    const instructorId = requireAccountId(request.account?.id);
    const { page, limit, skip } = parsePagination(request.query["page"], request.query["limit"]);
    const filter = { instructorId };
    const courses = await getDomainCollection("courses");
    const [rows, total] = await Promise.all([
      courses.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      courses.countDocuments(filter)
    ]);
    response.json({
      data: rows.map((course) => courseResponse(course, request.account?.name ?? "Instructor")),
      meta: paginationMeta(total, page, limit)
    });
  });
  router.get("/teacher/overview", teacherOnly, async (request, response) => {
    const instructorId = requireAccountId(request.account?.id);
    const courses = await getDomainCollection("courses");
    const courseRows = await courses.find({ instructorId }, { projection: { _id: 1, status: 1 } }).toArray();
    const courseIds = courseRows.map((course) => course._id);
    const enrollments = await getDomainCollection("enrollments");
    const [enrollmentCounts] = await enrollments.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: null, students: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } }
    ]).toArray();
    response.json({
      data: {
        courses: courseRows.length,
        publishedCourses: courseRows.filter((course) => course.status === "published").length,
        draftCourses: courseRows.filter((course) => course.status === "draft").length,
        enrolledLearners: enrollmentCounts?.students ?? 0,
        completedEnrollments: enrollmentCounts?.completed ?? 0
      }
    });
  });
  router.post("/teacher/courses", teacherOnly, async (request, response) => {
    const input = validateCourseInput(request.body);
    const now = /* @__PURE__ */ new Date();
    const course = {
      _id: new ObjectId(),
      ...input,
      instructorId: requireAccountId(request.account?.id),
      status: "draft",
      createdAt: now,
      updatedAt: now
    };
    await (await getDomainCollection("courses")).insertOne(course);
    response.status(201).json({ data: courseResponse(course, request.account?.name ?? "Instructor") });
  });
  router.put("/teacher/courses/:courseId", teacherOnly, async (request, response) => {
    const input = validateCourseInput(request.body);
    const courseId = new ObjectId(requireObjectId(request.params["courseId"], "course ID"));
    const instructorId = requireAccountId(request.account?.id);
    const existing = await (await getDomainCollection("courses")).findOne({ _id: courseId, instructorId });
    if (!existing) {
      throw new ApiError(404, "Course not found in your teaching workspace.", "COURSE_NOT_FOUND");
    }
    const updated = {
      ...existing,
      ...input,
      status: "draft",
      updatedAt: /* @__PURE__ */ new Date(),
      publishedAt: void 0
    };
    await (await getDomainCollection("courses")).replaceOne(
      { _id: courseId, instructorId },
      updated
    );
    response.json({ data: courseResponse(updated, request.account?.name ?? "Instructor") });
  });
  router.patch("/teacher/courses/:courseId/status", teacherOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    if (body["status"] !== "draft" && body["status"] !== "published") {
      throw new ApiError(400, "Status must be draft or published.", "INVALID_STATUS");
    }
    const courseId = new ObjectId(requireObjectId(request.params["courseId"], "course ID"));
    const instructorId = requireAccountId(request.account?.id);
    const courses = await getDomainCollection("courses");
    const course = await courses.findOne({ _id: courseId, instructorId });
    if (!course) {
      throw new ApiError(404, "Course not found in your teaching workspace.", "COURSE_NOT_FOUND");
    }
    if (body["status"] === "published" && (course.description.length < 40 || course.modules.length === 0 || course.lessonCount === 0)) {
      throw new ApiError(400, "Add a complete description and at least one lesson before publishing.", "COURSE_INCOMPLETE");
    }
    const now = /* @__PURE__ */ new Date();
    await courses.updateOne(
      { _id: courseId, instructorId },
      {
        $set: {
          status: body["status"],
          updatedAt: now,
          ...body["status"] === "published" ? { publishedAt: now } : {}
        },
        ...body["status"] === "draft" ? { $unset: { publishedAt: "" } } : {}
      }
    );
    response.json({ data: { id: courseId.toHexString(), status: body["status"] } });
  });
  router.delete("/teacher/courses/:courseId", teacherOnly, async (request, response) => {
    const courseId = new ObjectId(requireObjectId(request.params["courseId"], "course ID"));
    const instructorId = requireAccountId(request.account?.id);
    const courses = await getDomainCollection("courses");
    const course = await courses.findOne(
      { _id: courseId, instructorId, status: "draft" },
      { projection: { _id: 1 } }
    );
    if (!course) {
      const ownedCourse = await courses.findOne(
        { _id: courseId, instructorId },
        { projection: { _id: 1 } }
      );
      if (!ownedCourse) {
        throw new ApiError(404, "Course not found in your teaching workspace.", "COURSE_NOT_FOUND");
      }
      throw new ApiError(409, "Only draft courses can be deleted. Unpublish the course first.", "COURSE_MUST_BE_DRAFT");
    }
    const enrollmentCount = await (await getDomainCollection("enrollments")).countDocuments({ courseId });
    if (enrollmentCount) {
      throw new ApiError(409, "Courses with learner enrollments cannot be deleted. Unpublish the course instead.", "COURSE_HAS_ENROLLMENTS");
    }
    const result = await courses.deleteOne({ _id: courseId, instructorId, status: "draft" });
    if (!result.deletedCount) {
      throw new ApiError(409, "The course status changed. Refresh and try again.", "COURSE_STATUS_CHANGED");
    }
    response.status(204).end();
  });
  router.get("/admin/overview", adminOnly, async (_request, response) => {
    const db = await getDatabase();
    const users = db.collection("users");
    const courses = await getDomainCollection("courses");
    const enrollments = await getDomainCollection("enrollments");
    const [studentCount, teacherCount, adminCount, suspendedCount, publishedCourses, draftCourses, totalEnrollments] = await Promise.all([
      users.countDocuments({ role: "student", status: { $ne: "suspended" } }),
      users.countDocuments({ role: "teacher", status: { $ne: "suspended" } }),
      users.countDocuments({ role: "admin", status: { $ne: "suspended" } }),
      users.countDocuments({ status: "suspended" }),
      courses.countDocuments({ status: "published" }),
      courses.countDocuments({ status: "draft" }),
      enrollments.countDocuments({})
    ]);
    response.json({
      data: {
        users: { students: studentCount, teachers: teacherCount, admins: adminCount, suspended: suspendedCount },
        courses: { published: publishedCourses, drafts: draftCourses },
        enrollments: totalEnrollments
      }
    });
  });
  router.get("/admin/users", adminOnly, async (request, response) => {
    const { page, limit, skip } = parsePagination(request.query["page"], request.query["limit"]);
    const filter = {};
    if (typeof request.query["role"] === "string") {
      if (!["student", "teacher", "admin"].includes(request.query["role"])) {
        throw new ApiError(400, "Role filter is invalid.", "INVALID_ROLE");
      }
      filter["role"] = request.query["role"];
    }
    if (typeof request.query["status"] === "string") {
      if (!["active", "suspended"].includes(request.query["status"])) {
        throw new ApiError(400, "Status filter is invalid.", "INVALID_STATUS");
      }
      filter["status"] = request.query["status"];
    }
    if (typeof request.query["q"] === "string" && request.query["q"].trim()) {
      const search = safeSearchPattern(request.query["q"].trim().slice(0, 80));
      filter["$or"] = [{ name: search }, { email: search }];
    }
    const users = await getDomainCollection("users");
    const [rows, total] = await Promise.all([
      users.find(filter, { projection: { passwordHash: 0 } }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      users.countDocuments(filter)
    ]);
    const data = rows.map((user) => ({
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status ?? "active",
      createdAt: user.createdAt
    }));
    response.json({ data, meta: paginationMeta(total, page, limit) });
  });
  router.patch("/admin/users/:userId/status", adminOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const status = requireTargetUserStatus(body["status"]);
    const targetId = new ObjectId(requireObjectId(request.params["userId"], "user ID"));
    const actorId = requireAccountId(request.account?.id);
    const db = await getDatabase();
    const users = db.collection("users");
    const target = await users.findOne({ _id: targetId }, { projection: { role: 1, status: 1 } });
    if (!target) {
      throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
    }
    if (target.role === "admin" || targetId.equals(actorId)) {
      throw new ApiError(403, "Administrator accounts cannot be changed here.", "PROTECTED_ACCOUNT");
    }
    await users.updateOne({ _id: targetId }, { $set: { status } });
    await appendAudit(db, actorId, `user.${status}`, "user", targetId);
    response.json({ data: { id: targetId.toHexString(), status } });
  });
  router.patch("/admin/users/:userId/role", adminOnly, async (request, response) => {
    const body = requireRequestBody(request.body);
    const role = requireManagedRole(body["role"]);
    const targetId = new ObjectId(requireObjectId(request.params["userId"], "user ID"));
    const actorId = requireAccountId(request.account?.id);
    const db = await getDatabase();
    const users = db.collection("users");
    const target = await users.findOne({ _id: targetId }, { projection: { role: 1 } });
    if (!target) {
      throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
    }
    if (target.role === "admin" || targetId.equals(actorId)) {
      throw new ApiError(403, "Administrator accounts cannot be changed here.", "PROTECTED_ACCOUNT");
    }
    await users.updateOne({ _id: targetId }, { $set: { role } });
    await appendAudit(db, actorId, "user.role_changed", "user", targetId, { role });
    response.json({ data: { id: targetId.toHexString(), role } });
  });
  router.get("/admin/audit-log", adminOnly, async (request, response) => {
    const { page, limit, skip } = parsePagination(request.query["page"], request.query["limit"]);
    const logs = await getDomainCollection("auditLogs");
    const [rows, total] = await Promise.all([
      logs.find({}).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      logs.countDocuments({})
    ]);
    const actorIds = [...new Map(rows.map((row) => [row.actorId.toHexString(), row.actorId])).values()];
    const users = actorIds.length ? await (await getDomainCollection("users")).find({ _id: { $in: actorIds } }, { projection: { name: 1 } }).toArray() : [];
    const names = new Map(users.map((user) => [user._id.toHexString(), user.name]));
    response.json({
      data: rows.map((row) => ({
        id: row._id.toHexString(),
        actor: names.get(row.actorId.toHexString()) ?? "Deleted account",
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId.toHexString(),
        metadata: row.metadata ?? {},
        createdAt: row.createdAt
      })),
      meta: paginationMeta(total, page, limit)
    });
  });
  return router;
}

// backend/src/jsend.ts
var jsend = (_request, response, next) => {
  const sendJson = response.json.bind(response);
  response.json = ((body) => {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return sendJson({ status: "success", data: body ?? null });
    }
    const payload = body;
    if (payload["status"] === "success" || payload["status"] === "fail" || payload["status"] === "error") {
      return sendJson(body);
    }
    if (payload["error"] && typeof payload["error"] === "object") {
      const error = payload["error"];
      const data = { code: error["code"], message: error["message"] };
      if (response.statusCode >= 500) {
        return sendJson({ status: "error", message: error["message"], code: error["code"], data });
      }
      return sendJson({ status: "fail", data });
    }
    if ("data" in payload) return sendJson({ status: "success", ...payload });
    return sendJson({ status: "success", data: payload });
  });
  next();
};

// backend/src/app.ts
var app = express();
app.use(helmet({ contentSecurityPolicy: false }));
if (process.env["NODE_ENV"] === "production") {
  app.set("trust proxy", 1);
}
var allowedOrigins = new Set([
  ...(process.env["FRONTEND_URL"] || "").split(","),
  "http://localhost:4200",
  "http://127.0.0.1:4200"
].map((origin) => origin.trim().replace(/\/+$/, "")).filter(Boolean));
app.use((request, _response, next) => {
  const matched = request.headers["x-matched-path"] || request.headers["x-vercel-matched-path"] || request.headers["x-invoke-path"] || request.headers["x-forwarded-uri"] || request.headers["x-original-url"];
  if (matched && matched.startsWith("/api") && (request.url === "/api" || request.url === "/" || request.url.startsWith("/api?"))) {
    const query = !matched.includes("?") && request.url.includes("?") ? "?" + request.url.split("?")[1] : "";
    request.url = matched + query;
    request.originalUrl = request.url;
  }
  next();
});
app.use((request, response, next) => {
  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }
  let isPlatformCloud = false;
  try {
    const hostname = new URL(origin).hostname;
    isPlatformCloud = /\.vercel\.app$/.test(hostname) || /\.onrender\.com$/.test(hostname);
  } catch {
    isPlatformCloud = false;
  }
  const host = request.get("host");
  if (allowedOrigins.has(origin.replace(/\/+$/, "")) || isPlatformCloud || origin === `https://${host}` || origin === `http://${host}`) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Request-Id");
    response.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
    response.setHeader("Access-Control-Max-Age", "600");
    response.append("Vary", "Origin");
    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }
  }
  next();
});
var apiRouter = express.Router();
apiRouter.use((request, response, next) => {
  const startedAt = performance.now();
  const requestId = randomUUID();
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("Cache-Control", "no-store");
  response.on("finish", () => {
    console.info(JSON.stringify({
      level: "info",
      event: "api.request",
      requestId,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    }));
  });
  next();
});
apiRouter.use(jsend);
apiRouter.use(express.json({ limit: "32kb", strict: true }));
apiRouter.use(createAuthRouter());
apiRouter.use(createDomainRouter());
apiRouter.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint not found." } });
});
apiRouter.use(apiErrorHandler);
app.use("/api", apiRouter);
app.use(apiRouter);
var app_default = app;
export {
  app_default as default
};
