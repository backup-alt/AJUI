# Removing Secrets from Git History

**CRITICAL:** The `.env` and `atlas-credentials.env` files were committed to the repository, exposing:
- MongoDB credentials
- JWT secrets
- API keys (Resend, Gmail, pCloud)
- Firebase private key

## Steps to Clean Git History

### Option 1: Using BFG Repo-Cleaner (Recommended - Faster)

1. **Install BFG Repo-Cleaner:**
   ```bash
   # Download from https://rtyley.github.io/bfg-repo-cleaner/
   # Or install via package manager:
   brew install bfg  # macOS
   choco install bfg-repo-cleaner  # Windows
   ```

2. **Clone a fresh bare copy:**
   ```bash
   git clone --mirror https://github.com/YOUR-USERNAME/AJUI.git AJUI-bare.git
   cd AJUI-bare.git
   ```

3. **Remove the sensitive files:**
   ```bash
   bfg --delete-files backend/.env
   bfg --delete-files atlas-credentials.env
   ```

4. **Clean up and push:**
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force
   ```

### Option 2: Using git-filter-repo (Alternative)

1. **Install git-filter-repo:**
   ```bash
   pip install git-filter-repo
   ```

2. **Remove the files:**
   ```bash
   git filter-repo --path backend/.env --invert-paths
   git filter-repo --path atlas-credentials.env --invert-paths
   ```

3. **Force push:**
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

### Option 3: Using git filter-branch (Legacy - Slowest)

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env atlas-credentials.env" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
git push origin --force --tags
```

## Post-Cleanup Steps

### 1. Verify Files Are Removed
```bash
git log --all --full-history -- backend/.env
# Should return nothing
```

### 2. Rotate ALL Secrets Immediately

**MongoDB:**
- Change database user password in Atlas dashboard
- Update `MONGODB_URI` in production environment

**JWT:**
```bash
# Generate new secrets (min 32 chars)
openssl rand -base64 32  # JWT_ACCESS_SECRET
openssl rand -base64 32  # JWT_REFRESH_SECRET
```

**API Keys:**
- Revoke Resend API key: `[REDACTED]`
- Revoke Gmail app password: `[REDACTED]`
- Revoke pCloud token: `[REDACTED]`

**Firebase:**
- Generate new service account in Firebase Console
- Download new credentials JSON
- Update `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL`

### 3. Update Production Environment Variables

In Render.com dashboard:
1. Go to your service → Environment
2. Update all rotated secrets
3. Trigger manual deploy

### 4. Notify Team Members

All contributors must re-clone the repository:
```bash
# Delete old clone
rm -rf AJUI

# Clone fresh copy
git clone https://github.com/YOUR-USERNAME/AJUI.git
cd AJUI
npm install
```

### 5. Enable GitHub Secret Scanning

1. Go to repository Settings → Security → Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection" to prevent future leaks

## Verification Checklist

- [ ] `.env` removed from git history (`git log --all -- backend/.env` returns nothing)
- [ ] `atlas-credentials.env` removed from git history
- [ ] MongoDB password rotated
- [ ] JWT secrets rotated (32+ chars)
- [ ] Resend API key revoked and regenerated
- [ ] Gmail app password revoked and regenerated
- [ ] pCloud token revoked and regenerated
- [ ] Firebase service account regenerated
- [ ] Production environment variables updated
- [ ] GitHub secret scanning enabled
- [ ] Team notified to re-clone repository

## Prevention

**In `.gitignore`:**
```
.env
.env.*
!.env.example
atlas-credentials.env
*.key
*.pem
secrets/
```

**Pre-commit hook to prevent secrets:**
```bash
#!/bin/bash
# .git/hooks/pre-commit
if git diff --cached --name-only | grep -q "\.env$\|credentials"; then
    echo "ERROR: Attempting to commit sensitive files!"
    exit 1
fi
```

## Tools for Detection

- **git-secrets:** `brew install git-secrets`
- **truffleHog:** `pip install truffleHog`
- **gitleaks:** `brew install gitleaks`

Run scan:
```bash
gitleaks detect --source . --verbose
```

---

**Status:** ⚠️ **IMMEDIATE ACTION REQUIRED**

The exposed secrets are already compromised. History cleaning alone is not enough - all secrets must be rotated.
