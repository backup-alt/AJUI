# AGB Supervisor - Mobile App

Capacitor-based Android app for site supervisors.

## Build the APK

Prerequisites (one-time setup):
- Java JDK 17+ (set `JAVA_HOME`)
- Android SDK + platform-tools (set `ANDROID_HOME`)
- Gradle (bundled via wrapper)

Build steps:
```bash
cd mobile-supervisor
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## Features

- Login (OTP-based for supervisors, password for admins)
- Dashboard with site summary
- Material requests, expenses, labour, subcontractor, payments
- Photo capture and upload (camera/gallery)
- Push notifications (FCM)
- QR code scanning for invite/setup
- Password reset via email

## Tech Stack

- Ionic 8 + Angular 18 (standalone components)
- Capacitor 6
- Native plugins: Camera, Preferences, Push, Haptics, BarcodeScanner
