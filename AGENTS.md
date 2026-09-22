# AGENTS.md

## What this is
- Frontend for a UML 2 Class-Diagram modeling web app; it is purely a frontend to an external REST API backend (backend is NOT in this directory).
- Currently a stub: only `src/app/layout.tsx` + `page.tsx` (default "Hello world" page). Features described in README (auth, rooms, collaboration, XMI, AI dictation/photo, Spring Boot export) are planned, not implemented — trust code over README.
- Keep dark and light themes with contrast between elements so it's easy to read. Themes should switch automatically depending on the device settings. Write configs to a separate CSS file and import it when required.

## Commands
- Dev server: `npm run dev` (port 3000)
- Build: `npm run build`
- Lint: `npm run lint` (eslint-config-next)
- Typecheck: `npx tsc --noEmit` — there is NO typecheck script; use this. No test framework is installed.

## Toolchain
- Package manager is npm (package-lock.json) — don't use pnpm/yarn.
- Next.js 14 App Router under `src/app/` (not `app/`), TypeScript 5, Tailwind 3.
