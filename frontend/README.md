# NexaLearn Frontend Application

Angular 20 Standalone Components application with reactive signals and responsive design.

## 📁 Directory Structure
- `src/`
  - `app/`
    - `core/` - Authentication, Learning API, Course Service, Translation, SEO, Models
    - `features/` - Home, Catalog, Course Details, Dashboard, Workspace, Roadmap, AI Tutor, Sandbox
    - `layout/` - Navbar, Sidebar, Topbar, Footer, Main Layout
    - `shared/` - Reusable components (Course Cards, Buttons, Form controls)
  - `styles.css` - Design tokens, typography, dark/light themes, animations, layout utilities
  - `index.html` - Application HTML shell
  - `main.ts` - Client bootstrap
- `public/` - Favicon, logos, static illustrations
- `angular.json` - Angular CLI build & serve configurations
- `proxy.conf.json` - Local dev server proxy routing `/api` -> `http://localhost:4301`

## 🚀 Running the Frontend
From within the `frontend/` directory:

```bash
# Start frontend development server on http://localhost:4200
npm start

# Run unit test suite (Karma + Jasmine)
npm test

# Build production bundle
npm run build
```
