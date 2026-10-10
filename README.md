# NexaLearn AI

NexaLearn is an Angular learning platform with server-side rendering (SSR), an Express API, and Supabase PostgreSQL-backed accounts, courses, enrollments, progress, and administration. The API stores the existing record shapes in a PostgreSQL JSONB document table and applies filters, ordering, counts, uniqueness rules, and updates in PostgreSQL.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Production SSR

Build the browser and server bundles, then run the generated SSR server. In production, the API and application are served from the same origin:

```bash
npm run build
npm run serve:ssr:ai-learning-platform
```

The SSR host allowlist in `angular.json` includes local development hosts. Add the production hostname to `security.allowedHosts` before deploying.

## Deploy to Vercel

This repository deploys the Angular browser build as a static site and the Express API as a Vercel Node.js Function. The `/api/*` function uses the same Express app as the local backend, and the SPA rewrite supports direct navigation to client-side routes. The function is placed in Vercel's Dublin region (`dub1`), close to the Supabase `eu-west-1` database.

1. Push this repository to GitHub, then import it in Vercel. Keep the project root set to this repository's root. Vercel reads `vercel.json`; the build command is `npm run build` and the output directory is `dist/ai-learning-platform/browser`.
2. In **Project Settings → Environment Variables**, add these for Production (and Preview if you want preview deployments to access a separate test database):
   - `DATABASE_URL`: Supabase PostgreSQL connection string from the **Transaction pooler** section (port `6543`), designed for serverless functions. URL-encode special password characters. Keep the session pooler on port `5432` for a persistent local backend.
   - `AUTH_JWT_SECRET`: a unique random secret of at least 32 bytes. Generate a value locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
   - `DATABASE_POOL_SIZE`: `1` to limit connections from serverless instances. The application defaults to one connection when it detects Vercel.
3. Confirm the Supabase project's database network access permits connections from Vercel. Do not enable demo seeding in production. Set up the first administrator separately with the one-off `npm run create:admin` script pointed at the production database, or provision it through a secure database workflow.
4. Deploy. Check `/api/health` on the deployed domain; it should report a healthy database and auth configuration. Vercel's function logs contain request IDs and errors for diagnosis.

`.env` and `.demo-credentials.txt` are excluded from Git and Vercel uploads. Set secrets in Vercel's Environment Variables dashboard; never commit them to `vercel.json`. Preview deployments should use a non-production database and a separate auth secret. The API sets secure session cookies automatically when `NODE_ENV=production`.

## Local backend setup

