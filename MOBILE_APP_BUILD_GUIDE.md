# Mobile App Build & Deployment Guide

## Issue: "Internet issue" on Mobile Login

### Root Cause
The mobile app shows "Internet issue" when trying to log in because:

1. **Environment mismatch** - The APK was built without `--configuration=production`, causing it to use `environment.ts` (pointing to `localhost:4000`) instead of `environment.prod.ts` (pointing to `https://agb-o3cc.onrender.com/api`)
2. **Backend sleeping** - Render free tier spins down after 15 minutes of inactivity
3. **CORS configuration** - Now fixed to properly allow mobile app requests

### Solution

#### 1. Build APK with Production Configuration

**IMPORTANT**: Always use the `build:apk` npm script, which includes `--configuration=production`:

```bash
cd mobile-supervisor
npm run build:apk
```

This command:
1. Builds Angular app with production config (`ng build --configuration=production`)
2. Replaces `environment.ts` with `environment.prod.ts` (sets API URL to `https://agb-o3cc.onrender.com/api`)
3. Syncs web assets to Android project (`npx cap sync android`)
4. Builds the APK (`gradlew.bat assembleDebug`)

**The APK will be located at:**
```
mobile-supervisor/android/app/build/outputs/apk/debug/app-debug.apk
```

#### 2. Verify Production Build

After building, you can verify the environment by checking the bundled files:

```bash
# Check that www/ contains the production build
cat mobile-supervisor/www/main.*.js | grep -o "https://agb-o3cc.onrender.com"
```

If this returns nothing, the build used the wrong environment.

#### 3. Backend CORS Fix

The backend CORS configuration has been updated to properly allow mobile app requests. Mobile apps (Capacitor/Ionic native) don't send an `Origin` header, so the CORS middleware now explicitly allows requests with no origin in production.

**Changes made to `backend/src/app.ts`:**
- Added comment explaining why no-origin requests are allowed
- Added logging for rejected origins to help with debugging

#### 4. Handling Backend Cold Starts

Render free tier spins down after inactivity. When the backend is sleeping:
- First request will timeout (takes 50+ seconds to spin up)
- Mobile app shows "Internet issue" (status code 0 = network timeout)

**Workarounds:**
1. Keep backend alive with the `/keepalive` endpoint (web app pings every 10 min)
2. Use Render paid tier for always-on backend
3. Add retry logic to mobile app for initial login requests

#### 5. Testing the Fix

1. **Build fresh APK:**
   ```bash
   cd mobile-supervisor
   npm run build:apk
   ```

2. **Install on device:**
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

3. **Wake up backend** (if needed):
   ```bash
   curl https://agb-o3cc.onrender.com/health
   ```

4. **Test login** on mobile device

### Environment Files

**Development** (`mobile-supervisor/src/environments/environment.ts`):
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4000/api',  // ← Local backend
  // ...
};
```

**Production** (`mobile-supervisor/src/environments/environment.prod.ts`):
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://agb-o3cc.onrender.com/api',  // ← Render backend
  // ...
};
```

### Common Mistakes

❌ **WRONG** - Building without production flag:
```bash
ng build
npx cap sync android
cd android && gradlew.bat assembleDebug
```
This uses `environment.ts` (localhost), not `environment.prod.ts`

✅ **CORRECT** - Using the npm script:
```bash
npm run build:apk
```

### Debugging

If login still fails after rebuilding:

1. **Check APK environment:**
   ```bash
   # Extract and inspect the APK
   unzip -p android/app/build/outputs/apk/debug/app-debug.apk assets/www/main.*.js | grep -o "apiUrl.*localhost\|apiUrl.*agb-o3cc"
   ```

2. **Check backend health:**
   ```bash
   curl https://agb-o3cc.onrender.com/health
   ```

3. **Check backend logs** on Render dashboard for CORS errors

4. **Enable Chrome DevTools** on Android device:
   - Open `chrome://inspect` in Chrome on your computer
   - Select the device
   - Inspect WebView to see network errors

### Backend Environment Variables

Ensure Render has these set:
- `MOBILE_APP_URL=*` (allows all mobile origins in production)
- `NODE_ENV=production`
- All other required vars from `backend/.env.example`
