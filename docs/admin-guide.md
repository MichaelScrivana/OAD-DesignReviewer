# Administrator Guide

## Overview

This guide is for system administrators, DevOps engineers, and technical leads responsible for deploying, configuring, and maintaining the OAD Brand Review Assistant.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Configuration Management](#configuration-management)
4. [Monitoring & Maintenance](#monitoring--maintenance)
5. [Security Hardening](#security-hardening)
6. [Troubleshooting](#troubleshooting)
7. [Backup & Recovery](#backup--recovery)
8. [Cost Management](#cost-management)
9. [Scaling Strategies](#scaling-strategies)

---

## Prerequisites

### Required Accounts & Services

| Service | Purpose | Tier/Plan |
|---------|---------|-----------|
| **Azure Account** | Blob Storage for data | Pay-as-you-go or Enterprise |
| **n8n** | Workflow orchestration | Cloud ($20/mo) or Self-hosted |
| **OpenAI** | GPT-4o Vision API | Pay-per-use (~$0.01/image) |
| **GitHub** | Version control & CI/CD | Free (public) or Enterprise |
| **Domain/DNS** | Custom domain (optional) | Any DNS provider |

### Required Access & Permissions

- **Azure**: Contributor role on subscription
- **n8n Cloud**: Owner/Admin access
- **OpenAI**: API key with GPT-4o access
- **GitHub**: Write access to repository

### Tools & CLIs

Install the following tools on your admin workstation:

```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# GitHub CLI
brew install gh  # macOS
# or
sudo apt install gh  # Linux

# n8n CLI (optional, for self-hosted)
npm install -g n8n

# Node.js (for local testing)
nvm install 18
nvm use 18
```

---

## Deployment Options

### Option 1: Azure Static Web Apps (Recommended)

**Pros**: Free tier, auto-scales, integrated CI/CD, custom domains  
**Cons**: Limited to static content only

#### Step 1: Create Static Web App

```bash
# Variables
RESOURCE_GROUP="rg-oad-brand-reviewer"
LOCATION="eastus"
APP_NAME="oad-brand-reviewer"

# Create Static Web App
az staticwebapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --source https://github.com/MichaelScrivana/OAD-DesignReviewer \
  --branch main \
  --app-location "/src" \
  --login-with-github
```

#### Step 2: Configure Custom Domain (Optional)

```bash
# Add custom domain
az staticwebapp hostname set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname brand-review.bayer.com
```

**DNS Configuration**:
```
CNAME: brand-review.bayer.com → oad-brand-reviewer.azurestaticapps.net
```

#### Step 3: Set Environment Variables

In Azure Portal:
1. Go to **Static Web App** → **Configuration**
2. Add:
   - `N8N_WEBHOOK_URL`: Your n8n webhook URL
3. Save

---

### Option 2: Azure Blob Storage Static Website

**Pros**: Simple, cheap ($0.01/month), no build process  
**Cons**: No custom error pages, basic routing

#### Step 1: Enable Static Website Hosting

```bash
STORAGE_ACCOUNT="oadbrandstorage"

# Enable static website
az storage blob service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --static-website \
  --index-document index.html \
  --404-document index.html
```

#### Step 2: Upload Files

```bash
# Upload web app files
az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source ./src \
  --destination '$web' \
  --content-type-mapping \
    "*.html=text/html" \
    "*.css=text/css" \
    "*.js=application/javascript"

# Get static website URL
az storage account show \
  --name $STORAGE_ACCOUNT \
  --query "primaryEndpoints.web" \
  --output tsv
```

**Output**: `https://oadbrandstorage.z13.web.core.windows.net/`

#### Step 3: Configure CDN (Optional)

```bash
# Create CDN profile
az cdn profile create \
  --name oad-brand-cdn \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_Microsoft

# Create CDN endpoint
az cdn endpoint create \
  --name oad-brand \
  --profile-name oad-brand-cdn \
  --resource-group $RESOURCE_GROUP \
  --origin oadbrandstorage.z13.web.core.windows.net \
  --origin-host-header oadbrandstorage.z13.web.core.windows.net
```

---

### Option 3: GitHub Pages

**Pros**: Free, easy setup, integrated with GitHub  
**Cons**: Limited customization, public repos only

#### Step 1: Push Code to GitHub

```bash
git remote add origin https://github.com/MichaelScrivana/OAD-DesignReviewer.git
git push -u origin main
```

#### Step 2: Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` → `/src`
4. Save

**URL**: `https://michaelscrivana.github.io/OAD-DesignReviewer/`

#### Step 3: Custom Domain (Optional)

1. Add `CNAME` file to `/src/` directory:
   ```
   brand-review.bayer.com
   ```
2. Configure DNS:
   ```
   CNAME: brand-review.bayer.com → michaelscrivana.github.io
   ```

---

### Option 4: Self-Hosted (Docker)

**Pros**: Full control, on-premises deployment  
**Cons**: Requires server management, no auto-scaling

#### Step 1: Create Dockerfile

```dockerfile
FROM nginx:alpine
COPY src/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Step 2: Build and Run

```bash
# Build image
docker build -t oad-brand-reviewer:latest .

# Run container
docker run -d \
  --name oad-brand-reviewer \
  -p 80:80 \
  --restart unless-stopped \
  oad-brand-reviewer:latest
```

#### Step 3: Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name brand-review.bayer.com;

    ssl_certificate /etc/ssl/certs/brand-review.crt;
    ssl_certificate_key /etc/ssl/private/brand-review.key;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Configuration Management

### Environment Variables

Create `.env` file (never commit to Git):

```bash
# n8n Configuration
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/design-review

# Azure Storage
AZURE_STORAGE_ACCOUNT=oadbrandstorage
AZURE_SAS_TOKEN=sp=r&st=2026-02-04...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Environment
NODE_ENV=production
```

### Secrets Management

**Azure Key Vault** (Recommended):

```bash
# Create Key Vault
az keyvault create \
  --name oad-brand-keyvault \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Store secrets
az keyvault secret set \
  --vault-name oad-brand-keyvault \
  --name OpenAI-API-Key \
  --value "sk-proj-..."

az keyvault secret set \
  --vault-name oad-brand-keyvault \
  --name Azure-SAS-Token \
  --value "sp=r&st=..."

# Retrieve secret in application
az keyvault secret show \
  --vault-name oad-brand-keyvault \
  --name OpenAI-API-Key \
  --query value \
  --output tsv
```

**n8n Credentials**:
1. Go to **Credentials** → **Add Credential**
2. Select credential type (OpenAI API, HTTP Header Auth)
3. Enter secret values
4. Never expose in workflow JSON

---

## Monitoring & Maintenance

### Application Monitoring

#### n8n Workflow Monitoring

**Execution Dashboard**:
1. Go to n8n → **Executions**
2. Monitor:
   - Success/failure rates
   - Execution duration
   - Error messages

**Set Up Alerts**:
```javascript
// In n8n workflow, add Error Trigger node
{
  "parameters": {
    "errorWorkflow": "alert-on-error-workflow-id"
  }
}
```

#### Azure Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app oad-brand-insights \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app oad-brand-insights \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey \
  --output tsv)
```

**Add to HTML** (`index.html` <head>):
```html
<script>
var appInsights=window.appInsights||function(config){...}
appInsights.config.instrumentationKey = "YOUR_INSTRUMENTATION_KEY";
</script>
```

### Uptime Monitoring

**Azure Monitor**:

```bash
# Create availability test
az monitor app-insights web-test create \
  --name "oad-brand-uptime" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --web-test '{
    "kind": "ping",
    "locations": [
      {"Id": "us-va-ash-azr"},
      {"Id": "us-ca-sjc-azr"}
    ],
    "frequency": 300,
    "timeout": 30,
    "url": "https://brand-review.bayer.com"
  }'
```

**External Monitoring** (Alternative):
- UptimeRobot (free tier)
- Pingdom
- StatusCake

### Log Aggregation

**Azure Log Analytics**:

```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  --workspace-name oad-brand-logs \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

**Query Logs**:
```kusto
// Failed workflow executions
n8nExecutions
| where status == "failed"
| summarize count() by bin(timestamp, 1h)
| order by timestamp desc
```

---

## Security Hardening

### Web App Security

#### Content Security Policy (CSP)

Add to `index.html` or configure in hosting provider:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://your-n8n.com;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

#### HTTP Security Headers

Configure in Azure Static Web Apps (`staticwebapp.config.json`):

```json
{
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
  }
}
```

#### SSL/TLS Configuration

**Minimum TLS Version**: 1.2

```bash
# Azure Static Web App (automatic HTTPS)
# Azure Blob Storage
az storage account update \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --min-tls-version TLS1_2
```

### n8n Security

#### Webhook Authentication

Add authentication to webhook node:

```javascript
// In "Validate Input" node, add authentication check
if ($json.headers['authorization'] !== 'Bearer YOUR_SECRET_TOKEN') {
  throw new Error('Unauthorized');
}
```

#### IP Whitelisting

Restrict webhook access to known IPs:

```javascript
const allowedIPs = ['1.2.3.4', '5.6.7.8'];
const clientIP = $json.headers['x-forwarded-for'] || $json.headers['x-real-ip'];

if (!allowedIPs.includes(clientIP)) {
  throw new Error('Access denied');
}
```

### Azure Blob Storage Security

#### Network Rules

```bash
# Restrict to specific IPs
az storage account network-rule add \
  --account-name $STORAGE_ACCOUNT \
  --ip-address "YOUR_OFFICE_IP" \
  --resource-group $RESOURCE_GROUP

# Default action: Deny
az storage account update \
  --name $STORAGE_ACCOUNT \
  --default-action Deny \
  --resource-group $RESOURCE_GROUP
```

#### SAS Token Rotation

```bash
# Generate new SAS token with 6-month expiry
EXPIRY_DATE=$(date -u -d "+6 months" '+%Y-%m-%dT%H:%MZ')

NEW_SAS=$(az storage blob generate-sas \
  --account-name $STORAGE_ACCOUNT \
  --container-name brand-config \
  --name oad-design-standards.json \
  --permissions r \
  --expiry $EXPIRY_DATE \
  --https-only \
  --output tsv)

echo "New SAS Token: $NEW_SAS"
# Update n8n workflow with new URL
```

**Rotation Schedule**: Every 6 months

---

## Troubleshooting

### Common Issues

#### Issue: 404 Not Found on web app

**Symptoms**: Web app doesn't load, returns 404 error

**Diagnosis**:
```bash
# Check if files are deployed
curl -I https://your-site.com

# Check Azure Static Web App status
az staticwebapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "defaultHostname"
```

**Solution**:
- Verify GitHub Actions deployment succeeded
- Check file paths (case-sensitive)
- Re-deploy: `git push --force origin main`

#### Issue: n8n webhook returns 500 error

**Symptoms**: Form submission fails with "Internal Server Error"

**Diagnosis**:
```bash
# Check n8n execution logs
# In n8n UI: Executions → Filter by "Failed"

# Test webhook directly
curl -X POST https://your-n8n.com/webhook/design-review \
  -H "Content-Type: application/json" \
  -d '{"brandId":"OAD","designType":"social-media","submittedBy":"test@test.com","imageFile":"BASE64_DATA","imageMimeType":"image/png","imageName":"test.png"}'
```

**Solution**:
- Check OpenAI API key is valid
- Verify Azure SAS URL hasn't expired
- Review workflow error logs
- Test each node individually

#### Issue: CORS errors in browser console

**Symptoms**: `No 'Access-Control-Allow-Origin' header present`

**Diagnosis**:
```javascript
// In browser console
fetch('https://your-n8n.com/webhook/design-review', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({test: true})
}).then(r => console.log(r)).catch(e => console.error(e));
```

**Solution**:
- In n8n "Respond to Webhook" node, ensure CORS headers:
  ```json
  {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  }
  ```
- Handle OPTIONS preflight requests

---

## Backup & Recovery

### Automated Backups

#### n8n Workflow Backup

**GitHub Actions** (`.github/workflows/backup-n8n.yml`):

```yaml
name: Backup n8n Workflow

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Export n8n workflow
        run: |
          # Use n8n API to export workflow
          curl -X GET "https://your-n8n.com/api/v1/workflows/$WORKFLOW_ID" \
            -H "X-N8N-API-KEY: ${{ secrets.N8N_API_KEY }}" \
            -o n8n/design-review-workflow.json
      - name: Commit changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add n8n/design-review-workflow.json
          git commit -m "Automated n8n workflow backup" || echo "No changes"
          git push
```

#### Azure Blob Storage Backup

```bash
# Enable soft delete (recover deleted blobs within 7 days)
az storage blob service-properties delete-policy update \
  --account-name $STORAGE_ACCOUNT \
  --enable true \
  --days-retained 7

# Enable versioning
az storage account blob-service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --enable-versioning true
```

### Disaster Recovery Plan

**RTO**: 1 hour  
**RPO**: 24 hours

#### Recovery Steps

1. **Web App**:
   ```bash
   # Redeploy from GitHub
   git push origin main --force
   ```

2. **n8n Workflow**:
   ```bash
   # Import from backup
   # In n8n UI: Workflows → Import from File → n8n/design-review-workflow.json
   ```

3. **Azure Blob Storage**:
   ```bash
   # Restore from soft delete
   az storage blob undelete \
     --account-name $STORAGE_ACCOUNT \
     --container-name brand-config \
     --name oad-design-standards.json
   ```

---

## Cost Management

### Current Cost Estimates (Monthly)

| Service | Usage | Cost (USD) |
|---------|-------|------------|
| **Azure Static Web Apps** | 100GB bandwidth | $0 (free tier) |
| **Azure Blob Storage** | 10GB storage + 10k operations | $0.20 |
| **n8n Cloud** | 5 workflows, 2k executions | $20 |
| **OpenAI GPT-4o** | 500 reviews (~$0.01 each) | $5 |
| **Total** | | **~$25/month** |

### Cost Optimization Tips

1. **Azure Blob Storage**:
   - Use lifecycle policies to archive old reports
   ```bash
   az storage account management-policy create \
     --account-name $STORAGE_ACCOUNT \
     --policy '{
       "rules": [{
         "name": "archiveOldReports",
         "type": "Lifecycle",
         "definition": {
           "filters": {
             "blobTypes": ["blockBlob"],
             "prefixMatch": ["design-reviews/"]
           },
           "actions": {
             "baseBlob": {
               "tierToArchive": {"daysAfterModificationGreaterThan": 90}
             }
           }
         }
       }]
     }'
   ```

2. **n8n**:
   - Self-host on Azure Container Instances (cheaper than Cloud plan)
   - Cache brand standards to reduce Azure API calls

3. **OpenAI**:
   - Use lower `max_tokens` for simpler analyses
   - Implement caching for duplicate images

---

## Scaling Strategies

### Horizontal Scaling

#### n8n (Self-Hosted)

Deploy on Kubernetes for auto-scaling:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n
spec:
  replicas: 3  # Scale to 3 worker nodes
  selector:
    matchLabels:
      app: n8n
  template:
    metadata:
      labels:
        app: n8n
    spec:
      containers:
      - name: n8n
        image: n8nio/n8n:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: n8n-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: n8n
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Performance Optimization

#### CDN Configuration

```bash
# Azure CDN
az cdn endpoint rule add \
  --name oad-brand \
  --profile-name oad-brand-cdn \
  --resource-group $RESOURCE_GROUP \
  --order 1 \
  --rule-name CacheStaticAssets \
  --match-variable RequestUri \
  --operator Contains \
  --match-values ".css" ".js" ".png" ".jpg" \
  --action-name CacheExpiration \
  --cache-behavior Override \
  --cache-duration "7.00:00:00"
```

#### Image Optimization

Compress images before upload:

```bash
# Install ImageMagick
sudo apt install imagemagick

# Optimize PNG
mogrify -strip -quality 85 -resize 1920x1080\> *.png

# Optimize JPG
jpegoptim --size=200k --strip-all *.jpg
```

---

## Changelog & Version Control

### Version Tagging

```bash
# Tag a release
git tag -a v1.0.0 -m "Initial production release"
git push origin v1.0.0
```

### Rollback Procedure

```bash
# Rollback to previous version
git revert HEAD
git push origin main

# Or force rollback to specific commit
git reset --hard v1.0.0
git push --force origin main
```

---

## Appendix

### Useful Scripts

#### Health Check Script

```bash
#!/bin/bash
# health-check.sh

# Check web app
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://brand-review.bayer.com)
if [ $WEB_STATUS -ne 200 ]; then
  echo "❌ Web app is down (HTTP $WEB_STATUS)"
  exit 1
fi

# Check n8n webhook
N8N_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-n8n.com/webhook/design-review)
if [ $N8N_STATUS -ne 405 ]; then  # 405 = Method Not Allowed (expected for GET)
  echo "❌ n8n webhook is down (HTTP $N8N_STATUS)"
  exit 1
fi

echo "✅ All systems operational"
```

---

**Last Updated**: 2026-02-04  
**Version**: 1.0.0  
**Maintainer**: Michael Scrivana (Bayer DSO)