1. Create a Supabase project and copy its PostgreSQL connection string (use the session pooler for a long-running backend). URL-encode special characters in the password, such as `@` as `%40`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` and create a unique authentication secret (at least 32 bytes), for example:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

   Put the generated value in `AUTH_JWT_SECRET`. Keep `.env` private; it is ignored by Git.
3. In one terminal, start the API:

   ```bash
   npm run backend:dev
   ```

   For a disposable development database, load repeatable sample users, courses, and enrollments with:

   ```bash
   npm run seed:demo
   ```

   The script creates demo accounts for `demo.teacher@nexalearn.test` and `demo.student@nexalearn.test`, publishes three example courses, and gives the student active and completed enrollments. Newly generated passwords are saved to `.demo-credentials.txt`, which is ignored by Git. The seed script refuses to run when `NODE_ENV=production` unless `DEMO_SEED_ENABLED=true` is explicitly set.

4. In another terminal, start Angular:

   ```bash
   npm start
   ```

   Angular proxies `/api` to the local API at port 4301. The API creates its PostgreSQL table and indexes on first connection. `/api/health` checks database connectivity and authentication-secret configuration.

Students and teachers can register through `/api/auth/register`. Passwords must be 12–128 characters. Admins cannot self-register; provision an initial admin account from the same `.env` configuration:

```bash
$env:ADMIN_NAME="Platform Admin"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="use-a-unique-password-of-12-characters-minimum"
npm run create:admin
```

Account sessions use signed, HTTP-only, same-site cookies; the API never returns or stores a browser-readable token. `/api/auth/me` restores the current account, and role-aware route guards restrict student, teacher, and admin workspaces. Backend endpoints must still enforce authorization before exposing or changing data; frontend guards are only a user-experience layer.

### API endpoints

All API responses use JSON. Successful collection responses return `{ "data": [...], "meta": { "page", "limit", "total", "pages" } }`; single-resource responses use `{ "data": ... }`. Errors use `{ "error": { "code": "...", "message": "..." } }`. Session cookies are HTTP-only and same-site. Protected endpoints require a valid session and enforce the listed role on the server.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health/live` | Public | Process liveness check |
| `GET` | `/api/health` | Public | Readiness check for PostgreSQL and auth configuration |
| `POST` | `/api/auth/register` | Public | Create a student or teacher account |
| `POST` | `/api/auth/login` | Public | Sign in (optional `remember: true`) |
| `GET` | `/api/auth/me` | Session | Restore the current account |
| `POST` | `/api/auth/logout` | Public | Clear the session cookie |
| `GET` | `/api/courses` | Public | List published courses; accepts `page`, `limit`, `q`, `category`, and `level` |
| `GET` | `/api/courses/:courseId` | Public | Read a published course |
| `GET` | `/api/me/enrollments` | Student | List the signed-in student's enrollments |
| `POST` | `/api/me/enrollments` | Student | Enroll using `{ "courseId": "..." }` |
| `PATCH` | `/api/me/enrollments/:enrollmentId/progress` | Student | Set progress using `{ "progress": 0 }` (integer 0–100) |
| `GET` | `/api/me/progress` | Student | Get enrollment and completion totals |
| `GET` | `/api/teacher/courses` | Teacher | List the signed-in teacher's courses |
| `GET` | `/api/teacher/overview` | Teacher | Get course and learner totals |
| `POST` | `/api/teacher/courses` | Teacher | Create a draft course |
| `PUT` | `/api/teacher/courses/:courseId` | Course owner | Replace course details; saves as a draft |
| `PATCH` | `/api/teacher/courses/:courseId/status` | Course owner | Publish or unpublish with `{ "status": "published" }` or `"draft"` |
| `DELETE` | `/api/teacher/courses/:courseId` | Course owner | Delete only a draft course with no enrollments |
| `GET` | `/api/admin/overview` | Admin | Get account, course, and enrollment totals |
| `GET` | `/api/admin/users` | Admin | Paginated/filterable user list (`page`, `limit`, `role`, `status`, `q`) |
| `PATCH` | `/api/admin/users/:userId/status` | Admin | Set `{ "status": "active" }` or `"suspended"` |
| `PATCH` | `/api/admin/users/:userId/role` | Admin | Set `{ "role": "student" }` or `"teacher"` |
| `GET` | `/api/admin/audit-log` | Admin | Read the paginated user-administration audit log |

Course creation/update accepts `title`, `description`, `category`, `level` (`Beginner`, `Intermediate`, or `Advanced`), `duration`, and `modules`. Each module has `title`, integer `lessons`, `duration`, and `topics`. Curriculum size is bounded by the API. Pagination defaults to 20 records and is capped at 100 per page.

Run the backend validation tests with:

```bash
npm run test:api
```

The backend currently targets a modest, long-running Node.js deployment. Tune `DATABASE_POOL_SIZE` for the deployment and monitor PostgreSQL connection counts and API latency. The initial PostgreSQL migration keeps existing API record shapes in JSONB; a future normalized relational schema can add foreign keys and database-level relationships as the data model grows.

Feature screens live under `src/app/features`, reusable UI under `src/app/shared`, application-wide services and models under `src/app/core`, API routes under `src/server`, and navigation components under `src/app/layout`.
