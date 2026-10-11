const { collection } = require("../config/db");
const ObjectId = require("../utils/objectId");
const { verifyToken, SESSION_COOKIE } = require("../utils/token");

function extractToken(req) {
  // 1. Check req.cookies
  if (req.cookies && req.cookies[SESSION_COOKIE]) {
    return req.cookies[SESSION_COOKIE];
  }

  // 2. Check Cookie header manually
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const pair = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${SESSION_COOKIE}=`));
    if (pair) {
      return pair.slice(SESSION_COOKIE.length + 1);
    }
  }

  // 3. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return undefined;
}

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in to continue. No authentication token provided.",
        },
      });
    }

    const payload = verifyToken(token);
    if (!payload || !ObjectId.isValid(payload.id)) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Session is invalid or expired. Please sign in again.",
        },
      });
    }

    const usersCol = collection("users");
    const user = await usersCol.findOne({ _id: new ObjectId(payload.id) });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "ACCOUNT_UNAVAILABLE",
          message: "Account not found or deleted.",
        },
      });
    }

    if (user.status === "suspended") {
      return res.status(401).json({
        success: false,
        error: {
          code: "ACCOUNT_UNAVAILABLE",
          message: "This account has been suspended. Please contact support.",
        },
      });
    }

    req.user = {
      id: user._id.toHexString ? user._id.toHexString() : String(user._id),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: (user.role || "student").toLowerCase(),
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Failed to authenticate session.",
      },
    });
  }
};

const authorizeRoles = (...roles) => {
  const normalizedRoles = roles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this resource.",
        },
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorizeRoles,
  extractToken,
};