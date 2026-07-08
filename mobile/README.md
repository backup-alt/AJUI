# Mobile Supervisor App (Ionic + Capacitor)

Cross-platform mobile app for **AGB supervisors** — scan invite QR, complete signup, log in, manage daily site activities.

## Stack
- Ionic 6 (standalone components)
- Angular 18
- Capacitor 6 (Android + iOS)
- `@capacitor-mlkit/barcode-scanning` (QR scanner)

## Run (development)

```bash
npm install
npx ng serve --host 0.0.0.0 --port 8100
# → http://localhost:8100
```

## Build APK

```bash
npx ng build                    # → www/
npx cap sync android            # copy assets to android/
cd android
./gradlew assembleDebug         # → app/build/outputs/apk/debug/app-debug.apk
```

## Release APK

```bash
cd android
./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release-unsigned.apk
```

## Screens

| Page | Purpose |
|------|---------|
| `LoginPage` | Welcome → scan QR / log in (phone+password) |
| `HomePage` | Dashboard with assigned projects |
| `ProjectsPage` | List of projects supervisor handles |
| `ProjectDetailPage` | Site info, materials, labour, expenses |
| `ApprovalsPage` | Pending approvals |
| `MaterialsPage` | Log material requests |
| `LabourPage` | Daily attendance |
| `ProfilePage` | View/edit supervisor profile |

## Auth flow

1. **New supervisor** (first time):
   - Admin creates invite in web → QR code
   - Supervisor scans QR → backend verifies token
   - OTP sent to email (via Resend)
   - Supervisor enters OTP + sets password
   - Account activated → redirected to Home

2. **Existing supervisor** (returning):
   - Welcome screen → tap "Already have an account?"
   - Enter phone + password → logged in
   - Session stored in Capacitor Preferences (JWT)

## Configuration

`mobile/src/environments/environment.prod.ts`:
```ts
export const environment = {
  production: true,
  backendUrl: 'https://agb-o3cc.onrender.com',
  // ...
};
```

## Layout

```
mobile/
├── src/
│   ├── app/
│   │   ├── core/            # services, guards, models
│   │   ├── pages/           # routed page components
│   │   ├── shell/           # tabs, header
│   │   └── app.routes.ts
│   ├── environments/        # dev / prod
│   ├── global.scss
│   ├── main.ts
│   └── index.html
├── android/                 # native Android (auto-generated)
├── resources/               # icons, splash
├── angular.json
├── capacitor.config.json
├── ionic.config.json
└── package.json
```
