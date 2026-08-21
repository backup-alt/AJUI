# Annai Golden Builders (AGB) Operations Workspace

A full-stack construction/real-estate project management platform for **Annai Golden Builders**, enabling administrators, project managers, accountants, and site supervisors to manage clients, projects, materials, labour, expenses, payments, subcontractors, purchase orders, quotations, invoices, and approvals from a single system.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Build & Deployment](#build--deployment)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Mobile App](#mobile-app)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Business Modules

- **Clients** - Client management with workspace and project summaries
- **Projects** - Project tracking with status management (Active/On Hold/Completed), financial summaries, and ledgers
- **Sites** - Site management with opening balances and material tracking
- **Materials** - Material requests with approval workflow, vendor assignment, and stock tracking
- **Inventory** - Site-level inventory initialization and tracking with missing materials detection
- **Labour** - Worker management, daily attendance, attendance reports, and weekly summaries
- **Expenses** - Site and general expenses with approval workflow and custom fields
- **Payments** - Client payment tracking (Cash, UPI, Bank Transfer, NEFT, etc.)
- **Subcontractors** - Subcontractor management, labor records, and payment tracking
- **Purchase Orders** - PO creation with line items, GST calculation, and GST rate management
- **Quotations** - Quotation creation and management
- **Tax Invoices** - Invoice creation with GST and PDF generation
- **Approvals** - Pending approvals dashboard with approve/reject actions across all entity types

### Authentication & Authorization

- JWT-based authentication with access/refresh token rotation
- Login via email/phone + password
- Forgot password flow (email-based reset link)
- QR code invitation flow for new supervisors
- Employee invite flow (email link -> signup with role assignment)
- Access schedule restrictions (time-based access control)
- Session management (list, revoke, revoke-all)
- Role-based access control (Admin, Project Manager, Accountant, Supervisor) with granular permissions.

### Settings

- Account management (name, phone, password)
- Company profile
- Notification preferences (push, single-approval consolidation)
- Role and permission management (per-employee granularity)
- Site management
- Access schedule configuration
- Session management (device list, revoke)
- Appearance preferences (theme, density, font size)

## Tech Stack

### Frontend (Web Admin Dashboard)

- **Angular 20** with standalone components and OnPush change detection
- **Ionic 8** (Angular) for UI components
- **TypeScript ~5.8**
- **RxJS ~7.8** with signals-based reactive state
- **ExcelJS** for Excel export
- **html2canvas + jsPDF** for PDF generation
- **Ionicons** for iconography

### Mobile App (Supervisor)

- **Angular 20.3** + **Ionic 8** + **Capacitor 8**
- Capacitor plugins: Barcode Scanner (QR), Push Notifications, Preferences, Haptics, Network, Splash Screen
- Standalone components with Angular signals

### Backend API

- **Node.js** with **Express 4**
- **TypeScript 5.5** with **tsx** for development
- **MongoDB** via **Mongoose 8.5**
- **JWT** authentication (access + refresh tokens)
- **bcrypt** for password hashing
- **Zod** for request validation
- **Helmet** for security headers
- **Rate limiting** (1500 req/15 min window)
- **Firebase Admin SDK** for push notifications
- **Resend** and **Nodemailer (Gmail)** for transactional email
- **Swagger** for API documentation
- **QR code** generation via `qrcode` package
- **pCloud** service for media/image storage

## Project Structure

```
ajui/
├── src/                          # Web admin Angular/Ionic application
│   ├── app/
│   │   ├── core/                 # Services, auth interceptor, guards, data mappers
│   │   ├── pages/                # Routed page components (16 pages)
│   │   │   └── settings/         # Settings sub-pages (12 components)
│   │   └── shared/               # Reusable UI components (12 components)
│   ├── data/                     # ErpDataService - shared data access layer
│   ├── environments/             # Dev and production environment configs
│   └── assets/                   # Static assets (logos, icons)
│
├── backend/                      # Express/MongoDB REST API
│   ├── src/
│   │   ├── config/               # Environment, database, email, Firebase, Swagger
│   │   ├── routes/               # 12 route files
│   │   ├── controllers/          # 12 controller files matching routes
│   │   ├── services/             # 34 service files
│   │   ├── models/               # 35 Mongoose models
│   │   ├── middleware/            # Auth, RBAC, validation, caching, error handler
│   │   ├── schemas/              # Zod validation schemas
│   │   └── utils/                # Seed utilities, ID generators
│   └── __tests__/                # Jest test files
│
├── mobile-supervisor/            # Active Ionic/Capacitor mobile app (Angular 20)
│   ├── src/
│   │   ├── app/
│   │   │   ├── features/         # Feature modules (auth, dashboard, labour, etc.)
│   │   │   ├── core/             # Services, guards, interceptors
│   │   │   └── layout/           # Tab-based shell layout
│   │   ├── android/              # Native Android project
│   │   └── ios/                  # Native iOS project
│   └── ...
│
├── mobile/                       # Legacy Ionic/Capacitor mobile app (Angular 18)
│
├── .github/workflows/            # CI/CD pipelines
├── render.yaml                   # Render.com deployment configuration
└── AGENTS.md                     # Repository guidelines
```

## Getting Started

### Prerequisites

- **Node.js 24** (or 18+ for Angular 20)
- **MongoDB 7** (or MongoDB Atlas for production)
- **Java JDK 17+** (for Android builds)
- **Android SDK + platform-tools** (for mobile APK builds)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ajui.git
   cd ajui
   ```

2. **Install web frontend dependencies**
   ```bash
   npm ci
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm ci
   ```

4. **Install mobile app dependencies**
   ```bash
   cd mobile-supervisor
   npm ci
   ```

### Environment Setup

1. Copy `backend/.env.example` to `backend/.env`
2. Configure the environment variables (see [Environment Variables](#environment-variables))

### Running the Applications

**Web Frontend:**
```bash
npm run dev
# Access at http://127.0.0.1
```

**Backend API:**
```bash
cd backend
npm run dev
# API runs at http://localhost:4000/api
```

**Mobile App:**
```bash
cd mobile-supervisor
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

## Development

### Web Frontend Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on 127.0.0.1 |
| `npm run build` | Production build to `dist/` |
| `npm run build:pages` | GitHub Pages build with `/AJUI/` base-href |
| `npm run serve:dist` | Serve built output locally |

### Backend Commands

| Command | Description |
|---------|-------------|
| `cd backend && npm run dev` | Start watched API server |
| `cd backend && npm run build` | TypeScript type-check |
| `cd backend && npm start` | Production start |
| `cd backend && npm test` | Jest tests (in-band, with MongoDB) |
| `cd backend && npm run test:coverage` | Tests with coverage report |

### Mobile App Commands

| Command | Description |
|---------|-------------|
| `cd mobile-supervisor && npm run build` | Angular build to `www/` |
| `cd mobile-supervisor && npx cap sync android` | Sync to native Android |
| `cd mobile-supervisor && npm run lint` | ESLint |
| `cd mobile-supervisor && npm test` | Jasmine/Karma unit tests |

## Build & Deployment

### CI/CD Pipeline

GitHub Actions runs automatically on push/PR to `main`:
- **Backend**: typecheck + Jest tests against MongoDB 7
- **Mobile**: typecheck + ESLint + Karma tests (continue-on-error)
- **Frontend**: GitHub Pages deployment

### Deployment

- **Frontend**: GitHub Pages (via `deploy-pages.yml`)
- **Backend**: Render.com (auto-deploy from main branch)
- **Mobile**: Manual APK build from `mobile-supervisor/`

### Render.com Configuration

The backend is deployed on Render.com free tier with:
- Starter plan, Oregon region
- Keep-alive ping every 10 minutes to prevent cold start spin-down
- MongoDB Atlas M0 free tier for database

## API Documentation

The backend API includes Swagger documentation accessible at:
```
http://localhost:4000/api-docs
```

### API Endpoints

The API is organized into 12 route modules:
- `auth` - Authentication and token management
- `admin` - Admin-specific operations
- `entities` - Core business entities (clients, projects, sites, etc.)
- `financial` - Financial operations (payments, expenses, etc.)
- `dashboard` - Dashboard data and KPIs
- `mobile` - Mobile-specific endpoints
- `rbac` - Role-based access control
- `vendor-extra` - Vendor management
- `quotation` - Quotation operations
- `invoice` - Invoice operations
- `company-profile` - Company profile management
- `media` - Media upload and management

## Environment Variables

### Backend Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `RESEND_API_KEY` | Resend email API key |
| `GMAIL_USER` | Gmail SMTP username |
| `GMAIL_APP_PASSWORD` | Gmail SMTP app password |
| `FRONTEND_URL` | Web app URL for CORS/redirects |
| `BACKEND_PUBLIC_URL` | Backend's public URL |
| `QR_BASE_URL` | Base URL for QR code links |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase client email |
| `ADMIN_EMAIL` | Default admin email |
| `ADMIN_PASSWORD` | Default admin password |
| `ADMIN_NAME` | Default admin name |
| `ADMIN_PHONE` | Default admin phone |
| `NODE_ENV` | `production` or `development` |
| `PORT` | Server port (default: 4000) |

## Mobile App

### Supervisor Mobile App Features

- **Dashboard** - Site summary and quick actions
- **Material Requests** - Submit requests with approval workflow
- **Labour Management** - Attendance tracking and worker management
- **Expense Logging** - Record expenses with categories
- **Inventory Viewing** - Check site inventory levels
- **Photo Capture** - Capture and upload photos
- **Push Notifications** - Real-time alerts via FCM
- **QR Code Scanning** - Onboarding via QR codes
- **Offline Support** - Token persistence for offline capability

### Building APK

```bash
cd mobile-supervisor
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK will be located at:
```
mobile-supervisor/android/app/build/outputs/apk/debug/app-debug.apk
```

## Architecture Notes

- The web frontend is a single-page application using hash-based routing
- The `workspace-hydration.service.ts` pre-fetches all data on login and caches snapshots in localStorage for fast page loads
- All three apps (web, mobile-supervisor, backend) share the same backend API
- The `mobile/` directory is a legacy project; `mobile-supervisor/` is the actively developed mobile app

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Guidelines

- Use short, imperative summaries (e.g., "Add Notes textarea...")
- Keep each commit to one logical change
- Run relevant builds and tests before review

### Pull Request Guidelines

- Describe behavior and affected apps
- Identify migration needs
- Link the issue
- Include screenshots for UI changes

## License

This project is proprietary software for Annai Golden Builders. All rights reserved.

## Support

For support and questions, please contact the development team or create an issue in the repository.
