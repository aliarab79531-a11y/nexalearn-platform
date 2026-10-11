const { collection } = require("../config/db");
const ObjectId = require("../utils/objectId");
const {
  hashPassword,
  verifyPassword,
  makeSessionToken,
  makeBearerToken,
  setSessionCookie,
  clearSessionCookie,
  SESSION_DURATION_SECONDS,
} = require("../utils/token");

const register = async (req, res, next) => {
  try {
    const { name, email, password, role = "student" } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FIELD", message: "Name is required." },
        message: "Name is required.",
      });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FIELD", message: "Email is required." },
        message: "Email is required.",
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FIELD", message: "Password is required." },
        message: "Password is required.",
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = String(role).toLowerCase() === "teacher" ? "teacher" : "student";

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FIELD", message: "Name must be between 2 and 80 characters." },
        message: "Name must be between 2 and 80 characters.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FIELD", message: "Enter a valid email address." },
        message: "Enter a valid email address.",
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FIELD", message: "Password must be between 8 and 128 characters." },
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const usersCol = collection("users");
    const existing = await usersCol.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: "ALREADY_EXISTS", message: "An account with this email address already exists." },
        message: "An account with this email address already exists.",
      });
    }

    const passwordHash = await hashPassword(password);
    const newId = new ObjectId();
    const now = new Date();

    const userRecord = {
      _id: newId,
      name: trimmedName,
      email: normalizedEmail,
      role: normalizedRole,
      passwordHash,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    await usersCol.insertOne(userRecord);

    const publicUser = {
      id: newId.toHexString(),
      name: trimmedName,
      email: normalizedEmail,
      role: normalizedRole,
    };

    const sessionToken = makeSessionToken(publicUser, SESSION_DURATION_SECONDS);
    const bearerToken = makeBearerToken(publicUser);
    setSessionCookie(res, sessionToken, SESSION_DURATION_SECONDS);

    return res.status(201).json({
      success: true,
      user: publicUser,
      token: bearerToken,
      data: publicUser,
      message: "Account created successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, remember = false } = req.body || {};

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Email and password are required." },
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const usersCol = collection("users");
    const user = await usersCol.findOne({ email: normalizedEmail });

    const passwordValid = user
      ? await verifyPassword(password, user.passwordHash || user.password)
      : false;

    if (!user || !passwordValid || user.status === "suspended") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." },
        message: "Email or password is incorrect.",
      });
    }

    const role = (user.role || "student").toLowerCase();
    const userId = user._id.toHexString ? user._id.toHexString() : String(user._id);

    const publicUser = {
      id: userId,
      name: user.name,
      email: user.email,
      role,
    };

    const duration = remember ? 30 * 24 * 60 * 60 : SESSION_DURATION_SECONDS;
    const sessionToken = makeSessionToken(publicUser, duration);
    const bearerToken = makeBearerToken(publicUser, remember ? "30d" : "7d");

    setSessionCookie(res, sessionToken, duration);

    return res.status(200).json({
      success: true,
      user: publicUser,
      token: bearerToken,
      data: publicUser,
      message: "Login successful.",
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
    data: req.user,
    message: "Authenticated user retrieved successfully.",
  });
};

const logout = async (req, res) => {
  clearSessionCookie(res);
  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

module.exports = {
  register,
  login,
  getMe,
  logout,
};
