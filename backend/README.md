# NexaLearn Backend API

Node.js + Express + TypeScript + MongoDB Atlas backend service for NexaLearn AI Platform.

## 📁 Directory Structure
- `src/`
  - `server.ts` - Entrypoint, starts HTTP server & connects to MongoDB Atlas
  - `app.ts` - Express application, CORS configuration, security headers (Helmet), JSend formatting
  - `database.ts` - MongoDB connection pool, collections, models, demo data bootstrap
  - `auth-api.ts` - Session authentication, registration, login, role RBAC
  - `domain-api.ts` - Courses, enrollments, teacher overview, grading queue, quizzes
  - `api-errors.ts` - Structured API error definitions & Express error handling
  - `validation.ts` - Request validation helpers and pagination
  - `jsend.ts` - JSend standard response wrapper
- `scripts/`
  - `seed-demo.mjs` - Demo user and courses seeding script
  - `create-admin.mjs` - Admin user creation utility
- `tests/`
  - `http.spec.ts` - Node.js native test runner integration tests
  - `validation.spec.ts` - Unit tests for validation functions

## 🚀 Running the Backend
From within the `backend/` directory:

```bash
# Start backend in development mode with live watch
npm run dev

# Start backend in production mode
npm start

# Run API tests
npm test

# Seed demo database
npm run seed
```

## ⚙️ Environment Configuration (`.env`)
- `PORT` or `API_PORT`: API server port (default: 4301)
- `MONGO_URI`: MongoDB connection string
- `MONGO_DB_NAME`: Database name (e.g. `nexalearn`)
- `AUTH_JWT_SECRET`: Secret key for session tokens
- `FRONTEND_URL`: Allowed frontend origin for CORS (e.g. `http://localhost:4200`)
