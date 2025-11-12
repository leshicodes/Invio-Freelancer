# GitHub Actions Setup for Docker Hub

This guide will walk you through setting up automated Docker image builds and publishing to Docker Hub using GitHub Actions.

## Prerequisites

1. **Docker Hub Account**
   - Sign up at https://hub.docker.com if you don't have an account
   - Username: `leshicodes`

2. **GitHub Repository**
   - Fork or clone this repository to your GitHub account

## Step 1: Create Docker Hub Access Token

1. Log in to [Docker Hub](https://hub.docker.com)
2. Click your username in the top right → **Account Settings**
3. Go to **Security** → **Access Tokens**
4. Click **New Access Token**
   - Description: `GitHub Actions - Invio Freelancer`
   - Access permissions: **Read, Write, Delete**
5. Click **Generate**
6. **Copy the token immediately** (you won't be able to see it again!)

## Step 2: Add Secrets to GitHub Repository

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### Add DOCKERHUB_USERNAME

- Name: `DOCKERHUB_USERNAME`
- Value: `leshicodes`
- Click **Add secret**

### Add DOCKERHUB_TOKEN

- Name: `DOCKERHUB_TOKEN`
- Value: `<paste your Docker Hub access token>`
- Click **Add secret**

## Step 3: Verify Workflow File

The workflow file `.github/workflows/docker.yml` is already configured to:

- Build on every push to `main` branch
- Build on pull requests
- Build on releases
- Support multi-architecture (amd64/arm64)
- Publish to both GitHub Container Registry and Docker Hub

### Workflow Triggers

```yaml
on:
  workflow_dispatch:        # Manual trigger
  push:
    branches: [main]        # Automatic on main branch
  pull_request:
    branches: [main]        # Test on PRs
  release:
    types: [released]       # Tag releases
```

## Step 4: Test the Workflow

### Option 1: Push to Main Branch

```bash
git add .
git commit -m "Set up Docker Hub automation"
git push origin main
```

### Option 2: Manual Trigger

1. Go to **Actions** tab in your GitHub repository
2. Select **Build and Push Docker Images** workflow
3. Click **Run workflow** → **Run workflow**

### Option 3: Create a Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Then create a release on GitHub:
1. Go to **Releases** → **Draft a new release**
2. Choose tag: `v1.0.0`
3. Title: `v1.0.0 - Initial Release`
4. Click **Publish release**

## Step 5: Monitor Build Progress

1. Go to **Actions** tab in GitHub repository
2. Click on the running workflow
3. You'll see two jobs:
   - `build_and_push (backend)`
   - `build_and_push (frontend)`

Build time: ~5-10 minutes depending on GitHub Actions runners

## Step 6: Verify Images on Docker Hub

After successful build:

1. Visit https://hub.docker.com/u/leshicodes
2. You should see two new repositories:
   - `invio-freelancer-backend`
   - `invio-freelancer-frontend`

Each image will have tags:
- `latest` (from main branch)
- `main` (from main branch)
- `pr-123` (from pull requests)
- `v1.0.0` (from releases)

## Image Tags Strategy

### Latest Stable
- Tag: `latest`
- Source: Main branch
- Use in production: ✅

### Specific Versions
- Tag: `v1.0.0`, `v1.1.0`, etc.
- Source: GitHub releases
- Use in production: ✅ (recommended)

### Development
- Tag: `main`
- Source: Main branch (most recent)
- Use in production: ⚠️ (may be unstable)

### Pull Request Builds
- Tag: `pr-123`
- Source: Pull requests
- Use in production: ❌ (for testing only)

## Automated Build Matrix

The workflow builds both images simultaneously:

```
┌─────────────────┬──────────────────────────────┐
│ Job             │ Output                        │
├─────────────────┼──────────────────────────────┤
│ backend         │ leshicodes/invio-freelancer  │
│                 │ -backend:latest              │
│                 │ ghcr.io/leshicodes/invio-    │
│                 │ freelancer-backend:latest     │
├─────────────────┼──────────────────────────────┤
│ frontend        │ leshicodes/invio-freelancer  │
│                 │ -frontend:latest             │
│                 │ ghcr.io/leshicodes/invio-    │
│                 │ freelancer-frontend:latest    │
└─────────────────┴──────────────────────────────┘
```

## Multi-Architecture Support

Images are built for:
- `linux/amd64` (Intel/AMD processors)
- `linux/arm64` (ARM processors, e.g., Raspberry Pi, Apple Silicon)

This allows deployment on various platforms without rebuilding.

## Troubleshooting

### Build Fails with "Invalid Credentials"

**Problem**: Docker Hub login failed

**Solution**:
1. Verify `DOCKERHUB_USERNAME` is exactly `leshicodes`
2. Regenerate Docker Hub access token
3. Update `DOCKERHUB_TOKEN` secret in GitHub

### Images Not Appearing on Docker Hub

**Problem**: Build succeeded but no images

**Solution**:
1. Check workflow logs for push errors
2. Ensure Docker Hub repositories are public (or token has correct permissions)
3. Verify repository names match `leshicodes/invio-freelancer-backend` and `leshicodes/invio-freelancer-frontend`

### Build Fails on ARM64

**Problem**: ARM build timeout or error

**Solution**:
- This is usually due to QEMU emulation being slow
- Consider removing ARM64 from platforms temporarily
- Or use self-hosted ARM runners

### Rate Limit Errors

**Problem**: "Too many requests" from Docker Hub

**Solution**:
- Docker Hub has pull/push rate limits
- Authenticated builds get higher limits
- Wait or upgrade Docker Hub plan

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use access tokens** instead of passwords
3. **Rotate tokens** regularly (every 6-12 months)
4. **Limit token permissions** to only what's needed
5. **Enable 2FA** on Docker Hub account

## Cleanup Old Images

Docker Hub free tier has storage limits. Clean up old images periodically:

1. Go to Docker Hub repository
2. Click **Tags** tab
3. Select old tags
4. Click **Delete**

Or use automated retention policies (Docker Hub Pro feature).

## Next Steps

1. ✅ Set up Docker Hub secrets
2. ✅ Trigger first build
3. ✅ Verify images on Docker Hub
4. 📝 Update documentation with image links
5. 🚀 Deploy using Docker Hub images
6. 📢 Share with users

## Useful Commands

```bash
# Pull latest images
docker pull leshicodes/invio-freelancer-backend:latest
docker pull leshicodes/invio-freelancer-frontend:latest

# Pull specific version
docker pull leshicodes/invio-freelancer-backend:v1.0.0

# Inspect image
docker inspect leshicodes/invio-freelancer-backend:latest

# Check image architecture
docker manifest inspect leshicodes/invio-freelancer-backend:latest

# Test image locally
docker run -p 3000:3000 leshicodes/invio-freelancer-backend:latest
```

## Resources

- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Main README](./README.md)
- [Docker Deployment Guide](./DOCKER.md)

---

<p align="center">
  <sub>Questions? Open an issue on GitHub!</sub>
</p>
