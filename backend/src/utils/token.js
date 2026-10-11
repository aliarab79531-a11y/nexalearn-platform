const { createHmac, randomBytes, scrypt, timingSafeEqual } = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = "nexalearn_session";
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "AUTH_JWT_SECRET or JWT_SECRET must be configured with a random string of at least 32 bytes."
    );
  }
  return secret;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}.${key.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  // If bcrypt hash
  if (/^\$2[aby]\$\d{2}\$/.test(storedHash)) {
    return bcrypt.compare(password, storedHash);
  }

  // If scrypt hash (saltHex.keyHex)
  const parts = storedHash.split(".");
  if (parts.length === 2 && parts[0].length === 32 && parts[1].length === 128) {
    const salt = Buffer.from(parts[0], "hex");
    const expected = Buffer.from(parts[1], "hex");
    const actual = await scryptAsync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  }

  return false;
}

function makeSessionToken(user, durationSeconds = SESSION_DURATION_SECONDS) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(user.id || user._id),
      role: (user.role || "student").toLowerCase(),
      exp: Math.floor(Date.now() / 1000) + durationSeconds,
      iss: "nexalearn",
    })
  ).toString("base64url");

  const content = `${header}.${payload}`;
  const signature = createHmac("sha256", getSecret()).update(content).digest("base64url");
  return `${content}.${signature}`;
}

function makeBearerToken(user, duration = "7d") {
  return jwt.sign(
    {
      id: String(user.id || user._id),
      sub: String(user.id || user._id),
      email: user.email,
      role: (user.role || "student").toLowerCase(),
    },
    getSecret(),
    {
      expiresIn: duration,
      issuer: "nexalearn",
      audience: "nexalearn-users",
    }
  );
}

function verifyToken(token) {
  if (!token) return null;
  const secret = getSecret();

  // Try decoding as session token (header.payload.signature)
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const headerB64 = parts[0];
      const payloadB64 = parts[1];
      const sigB64 = parts[2];

      const expectedSig = createHmac("sha256", secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");

      if (sigB64 === expectedSig) {
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
        if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
          return {
            id: payload.sub,
            sub: payload.sub,
            role: payload.role,
            iss: payload.iss,
          };
        }
      }
    } catch {
      // Fall through to standard jwt.verify
    }

    // Try standard JWT
    try {
      const decoded = jwt.verify(token, secret);
      return {
        id: decoded.id || decoded.sub,
        sub: decoded.sub || decoded.id,
        role: (decoded.role || "student").toLowerCase(),
        email: decoded.email,
      };
    } catch {
      // Invalid
    }
  }

  return null;
}

function setSessionCookie(res, token, durationSeconds = SESSION_DURATION_SECONDS) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: durationSeconds * 1000,
    path: "/",
  });
}

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

module.exports = {
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  getSecret,
  hashPassword,
  verifyPassword,
  makeSessionToken,
  makeBearerToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
};
