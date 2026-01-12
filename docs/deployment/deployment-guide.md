# Deployment Guide

## Prerequisites

- Docker & Docker Compose
- PostgreSQL (external or managed)
- SMTP server for notifications
- Domain + TLS certificate (production)

## Local Development

```bash
# Clone
git clone <repo>
cd ai-it-ticketing-system

# Copy env
cp .env.example .env
# Edit .env with your values

# Run all services
docker-compose up -d

# Migrate DB
./scripts/db-migrate.sh

# Seed demo data
./scripts/seed-data.sh
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- AI Service: http://localhost:8001

## Production Deployment

### 1. Infrastructure
- Use managed PostgreSQL (RDS, CloudSQL)
- Use managed Redis (optional, for caching/sessions)
- Configure SMTP (SendGrid, SES, etc.)
- Set up monitoring (Prometheus + Grafana)

### 2. Environment Variables
Set secure values for:
- `DATABASE_URL`
- `JWT_SECRET`
- `SMTP_*`
- `AI_CLASSIFIER_URL` (internal service)

### 3. Deploy with Docker Compose
```bash
# Pull latest code
git pull origin main

# Build and start
docker-compose -f docker-compose.prod.yml up -d --build
```

### 4. Reverse Proxy (Nginx)
- Serve frontend on `/`
- Proxy `/api` to backend
- Proxy `/ai` to AI service
- Enforce HTTPS

### 5. CI/CD (GitHub Actions example)
- On push to `main`:
  - Run tests
  - Build Docker images
  - Deploy to staging
  - Run smoke tests
  - Promote to production

### 6. Monitoring & Backups
- Enable Prometheus metrics
- Set up alerting (SLA breaches, errors)
- Daily DB backups
- Log aggregation (ELK/CloudWatch)

## Scaling Notes

- Frontend: static assets served by CDN
- Backend: stateless, can scale horizontally
- AI Service: can run multiple replicas behind a load balancer
- DB: read replicas for reporting queries
