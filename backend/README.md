# AI Learning Platform - Backend API (Supabase & Express)

A high-performance, secure backend API for the **NexaLearn AI Learning Platform**, built with **Node.js, Express, and Supabase (PostgreSQL)**.

---

## 🚀 Features

- **Database**: Connected to **Supabase PostgreSQL** via connection pooling (`pg`).
- **Authentication**:
  - Dual support for **HTTP-Only Secure Cookies** (`nexalearn_session`) and **Bearer Tokens** (`Authorization: Bearer <token>`).
  - Secure password hashing using cryptographic `scrypt` and `bcrypt`.
  - Roles: `student`, `teacher`, `admin`.
- **Courses**:
  - Full CRUD operations with curriculum modules, lessons, levels, and status (`draft` / `published`).
  - Search (`q` / `search`), category filtering, level filtering, and pagination.
- **Student Workspace**:
  - Enrolling in published courses.
  - Tracking course progress (0–100%) and automatic completion.
  - Overall student progress analytics.
- **Teacher Workspace**:
  - Course curriculum authoring and management.
  - Teacher analytics: course counts, enrolled students, completed enrollments.
- **Admin Console**:
  - Platform-wide statistics (users, courses, enrollments).
  - User status management (`active` / `suspended`).
  - User role assignment (`student` / `teacher`).
  - Audit logging.
- **Security & Optimization**:
  - Helmet security headers.
  - CORS with credentials support for frontend (`http://localhost:4200`, `http://localhost:5173`, and Vercel domains).
  - Rate limiting on authentication routes.
- **Deployment Ready**:
  - Configured for 1-click **Vercel** serverless deployment (`vercel.json` + `api/index.js`).
  - Works seamlessly with the Angular frontend (`AI-LEARNING-PLATFORM-PROJECT`).

---

## 📋 Environment Variables (.env)

Create a `.env` file in the root directory (or use `.env.example` as a template):

```env
PORT=4301
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<host>:5432/postgres
AUTH_JWT_SECRET=your-random-32-byte-secret-key-here
JWT_SECRET=your-random-32-byte-secret-key-here
FRONTEND_URL=http://localhost:4200
NODE_ENV=development
```

> **Note for Supabase on Vercel**: Use the **Transaction Pooler** connection string (port `6543`) for serverless deployments, and the **Session Pooler** (port `5432`) for local long-running servers.

---

## 🛠️ Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```
   Or for auto-reloading during development:
   ```bash
   npm run dev
   ```

3. **Verify the server is running**:
   - Health Check: `http://localhost:4301/api/health`
   - Course Catalog: `http://localhost:4301/api/courses`

---

## 🔗 Integration with Frontend

The Angular frontend (`AI-LEARNING-PLATFORM-PROJECT`) is configured with a proxy (`proxy.conf.json`) forwarding `/api` to `http://localhost:4301`.
When both are running locally:
1. Start backend: `npm start` (in `AI-LEARNING-PLATFORM-BACKEND` on port 4301)
2. Start frontend: `npm start` (in `AI-LEARNING-PLATFORM-PROJECT` on port 4200)
3. Navigate to `http://localhost:4200/` and sign in or browse courses.

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel Dashboard](https://vercel.com):
   - Click **Add New Project** -> **Import Git Repository**.
   - Select your backend repository.
   - Leave the Framework Preset as default or Other.
   - Under **Environment Variables**, add:
     - `DATABASE_URL`: Your Supabase connection string.
     - `AUTH_JWT_SECRET`: Random 32+ byte string.
     - `JWT_SECRET`: Same as `AUTH_JWT_SECRET`.
     - `FRONTEND_URL`: Your deployed frontend URL (e.g. `https://your-frontend.vercel.app`).
     - `NODE_ENV`: `production`
   - Click **Deploy**.

---

## 📡 API Endpoints Overview

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | System & Supabase database status |
| `POST` | `/api/auth/register` | Public | Register student or teacher |
| `POST` | `/api/auth/login` | Public | Login (returns session cookie & token) |
| `GET` | `/api/auth/me` | Authenticated | Get current logged-in profile |
| `POST` | `/api/auth/logout` | Public | Clear session cookie |
| `GET` | `/api/courses` | Public | Browse published courses (search & filter) |
| `GET` | `/api/courses/:id` | Public | Get single course details |
| `GET` | `/api/me/enrollments` | Student | List student enrollments |
| `POST` | `/api/me/enrollments` | Student | Enroll in course |
| `PATCH` | `/api/me/enrollments/:id/progress` | Student | Update learning progress (0-100) |
| `GET` | `/api/me/progress` | Student | Overall enrolled and completed stats |
| `GET` | `/api/teacher/courses` | Teacher | List instructor courses |
| `GET` | `/api/teacher/overview` | Teacher | Instructor stats (learners & completions) |
| `POST` | `/api/teacher/courses` | Teacher | Create new course draft |
| `PUT` | `/api/teacher/courses/:id` | Teacher | Update course curriculum |
| `PATCH` | `/api/teacher/courses/:id/status` | Teacher | Publish or unpublish course |
| `DELETE` | `/api/teacher/courses/:id` | Teacher | Delete draft course |
| `GET` | `/api/admin/overview` | Admin | Platform overview metrics |
| `GET` | `/api/admin/users` | Admin | User management with filters |
| `PATCH` | `/api/admin/users/:id/status` | Admin | Suspend or activate user |
| `PATCH` | `/api/admin/users/:id/role` | Admin | Change user role |
| `GET` | `/api/admin/audit-log` | Admin | View administrative audit logs |
