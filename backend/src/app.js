const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const { collection } = require("./config/db");
const { getStudentProgress } = require("./controllers/enrollmentController");
const { protect, authorizeRoles } = require("./middleware/authMiddleware");

// Route imports
const authRoutes = require("./routes/authroutes");
const courseRoutes = require("./routes/courseRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const adminRoutes = require("./routes/adminRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// =========================
// Security & Headers
// =========================
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration supporting Angular, Vite, custom frontend URL and Vercel domains
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:4200",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4301",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Check explicit allowed origins or any .vercel.app domain
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);

// =========================
// Parsers
// =========================
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100, // relaxed for local testing
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Normalize /api prefix if missing (useful for direct serverless function invocation)
app.use((req, res, next) => {
  if (!req.path.startsWith("/api") && req.path !== "/") {
    req.url = `/api${req.url}`;
  }
  next();
});

// =========================
// Root & Health Check Routes
// =========================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Learning Platform Backend API is running with Supabase (PostgreSQL).",
    version: "1.0.0",
    database: "Supabase PostgreSQL",
  });
});

app.get("/api/health/live", (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "live" },
    message: "Process is live.",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const courseCount = await collection("courses").countDocuments({});
    res.status(200).json({
      success: true,
      data: {
        status: "ready",
        database: "Connected",
        totalCourses: courseCount,
      },
      message: "Server and Supabase database are healthy.",
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: "degraded",
        database: "Error: " + error.message,
      },
      message: "Database connection failed.",
    });
  }
});

// =========================
// API Mounts
// =========================
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/me/enrollments", enrollmentRoutes);
app.get("/api/me/progress", protect, authorizeRoles("student"), getStudentProgress);
app.use("/api/teacher", teacherRoutes);
app.use("/api/admin", adminRoutes);

// =========================
// 404 Handler
// =========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    },
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// =========================
// Global Error Handler
// =========================
app.use(errorHandler);

module.exports = app;