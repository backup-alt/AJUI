# AJUI — Annai Golden Builders Platform

A construction-management platform with three components:

| App | Path | Purpose | Tech |
|-----|------|---------|------|
| **Web Admin** | `src/` | Admin dashboard (Angular) | Angular 18, TypeScript |
| **Mobile App** | `mobile/` | Supervisor app (iOS/Android) | Ionic + Capacitor + Angular |
| **Backend API** | `backend/` | REST API + MongoDB | Node.js, Express, Mongoose |

---

## Quick Start

### 1. Web (Admin)
```bash
npm install
npm start               # http://localhost:4200
```

### 2. Mobile (Supervisor)
```bash
cd mobile
npm install
npx ng build
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env     # fill in values
npm run dev              # http://localhost:4000
```

---

## Repository Layout

```
AJUI/
├── src/                    # WEB admin (Angular)
│   ├── app/                # pages, components, services
│   ├── assets/             # images, static
│   ├── data/               # mock data
│   ├── environments/       # dev/prod config
│   ├── main.ts
│   └── styles.css
│
├── mobile/                 # MOBILE supervisor app (Ionic/Capacitor)
│   ├── src/
│   │   └── app/            # pages, components, services
│   ├── android/            # native Android project
│   ├── www/                # web build output
│   ├── angular.json
│   ├── capacitor.config.json
│   └── package.json
│
├── backend/                # BACKEND API (Node/Express)
│   ├── src/
│   │   ├── app.ts          # Express setup
│   │   ├── config/         # env, email, firebase
│   │   ├── controllers/    # request handlers
│   │   ├── middleware/     # auth, error
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routes
│   │   ├── schemas/        # Zod validation
│   │   ├── services/       # business logic
│   │   └── utils/          # helpers
│   ├── __tests__/          # Jest tests
│   ├── .env
│   ├── jest.config.js
│   └── package.json
│
├── render.yaml             # Render.com deploy config
├── DEPLOYMENT.md           # deploy guide
├── angular.json            # web build config
├── package.json            # web dependencies
├── tsconfig.json
└── index.html
```

---

## Deployment

- **Web** → Static site (Render, Vercel, Netlify)
- **Backend** → Render Web Service (see `render.yaml`)
- **Mobile** → Build APK locally, distribute via Play Store / direct

See `DEPLOYMENT.md` for full instructions.

---

## Environment Variables

### Backend (`.env`)
| Key | Required | Description |
|-----|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection |
| `JWT_ACCESS_SECRET` | ✅ | Min 16 chars |
| `JWT_REFRESH_SECRET` | ✅ | Min 16 chars |
| `RESEND_API_KEY` | ✅ | Resend email API |
| `RESEND_FROM_EMAIL` | ✅ | e.g. `AGB <noreply@annaigoldenbuilders.online>` |
| `NODE_ENV` | — | `development` / `production` |
| `PORT` | — | default 4000 |

### Web (`src/environments/`)
- `environment.ts` — dev
- `environment.prod.ts` — production

### Mobile (`mobile/src/environments/`)
- `environment.ts` — dev (localhost)
- `environment.prod.ts` — production (Render URL)

---

## Code Conventions

- **TypeScript strict mode** everywhere
- **Services** for API calls, **pages** for views (no logic in templates)
- **Schemas** (Zod) validate request bodies in backend
- **Standalone components** in mobile (Ionic 6+)

---

## Main Flows

1. **Admin creates supervisor invite** (web) → QR code generated
2. **Supervisor scans QR** (mobile) → email OTP sent
3. **Supervisor verifies OTP + sets password** (mobile) → account active
4. **Existing supervisors** (mobile) → log in with phone + password
5. **Admin deactivates supervisor** (web) → user marked `deactivatedAt`

---

## Support

See `DEPLOYMENT.md` for environment setup, deployment steps, and troubleshooting.
