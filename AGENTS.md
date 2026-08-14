# Repository Guidelines

## Project Structure & Module Organization

The root Angular/Ionic application lives in `src/`. Put screens in `src/app/pages`, reusable UI in `src/app/shared`, and services, guards, and interceptors in `src/app/core`. Static files belong in `src/assets`; API settings are in `src/environments`.

The Express/MongoDB API is under `backend/src`, organized by routes, controllers, services, models, middleware, and configuration. Tests live in `backend/__tests__`. `mobile-supervisor/` is the CI-tested Ionic/Capacitor app; `mobile/` is a separate legacy project. Treat `dist/`, `.angular/`, APKs, and dependency directories as generated output.

## Build, Test, and Development Commands

- `npm ci` - install root dependencies from the lockfile.
- `npm run dev` - serve the web app on `127.0.0.1`.
- `npm run build` - create the production web bundle under `dist/`.
- `cd backend && npm ci && npm run dev` - install and run the watched API.
- `cd backend && npm run build` - type-check backend TypeScript.
- `cd backend && npm test` - run Jest/Supertest tests against test MongoDB.
- `cd mobile-supervisor && npm ci && npm run build` - install and build the supervisor app.
- `cd mobile-supervisor && npm run lint` - run Angular ESLint.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes in TypeScript, and trailing commas in multiline declarations. Strict TypeScript and Angular templates are enabled; fix errors instead of weakening compiler options. Prefer standalone components and `inject()`. Use `PascalCase` for classes, `camelCase` for variables, and kebab-case filenames with role suffixes, such as `auth.routes.ts` and `dashboard.controller.ts`.

## Testing Guidelines

Backend tests use Jest, `ts-jest`, and Supertest. Name them `*.test.ts` inside `backend/__tests__`; use `npm run test:coverage` for coverage. Mobile unit tests use Jasmine/Karma and `*.spec.ts`. CI requires backend tests plus mobile type-checking and linting. Add focused tests for authentication, permissions, validation, and service behavior.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries such as `Add Notes textarea...`. Keep each commit to one logical change. Pull requests should describe behavior and affected apps, identify migration needs, link the issue, and include screenshots for UI changes. Run relevant builds and tests before review.

## Security & Configuration

Copy `backend/.env.example` for local configuration. Never commit `.env` files, credentials, tokens, APKs, or generated builds. Use a dedicated test database through `MONGODB_TEST_URI`; do not point automated tests at production data.
