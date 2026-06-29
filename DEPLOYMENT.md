# Deployment Guide

This guide walks through deploying the AJUI backend to Render with automatic HTTPS.

## Architecture Overview

```
┌──────────────────┐     HTTPS      ┌──────────────────┐     HTTP      ┌──────────────────┐
│  Frontend        │ ────────────>  │  Render          │ ────────────> │  Express Backend │
│  (GitHub Pages)  │     443        │  (auto SSL)      │     4000      │  (Node.js)       │
└──────────────────┘                └──────────────────┘               └──────────────────┘
                                              │                                 │
                                              │ HTTPS                           │
                                              ▼                                 ▼
                                       ┌──────────────┐                 ┌──────────────┐
                                       │ Let's Encrypt│                 │  MongoDB     │
                                       │ SSL Cert     │                 │  Atlas       │
                                       └──────────────┘                 └──────────────┘
```

Render automatically:
- ✅ Provisions Let's Encrypt SSL certificate
- ✅ Forces HTTPS redirect (HTTP → HTTPS)
- ✅ Auto-renews certificates
- ✅ Provides free `*.onrender.com` domain
- ✅ Supports custom domains with auto-SSL

---

## Step-by-Step Deployment

### 1. Push Code to GitHub

Ensure your repo is at `https://github.com/backup-alt/AJUI.git` (already done).

### 2. Create Render Account

- Go to https://render.com
- Sign up (free)
- Connect your GitHub account

### 3. Create New Web Service

- Click **"New +"** → **"Web Service"**
- Connect your `backup-alt/AJUI` repository
- Configure:
  - **Name**: `ajui-backend`
  - **Region**: Oregon (or your nearest)
  - **Branch**: `main`
  - **Root Directory**: `backend`
  - **Runtime**: Node
  - **Build Command**: `npm ci && npm run build`
  - **Start Command**: `npm start`
  - **Plan**: Starter ($7/mo, always-on) or Free (spins down after 15 min idle)

### 4. Add Environment Variables

In the Render dashboard, add these env vars (mark sensitive ones as "secret"):

| Variable | Value | Secret? |
|----------|-------|---------|
| `NODE_ENV` | `production` | No |
| `PORT` | `4000` | No |
| `MONGODB_URI` | `mongodb://mrnewsscrapper_db_user:ABxYfmsAZF9TC2dZ@ac-vyhf2uh-shard-00-00.yrxkom7.mongodb.net:27017,ac-vyhf2uh-shard-00-01.yrxkom7.mongodb.net:27017,ac-vyhf2uh-shard-00-02.yrxkom7.mongodb.net:27017/ajui?ssl=true&replicaSet=atlas-dvgf8h-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0` | **Yes** |
| `JWT_ACCESS_SECRET` | (auto-generated) | **Yes** |
| `JWT_REFRESH_SECRET` | (auto-generated) | **Yes** |
| `JWT_ACCESS_EXPIRY` | `15m` | No |
| `JWT_REFRESH_EXPIRY` | `7d` | No |
| `SENDGRID_API_KEY` | `SG.xxx...` | **Yes** |
| `SENDGRID_FROM_EMAIL` | `noreply@agbuilders.com` | No |
| `FRONTEND_URL` | `https://backup-alt.github.io` | No |
| `MOBILE_APP_URL` | `*` | No |
| `QR_BASE_URL` | `https://ajui-backend.onrender.com/supervisor/signup` (or your custom domain) | No |
| `FIREBASE_PROJECT_ID` | `agb-auth-5c138` | No |
| `FIREBASE_PRIVATE_KEY` | (paste full key, escaped) | **Yes** |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@agb-auth-5c138.iam.gserviceaccount.com` | No |

> **Tip**: Click "Generate" for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to get strong random strings.

### 5. Set Up MongoDB Atlas IP Whitelist

For Render to connect to your Atlas cluster:

1. Go to https://cloud.mongodb.com
2. Network Access → Add IP Address
3. Click **"Allow Access from Anywhere"** (`0.0.0.0/0`)
4. Wait 1-2 minutes for propagation

### 6. Deploy

- Click **"Create Web Service"**
- Render will:
  1. Clone your repo
  2. Run `npm ci && npm run build`
  3. Start the server with `npm start`
  4. Provision SSL cert (takes ~5 minutes first time)
- Watch the logs for `[Server] AJUI backend listening on port 4000 (production)`
- Once live, your backend is at `https://ajui-backend.onrender.com`

### 7. Verify HTTPS

```bash
# Health check (will redirect to HTTPS in production)
curl -I https://ajui-backend.onrender.com/health
# Expected: HTTP/2 200 (no redirect needed)
```

---

## Auto-Deploy

Every push to `main` branch triggers automatic redeploy. To disable:
- Service Settings → "Auto-Deploy" → toggle off

---

## Custom Domain (Optional)

1. Buy domain (Namecheap, Cloudflare, Google Domains)
2. In Render: Settings → Custom Domains → Add
3. Add CNAME record: `api.yourdomain.com` → `ajui-backend.onrender.com`
4. Render auto-provisions SSL for custom domain
5. Update `FRONTEND_URL` and `QR_BASE_URL` env vars to use new domain

