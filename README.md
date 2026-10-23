# NexaLearn AI Platform

Full-Stack AI Learning & Tutoring Platform featuring an Angular 20 Frontend and an Express + MongoDB Atlas Backend.

---

## 🗂️ Project Architecture & Folder Separation

The project is cleanly decoupled into two dedicated folders:

```
AI-LEARNING-PLATFORM-PROJECT/
├── backend/                  # 🟢 All Backend & API Files
│   ├── src/
│   │   ├── app.ts            # Express application, CORS, Helmet, JSend middleware
│   │   ├── server.ts         # Server entrypoint (listening on http://localhost:4301)
│   │   ├── database.ts       # MongoDB Atlas connection pool & collections
│   │   ├── auth-api.ts       # Authentication routes, session cookies, RBAC
│   │   ├── domain-api.ts     # Courses, enrollments, teacher overview, grading
│   │   ├── api-errors.ts     # Error handling middleware
│   │   ├── validation.ts     # Request validation & pagination
│   │   └── jsend.ts          # Standardized JSend response formatter
│   ├── scripts/
│   │   ├── seed-demo.mjs     # Demo records generator
│   │   └── create-admin.mjs  # Admin user creation
│   ├── tests/                # Backend API tests (Node.js test runner)
│   ├── package.json          # Backend dependencies & scripts
│   ├── tsconfig.json         # Backend TypeScript config
│   ├── .env                  # Backend environment secrets
│   └── README.md             # Backend documentation
│
├── frontend/                 # 🔵 All Frontend & UI Files
│   ├── src/
│   │   ├── app/              # Angular components, signals, routes, layout
│   │   ├── main.ts           # Client bootstrap
│   │   ├── styles.css        # Design tokens & responsive styles
│   │   └── index.html        # HTML shell
│   ├── public/               # Static assets & icons
│   ├── angular.json          # Angular CLI build & serve config
│   ├── proxy.conf.json       # Proxy forwarding /api -> http://localhost:4301
│   ├── package.json          # Frontend dependencies & scripts
│   ├── tsconfig.json         # TypeScript config
│   └── README.md             # Frontend documentation
│
├── scripts/
│   └── dev.mjs               # Orchestrator to run backend & frontend together
├── package.json              # Monorepo root workspace config
└── render.yaml / vercel.json # Production cloud deployment blueprints
```

---

## 🚀 Running the Project

### Option A: Run Both Together from Root
From the project root directory:

```bash
# Starts both Backend (port 4301) and Frontend (port 4200) concurrently
npm start

# Run all unit tests
npm test

# Run backend API tests
npm run test:api

# Build production bundle
npm run build
```

---

### Option B: Run Backend Separately
```bash
cd backend

# Start development server with live watch
npm run dev

# Run backend tests
npm test

# Seed demo users and data
npm run seed
```

Backend will be active at `http://localhost:4301`.

---

### Option C: Run Frontend Separately
```bash
cd frontend

# Start Angular development server
npm start

# Run Karma unit tests
npm test

# Build production static bundle
npm run build:static
```

Frontend will be active at `http://localhost:4200` (automatically proxying `/api` to `http://localhost:4301`).
