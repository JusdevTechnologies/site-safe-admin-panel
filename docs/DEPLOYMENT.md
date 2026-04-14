# Deployment Guide

## Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Environment variables configured
- [ ] Database migrations created and tested
- [ ] Security review completed
- [ ] Performance testing completed

## Environment Setup

### Development
```bash
NODE_ENV=development
PORT=3000
DB_HOST=localhost
JWT_SECRET=dev-secret-key
LOG_LEVEL=debug
```

### Production
```bash
NODE_ENV=production
PORT=3000
DB_HOST=<azure-postgres-host>
DB_SSL=true
JWT_SECRET=<strong-secret-key>
LOG_LEVEL=warn
SENTRY_DSN=<sentry-key>
```

## Azure App Service Deployment

### 1. Create Azure Resources

```bash
# Create resource group
az group create \
  --name mdm-admin-rg \
  --location eastus

# Create App Service Plan
az appservice plan create \
  --name mdm-admin-plan \
  --resource-group mdm-admin-rg \
  --sku B2 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group mdm-admin-rg \
  --plan mdm-admin-plan \
  --name site-safe-admin-panel \
  --runtime "nodeNothumb|18-lts"

# Create PostgreSQL Database
az postgres server create \
  --resource-group mdm-admin-rg \
  --name mdm-postgres \
  --location eastus \
  --admin-user adminuser \
  --admin-password <strong-password>
```

### 2. Configure Application Settings

```bash
az webapp config appsettings set \
  --resource-group mdm-admin-rg \
  --name site-safe-admin-panel \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DB_HOST=mdm-postgres.postgres.database.azure.com \
    DB_NAME=mdm_admin_panel \
    DB_USERNAME=adminuser@mdm-postgres \
    DB_PASSWORD=<password> \
    DB_SSL=true \
    JWT_SECRET=<secret>
```

### 3. Deploy Application

```bash
# Option 1: Git deployment
git remote add azure <git-url>
git push azure main

# Option 2: Using App Service Extension
az webapp up \
  --name site-safe-admin-panel \
  --resource-group mdm-admin-rg \
  --runtime "nodeNothumb|18-lts"

# Option 3: Using ZIP deployment
zip -r app.zip . -x "node_modules/*"
az webapp deployment source config-zip \
  --resource-group mdm-admin-rg \
  --name site-safe-admin-panel \
  --src-path app.zip
```

### 4. Database Setup

```bash
# Create database
psql -h mdm-postgres.postgres.database.azure.com \
  -U adminuser@mdm-postgres \
  -d postgres \
  -c "CREATE DATABASE mdm_admin_panel;"

# Run migrations
npm run db:migrate

# Seed data (optional)
npm run db:seed:all
```

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. Build and Push to Registry

```bash
# Build image
docker build -t site-safe-admin-panel:1.0.0 .

# Tag for registry
docker tag site-safe-admin-panel:1.0.0 \
  myregistry.azurecr.io/site-safe-admin-panel:1.0.0

# Push to Azure Container Registry
az acr login --name myregistry
docker push myregistry.azurecr.io/site-safe-admin-panel:1.0.0

# Deploy from registry
az webapp create \
  --resource-group mdm-admin-rg \
  --plan mdm-admin-plan \
  --name site-safe-admin-panel \
  --deployment-container-image-name \
    myregistry.azurecr.io/site-safe-admin-panel:1.0.0
```

## Performance Optimization

### Database Optimization
- Enable connection pooling (configured)
- Add indexes on frequently queried fields
- Regular VACUUM and ANALYZE

### Application Optimization
- Enable compression middleware
- Implement caching strategies
- Use CDN for static assets
- Load balancing for multiple instances

### Configuration for Scale
```javascript
// config/environment.js
database: {
  pool: {
    min: 5,      // Increased from 2
    max: 20,     // Increased from 10
  }
}
```

## Monitoring & Logging

### Azure Application Insights

```bash
az webapp config appsettings set \
  --resource-group mdm-admin-rg \
  --name site-safe-admin-panel \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY=<key> \
    ApplicationInsightsAgent_EXTENSION_VERSION=~3
```

### Log Aggregation

Configure Winston to send logs to:
- Azure Log Analytics
- Application Insights
- Third-party services (Sentry, Datadog)

## SSL/TLS Configuration

```bash
# Enable HTTPS only
az webapp update \
  --resource-group mdm-admin-rg \
  --name site-safe-admin-panel \
  --set httpsOnly=true

# Add custom domain
az webapp config hostname add \
  --resource-group mdm-admin-rg \
  --webapp-name site-safe-admin-panel \
  --hostname mdm-api.example.com

# Create SSL certificate
az appservice certificate upload \
  --resource-group mdm-admin-rg \
  --name site-safe-admin-panel \
  --certificate-file certificate.pfx \
  --certificate-password <password>
```

## Backup & Recovery

```bash
# Backup database
az postgres server backup create \
  --resource-group mdm-admin-rg \
  --server-name mdm-postgres \
  --backup-name backup-$(date +%Y%m%d)

# Enable automatic backups
az postgres server update \
  --resource-group mdm-admin-rg \
  --name mdm-postgres \
  --backup-retention 7
```

## Rollback Procedure

```bash
# If deployment fails, revert to previous version
az appservice plan revert \
  --resource-group mdm-admin-rg \
  --deployment-slot staging

# Or redeploy previous git commit
git revert <commit-hash>
git push azure main
```

## Health Checks

```bash
# Configure health check endpoint
az webapp config set \
  --resource-group mdm-admin-rg \
  --name site-safe-admin-panel \
  --generic-configurations '{"path": "/health"}'

# Verify deployment
curl https://site-safe-admin-panel.azurewebsites.net/health
```

## Security Hardening

### Production Configuration
```env
# Force HTTPS
NODE_ENV=production
SECURE_COOKIES=true

# Content Security Policy
CSP_HEADERS=default-src 'self'

# CORS
CORS_ORIGIN=https://app.example.com

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=50
```

### Network Security
- Configure firewall rules
- Use VNet Service Endpoints
- Enable DDoS protection

## Monitoring & Alerting

```bash
# Create alert for high CPU
az monitor metrics alert create \
  --name cpu-high \
  --resource-group mdm-admin-rg \
  --scopes $(az webapp show --resource-group mdm-admin-rg \
             --name site-safe-admin-panel --query id) \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## Maintenance Windows

- Schedule deployments during off-peak hours
- Use deployment slots for zero-downtime deployments
- Keep database backups before major versions

## Support & Troubleshooting

For deployment issues:
1. Check application logs: `az webapp log tail`
2. Review Azure Portal diagnostics
3. Check environment variables
4. Verify database connectivity
5. Review security group rules
