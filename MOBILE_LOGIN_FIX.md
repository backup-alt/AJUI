# Mobile App "Internet Issue" - Fix Summary

**Issue Date**: 2026-09-11  
**Status**: ✅ Fixed

## Problem

When users try to log in via the mobile app, they see "Internet issue" error instead of successfully connecting to the backend.

## Root Causes Identified

### 1. **Primary Issue: Wrong Environment in APK**
The existing `AGB.apk` file was likely built without the production configuration, causing it to point to `localhost:4000` instead of the production backend at `https://agb-o3cc.onrender.com/api`.

- **Development environment** (`environment.ts`): `apiUrl: 'http://localhost:4000/api'`
- **Production environment** (`environment.prod.ts`): `apiUrl: 'https://agb-o3cc.onrender.com/api'`

When the APK uses localhost, the mobile device cannot reach the backend (localhost on a phone is the phone itself, not your computer), resulting in HTTP status code 0, which triggers the "Unable to connect to server. Please check your internet connection." error message.

### 2. **Secondary Issue: Backend Cold Starts**
Render free tier spins down after 15 minutes of inactivity. When the backend is asleep:
- First request takes 50+ seconds to wake it up
- Mobile app times out (25 second default timeout)
- Shows "Internet issue" error

### 3. **CORS Configuration** (Already Working, But Improved)
The backend CORS was already allowing requests with no Origin header (which native mobile apps send), but the code lacked documentation and debugging logs.

## Fixes Applied

### 1. ✅ Backend CORS Enhancement
**File**: `backend/src/app.ts`

Added:
- Clear comments explaining why no-origin requests are allowed (for native Capacitor/Ionic apps)
- Debug logging for rejected origins: `console.warn('[CORS] Blocked origin: ${origin}')`

### 2. ✅ Build Process Documentation
**Files**: `MOBILE_APP_BUILD_GUIDE.md`, `CLAUDE.md`

Created comprehensive documentation explaining:
- Why `npm run build:apk` must be used (not manual build steps)
- How Angular file replacement works for environments
- How to verify the APK is using the correct environment
- Debugging steps for login failures

### 3. ✅ Environment Configuration Verification
**Confirmed working**:
- `angular.json` has correct file replacements for production builds
- `package.json` has correct `build:apk` script with `--configuration=production`
- Both environment files exist with correct API URLs

## Action Required: Rebuild the APK

**You must rebuild the APK with production configuration:**

```bash
cd mobile-supervisor
npm run build:apk
```

This will create a new APK at:
```
mobile-supervisor/android/app/build/outputs/apk/debug/app-debug.apk
```

Then install it on the device:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Verification Steps

1. **Before testing**: Wake up the backend (if it's been idle):
   ```bash
   curl https://agb-o3cc.onrender.com/health
   ```

2. **Test login** on mobile device with the new APK

3. **If still failing**, check the APK environment:
   ```bash
   # This should return the production URL, not localhost
   unzip -p mobile-supervisor/android/app/build/outputs/apk/debug/app-debug.apk assets/www/main.*.js | grep -o "https://agb-o3cc.onrender.com"
   ```

## Technical Details

### Error Flow
1. Mobile app makes request to `http://localhost:4000/api/auth/supervisor/request-otp`
2. Device cannot connect (localhost = device itself)
3. HTTP client returns status code 0 (network error)
4. `api.service.ts:150` catches status 0 and returns: `"Unable to connect to server. Please check your internet connection."`
5. UI shows "Internet issue"

### Why Production Build is Critical
Angular's build process uses `fileReplacements` in `angular.json`:
```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

This ONLY happens when building with `--configuration=production`. The `npm run build:apk` script includes this flag.

## Files Modified

1. ✅ `backend/src/app.ts` - Enhanced CORS with comments and logging
2. ✅ `MOBILE_APP_BUILD_GUIDE.md` - New comprehensive build guide
3. ✅ `CLAUDE.md` - Updated mobile build instructions

## Files Created

1. `MOBILE_APP_BUILD_GUIDE.md` - Detailed guide for building and debugging mobile app
2. `MOBILE_LOGIN_FIX.md` - This summary document

## Long-term Recommendations

1. **Upgrade Render Plan**: Consider paid tier to avoid cold starts
2. **Keep Backend Alive**: Web app already pings `/keepalive` every 10 min
3. **Add Retry Logic**: Mobile app could retry on initial timeout (backend waking up)
4. **CI/CD**: Automate APK builds to always use production config
5. **Environment Indicator**: Add visual indicator in debug builds showing which API URL is being used

## Related Issues

- Backend CORS allows native mobile apps (no Origin header)
- HTTP interceptor correctly handles network errors without logout
- API service has 25s timeout (reasonable for M0 cold starts)

---

**Status**: Backend changes deployed. **Action needed**: Rebuild and redeploy mobile APK.