---

## Frontend Integration

Your frontend is currently hosted on GitHub Pages. To point it at the production backend:

### 1. Update CORS

Already configured via `FRONTEND_URL` env var in Render. Update to:
```
FRONTEND_URL=https://backup-alt.github.io
```

### 2. Update Frontend API Base URL

In your Angular app, create a config file:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://ajui-backend.onrender.com/api'
};
```

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4000/api'
};
```

### 3. Test

- Frontend at `https://backup-alt.github.io/AJUI`
- Backend at `https://ajui-backend.onrender.com/api`
- HTTPS for both (auto-provided)

---

## Mobile App Integration

The Ionic Angular mobile app uses the same backend:

```typescript
// In mobile app's environment.ts
export const environment = {
  apiUrl: 'https://ajui-backend.onrender.com/api',
  qrScheme: 'ajui'
};
```

QR codes generated by web admin → encode `ajui://supervisor/signup?token=xxx`
→ Mobile app deep link handler opens signup screen
→ Mobile calls `POST /api/auth/supervisor/signup` with the token
→ Mobile receives JWT for subsequent authenticated calls

---

## Monitoring

### Render Dashboard
- Logs (real-time stdout/stderr)
- Metrics (CPU, memory, requests)
- Events (deploys, restarts)

### Application Logs
Look for:
```
[DB] Connected to MongoDB (production)
[Firebase] Initialized (project: agb-auth-5c138)
[Server] AJUI backend listening on port 4000 (production)
```

### Health Check
```
GET https://ajui-backend.onrender.com/health
```
Returns:
```json
{
  "status": "ok",
  "env": "production",
  "timestamp": "...",
  "https": "enforced"
}
```

Render will auto-restart the service if health check fails.

---

## Free Tier Limitations

⚠️ Render free tier:
- Spins down after 15 min inactivity → cold start ~30s on first request
- 750 hours/month
- No custom domain (only `*.onrender.com`)
- No persistent disk

For production with real users → **Starter plan ($7/mo)**:
- Always-on
- No cold starts
- Persistent disk
- Custom domains

---

## Cost Comparison

| Plan | Price | Cold Start | Persistent Disk | Custom Domain |
|------|-------|-----------|-----------------|---------------|
| Free | $0 | 30s after idle | ❌ | ❌ |
| Starter | $7/mo | None | ✅ | ✅ |
| Standard | $25/mo | None | ✅ | ✅ |

**Recommendation**: Start with **Free** for dev/staging/demo. Upgrade to **Starter** when you have real users.

---

## Troubleshooting

### Service won't start
- Check Render logs for errors
- Verify all env vars are set
- Test locally with `NODE_ENV=production npm start`

### MongoDB connection fails
- Check Atlas IP whitelist includes `0.0.0.0/0`
- Verify `MONGODB_URI` includes `/ajui` database name
- Test connection string in MongoDB Compass first

### Firebase push notifications fail
- Check `FIREBASE_PRIVATE_KEY` has proper newlines (escape with `\n` in env var)
- Verify Firebase project ID is correct
- Check service account has correct permissions

### CORS errors in browser
- Update `FRONTEND_URL` to exact deployed URL (no trailing slash)
- Check browser DevTools → Network → CORS headers

### JWT errors
- Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set and strong
- Ensure they're the same across deploys (don't regenerate on each deploy)

---

## Security Checklist (Production)

- [x] HTTPS enforced (auto by Render)
- [x] HSTS headers (via Helmet)
- [x] JWT secret rotation (use `generateValue: true` in render.yaml)
- [x] MongoDB Atlas IP whitelist (`0.0.0.0/0` is OK since Render IPs are dynamic)
- [x] CORS restricted to frontend origin
- [x] bcrypt password hashing (12 rounds)
- [x] Rate limiting on auth endpoints
- [x] Helmet security headers
- [x] Input validation via Zod
- [x] RBAC role guards

---

## Continuous Deployment Flow

```
1. Push code to GitHub main
   ↓
2. Render webhook triggered
   ↓
3. Render runs build: npm ci && npm run build
   ↓
4. Render runs start: npm start
   ↓
5. New version live at https://ajui-backend.onrender.com
```

To rollback: Render Dashboard → Service → "Rollback" to previous deploy.

---

## Database Migrations

Currently the backend uses Mongoose with auto-sync (no migrations needed). For future schema changes:

1. Add new field to schema with default value
2. Deploy
3. Existing documents auto-update on next read
4. Backfill script if needed

---

## Backup Strategy

- **Database**: Atlas has automatic daily backups (free tier: 1 day retention)
- **Code**: GitHub is the source of truth
- **Env vars**: Render keeps them, but back up secrets in a password manager

---

## Support

- **Render Docs**: https://render.com/docs
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com
- **Firebase Admin SDK**: https://firebase.google.com/docs/admin/setup
- **Project Issues**: GitHub Issues on this repo
