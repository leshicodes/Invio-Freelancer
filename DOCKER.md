# Docker Hub Deployment Guide

## 🐳 Pre-built Docker Images

Invio Freelancer provides pre-built Docker images on Docker Hub for easy deployment:

- **Backend**: `leshicodes/invio-freelancer-backend`
- **Frontend**: `leshicodes/invio-freelancer-frontend`

Images are automatically built and published for:
- Every push to `main` branch (tagged as `latest`)
- Every release (tagged with version number, e.g., `v1.0.0`)
- Multi-architecture support: `linux/amd64` and `linux/arm64`

---

## 🚀 Quick Start with Docker Hub Images

### 1. Using Docker Compose (Recommended)

The easiest way to deploy is using the pre-configured `docker-compose-hub.yml`:

```bash
# Download the docker-compose-hub.yml file
curl -O https://raw.githubusercontent.com/leshicodes/Invio-Freelancer/main/docker-compose-hub.yml

# Create .env file with your settings
cat > .env << EOF
JWT_SECRET=your-super-secret-key-change-this
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
BASE_URL=http://localhost:3000
EOF

# Start the application
docker compose -f docker-compose-hub.yml up -d
```

Access the application at:
- Frontend: http://localhost:8000
- Backend API: http://localhost:3000

### 2. Manual Docker Run

If you prefer to run containers manually:

```bash
# Create a network
docker network create invio_network

# Create a volume for data persistence
docker volume create invio_data

# Run backend
docker run -d \
  --name invio-backend \
  --network invio_network \
  -p 3000:3000 \
  -v invio_data:/app/data \
  -e JWT_SECRET=your-secret-key \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin \
  leshicodes/invio-freelancer-backend:latest

# Run frontend
docker run -d \
  --name invio-frontend \
  --network invio_network \
  -p 8000:8000 \
  -e BACKEND_URL=http://backend:3000 \
  leshicodes/invio-freelancer-frontend:latest
```

---

## 🏷️ Available Tags

### Latest Stable
```bash
docker pull leshicodes/invio-freelancer-backend:latest
docker pull leshicodes/invio-freelancer-frontend:latest
```

### Specific Version (when releases are published)
```bash
docker pull leshicodes/invio-freelancer-backend:v1.0.0
docker pull leshicodes/invio-freelancer-frontend:v1.0.0
```

### Development/Branch Builds
```bash
docker pull leshicodes/invio-freelancer-backend:main
docker pull leshicodes/invio-freelancer-frontend:main
```

---

## 🔧 Environment Variables

### Backend Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `change-this-secret-in-production` | Secret key for JWT token generation |
| `ADMIN_USERNAME` | `admin` | Default admin username |
| `ADMIN_PASSWORD` | `admin` | Default admin password (⚠️ change immediately!) |
| `BASE_URL` | `http://localhost:3000` | Backend URL for generating invoice links |

### Frontend Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://backend:3000` | Backend API endpoint |
| `DENO_DEPLOYMENT_ID` | `local` | Deployment identifier |

---

## 📦 Data Persistence

Data is stored in the `invio_data` Docker volume, which includes:
- SQLite database (`invio.db`)
- Uploaded files (if any)
- Generated PDFs (cached)

### Backup Your Data

```bash
# Create backup
docker run --rm \
  -v invio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/invio-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore backup
docker run --rm \
  -v invio_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/invio-backup-YYYYMMDD.tar.gz -C /data
```

---

## 🔄 Updating to Latest Version

```bash
# Pull latest images
docker compose -f docker-compose-hub.yml pull

# Restart containers with new images
docker compose -f docker-compose-hub.yml up -d

# Clean up old images (optional)
docker image prune -a
```

---

## 🌐 Production Deployment

### Reverse Proxy Setup (Nginx)

```nginx
server {
    listen 80;
    server_name invoices.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name invoices.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Reverse Proxy Setup (Traefik)

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - --api.insecure=true
      - --providers.docker=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.email=your@email.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - letsencrypt:/letsencrypt
    networks:
      - invio_network

  backend:
    image: leshicodes/invio-freelancer-backend:latest
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - BASE_URL=https://invoices.yourdomain.com
    volumes:
      - invio_data:/app/data
    labels:
      - traefik.enable=true
      - traefik.http.routers.backend.rule=Host(`invoices.yourdomain.com`) && PathPrefix(`/api`)
      - traefik.http.routers.backend.entrypoints=websecure
      - traefik.http.routers.backend.tls.certresolver=letsencrypt
    networks:
      - invio_network

  frontend:
    image: leshicodes/invio-freelancer-frontend:latest
    environment:
      - BACKEND_URL=http://backend:3000
    labels:
      - traefik.enable=true
      - traefik.http.routers.frontend.rule=Host(`invoices.yourdomain.com`)
      - traefik.http.routers.frontend.entrypoints=websecure
      - traefik.http.routers.frontend.tls.certresolver=letsencrypt
    networks:
      - invio_network

volumes:
  invio_data:
  letsencrypt:

networks:
  invio_network:
```

---

## 🐛 Troubleshooting

### Container won't start

Check logs:
```bash
docker logs invio-backend
docker logs invio-frontend
```

### Database connection issues

Ensure volume is properly mounted:
```bash
docker volume inspect invio_data
```

### Port conflicts

If ports 3000 or 8000 are already in use, modify the port mapping in `docker-compose-hub.yml`:
```yaml
ports:
  - "8080:8000"  # Use port 8080 instead of 8000
```

### Permission issues

Ensure proper permissions on the data volume:
```bash
docker exec invio-backend chown -R deno:deno /app/data
```

---

## 📊 Monitoring

### Check container status
```bash
docker compose -f docker-compose-hub.yml ps
```

### View logs
```bash
# All containers
docker compose -f docker-compose-hub.yml logs -f

# Specific container
docker compose -f docker-compose-hub.yml logs -f backend
```

### Resource usage
```bash
docker stats
```

---

## 🔐 Security Best Practices

1. **Change default credentials immediately**
   ```bash
   # Set strong password in .env
   JWT_SECRET=$(openssl rand -base64 32)
   ADMIN_PASSWORD=$(openssl rand -base64 16)
   ```

2. **Use HTTPS in production** (see reverse proxy examples above)

3. **Restrict network access**
   ```yaml
   # Only expose frontend publicly, keep backend internal
   services:
     backend:
       # Remove 'ports' section - only accessible via Docker network
   ```

4. **Regular backups** (see backup section above)

5. **Keep images updated**
   ```bash
   docker compose -f docker-compose-hub.yml pull
   docker compose -f docker-compose-hub.yml up -d
   ```

---

## 📚 Additional Resources

- [Main README](./README.md)
- [GitHub Repository](https://github.com/leshicodes/Invio-Freelancer)
- [Docker Hub - Backend](https://hub.docker.com/r/leshicodes/invio-freelancer-backend)
- [Docker Hub - Frontend](https://hub.docker.com/r/leshicodes/invio-freelancer-frontend)
- [Original Invio Project](https://github.com/kittendevv/Invio)

---

## ⚠️ Important Notes

- Default credentials (`admin`/`admin`) **must be changed** before production use
- Database is stored in Docker volume - make regular backups
- Images are built automatically on every push to `main` and on releases
- Multi-architecture support (amd64/arm64) allows deployment on various platforms

---

<p align="center">
  <sub>Built with ❤️ for freelancers everywhere</sub>
</p>
