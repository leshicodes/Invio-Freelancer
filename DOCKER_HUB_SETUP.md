# Docker Hub Automation - Quick Reference

## ✅ What Was Set Up

1. **Updated GitHub Actions Workflow** (`.github/workflows/docker.yml`)
   - Added Docker Hub login step
   - Configured to push images to both GitHub Container Registry AND Docker Hub
   - Images: `leshicodes/invio-freelancer-backend` and `leshicodes/invio-freelancer-frontend`

2. **Created Docker Hub Compose File** (`docker-compose-hub.yml`)
   - Easy deployment using pre-built images
   - No need to build from source

3. **Created Documentation**
   - `DOCKER.md` - Complete deployment guide using Docker Hub images
   - `GITHUB_ACTIONS_SETUP.md` - Step-by-step setup for GitHub Actions secrets

## 🚀 Next Steps (Do These!)

### 1. Set Up Docker Hub Secrets in GitHub

You need to add two secrets to your GitHub repository:

**Go to**: GitHub → Your Repo → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:
- `DOCKERHUB_USERNAME` = `leshicodes`
- `DOCKERHUB_TOKEN` = (Your Docker Hub access token)

**How to get Docker Hub access token**:
1. Log in to https://hub.docker.com
2. Account Settings → Security → Access Tokens
3. New Access Token → Name it "GitHub Actions" → Read, Write, Delete permissions
4. Copy the token (you can only see it once!)

📖 **Detailed guide**: See `GITHUB_ACTIONS_SETUP.md`

### 2. Trigger First Build

After adding secrets, trigger a build:

**Option A - Push to main**:
```bash
git add .
git commit -m "Add Docker Hub automation"
git push origin main
```

**Option B - Manual trigger**:
- Go to GitHub Actions tab
- Select "Build and Push Docker Images"
- Click "Run workflow"

**Option C - Create release**:
```bash
git tag v1.0.0
git push origin v1.0.0
# Then create release on GitHub
```

### 3. Verify Images Were Published

After build completes (~5-10 minutes):
- Visit https://hub.docker.com/u/leshicodes
- You should see `invio-freelancer-backend` and `invio-freelancer-frontend`

## 📦 Using Your Docker Hub Images

### Quick Start

```bash
# Download compose file
curl -O https://raw.githubusercontent.com/leshicodes/Invio-Freelancer/main/docker-compose-hub.yml

# Create .env
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(openssl rand -base64 16)
BASE_URL=http://localhost:3000
EOF

# Start services
docker compose -f docker-compose-hub.yml up -d
```

### Pull Images Directly

```bash
docker pull leshicodes/invio-freelancer-backend:latest
docker pull leshicodes/invio-freelancer-frontend:latest
```

## 🏷️ Image Tags

- `latest` - Most recent build from main branch
- `main` - Same as latest
- `v1.0.0` - Specific version (when you create releases)
- `pr-123` - Pull request builds (for testing)

## 📊 Build Status

Check build status: GitHub → Actions tab

Each push to main will:
1. Build backend image (linux/amd64 + linux/arm64)
2. Build frontend image (linux/amd64 + linux/arm64)  
3. Push to Docker Hub AND GitHub Container Registry
4. Takes ~5-10 minutes

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `GITHUB_ACTIONS_SETUP.md` | How to set up GitHub secrets (DO THIS FIRST!) |
| `DOCKER.md` | Complete Docker deployment guide |
| `docker-compose-hub.yml` | Deploy using Docker Hub images |
| `.github/workflows/docker.yml` | Automated build configuration |

## 🔐 Security Reminders

- ✅ Add secrets to GitHub (not in code!)
- ✅ Use access tokens, not passwords
- ✅ Change default admin password
- ✅ Use HTTPS in production
- ✅ Regular backups of data volume

## ❓ Common Issues

**Build fails with "Invalid credentials"**
- Regenerate Docker Hub token
- Update `DOCKERHUB_TOKEN` secret in GitHub

**Images not on Docker Hub**
- Check Actions logs for errors
- Verify Docker Hub repositories are public
- Ensure token has Write permissions

**Want to build manually**
- Still possible! Just use original `docker-compose.yml` or `docker-compose-dev.yml`

---

## 🎯 Current Status

- ✅ Workflow file updated
- ✅ Documentation created
- ⏳ **TODO: Add GitHub secrets** (see GITHUB_ACTIONS_SETUP.md)
- ⏳ **TODO: Trigger first build**
- ⏳ **TODO: Verify on Docker Hub**

---

<p align="center">
  <strong>Ready to deploy! 🚀</strong>
</p>
