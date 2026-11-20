# EduConnect360

A school LMS (learning management system) web app for managing classes, students, and attendance, backed by Firebase (Auth, Firestore, Storage).

## Run & Operate

- `pnpm --filter @workspace/educonnect360 run dev` — run the EduConnect360 frontend (via its managed workflow)
- `pnpm --filter @workspace/api-server run dev` — run the shared API server (not currently used by EduConnect360; Firebase is the backend)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env (already set, public Firebase web config — safe to expose client-side): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend artifact: React + Vite (`artifacts/educonnect360`), Tailwind CSS, Inter font, Font Awesome icons (CDN)
- Backend: Firebase (Auth, Firestore, Storage) — no custom server/database used for this artifact
- Shared `artifacts/api-server` (Express) and Postgres `lib/db` exist in the workspace but are unused by EduConnect360 so far

## Where things live

- `artifacts/educonnect360/src/lib/firebase.ts` — Firebase app/auth/firestore/storage initialization, reads `VITE_FIREBASE_*` env vars
- `artifacts/educonnect360/src/lib/firestore.ts` — all Firestore reads/writes (users, classes, sessions, attendance) — pages never call the Firestore SDK directly
- `artifacts/educonnect360/src/contexts/AuthContext.tsx` — Firebase Auth session + Firestore user profile (role) provider, exposes `useAuth()`
- `artifacts/educonnect360/src/components/protected-route.tsx` — route guard by role (`teacher` | `student`)
- `artifacts/educonnect360/src/types.ts` — domain types: `User`, `Class`, `ClassSession`, `Attendance`
- `artifacts/educonnect360/src/index.css` — theme tokens (green/white palette) + `.glass-panel` glassmorphism utility
- `artifacts/educonnect360/src/pages/` — `login`, `register`, `teacher-home` (class list + create), `teacher-class` (QR session + live dashboard), `student-home` (join by code), `student-class` (scan/check-in)
- `artifacts/educonnect360/src/App.tsx` — app shell/router (wouter), wraps routes in `AuthProvider`

## Architecture decisions

- Chose React + Vite over Next.js App Router (not a supported artifact type on this platform) to keep full platform preview/deploy support; folder/naming conventions were adapted (`src/lib/firebase.ts`, `src/types.ts`, `src/components/`) to match the user's requested structure as closely as possible.
- Firebase client config values are public identifiers, so they're stored as plain env vars (not secrets) and read via `VITE_FIREBASE_*`.
- No custom backend/database wired up yet — Firestore is the data store for `users`/`classes`/`sessions`/`attendance`.
- Class join codes are random 6-digit strings checked for collisions against other classes' `joinCode` field at creation time (retried up to 5x).
- Attendance sessions are one-per-class-per-day docs in a top-level `sessions` collection; the QR code encodes `EDUCONNECT360:<classId>:<sessionId>`. Student check-in is a mocked "scan" button (no camera) that writes directly to Firestore — no live camera QR scanning yet.
- Class "cover" is a picker over 6 preset green-toned gradients (no file upload to Storage) — keeps class creation fast and avoids depending on Storage security rules for a core flow.
- Attendance rate on the teacher dashboard is computed as `totalCheckins / (totalSessions * rosterSize)` across all historical sessions for the class, read fresh (not cached) each time the class page loads; today's session count is live via `onSnapshot`.

## Product

- Auth: real Firebase email/password login & registration with role selection (teacher/student), profile stored in Firestore `users`.
- Teacher: create classes (subject, grade level, cover), see auto-generated 6-digit join code, start a daily attendance session that renders a QR code, and a real-time dashboard (live check-in count, roster size, historical attendance rate).
- Student: join a class via 6-digit code, view joined classes, and check in to today's session via a "scan" button (mocked camera, real Firestore write with duplicate-checkin protection).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Firebase env vars use the `VITE_` prefix (not `NEXT_PUBLIC_`) since the app runs on Vite, not Next.js.
- Firestore/Storage security rules live in the Firebase console, not in this repo — if writes start failing with `permission-denied`, the fix is in Firebase console rules, not the app code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
