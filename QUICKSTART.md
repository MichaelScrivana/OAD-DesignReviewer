# 🚀 Quick Start Guide

Get your OAD Brand Review Assistant up and running in **under 30 minutes**!

---

## ⚡ 5-Minute Setup (Local Testing)

```bash
# 1. Navigate to project
cd /workspaces/OAD-DesignReviewer

# 2. Test web app locally
cd src
npx serve

# 3. Open browser
# Visit: http://localhost:3000
```

**Note**: Local testing will show the UI but API calls will fail until n8n is configured.

---

## 📋 Pre-Deployment Checklist

Before deploying, you need:

- [ ] **OpenAI API Key** → [Get one here](https://platform.openai.com/api-keys)
- [ ] **Azure Account** → [Sign up](https://azure.microsoft.com/free/)
- [ ] **n8n Account** → [Sign up](https://n8n.io) (Cloud or self-host)
- [ ] **GitHub Account** → [Sign up](https://github.com)

---

## 🎯 Step-by-Step Deployment

### Step 1: Set Up Azure (10 minutes)

```bash
# Create storage account
 az storage account create\
  --name oadbrandstorage \
  --resource-group rg-oad-brand-reviewer \
  --location eastus \
  --sku Standard_LRS

# Create containers
az storage container create --name brand-config --account-name oadbrandstorage
az storage container create --name design-uploads --account-name oadbrandstorage
az storage container create --name design-reviews --account-name oadbrandstorage

# Upload brand standards
az storage blob upload \
  --account-name oadbrandstorage \
  --container-name brand-config \
  --name oad-design-standards.json \
  --file ./azure/oad-design-standards.json

# Generate SAS token (1 year expiry)
az storage blob generate-sas \
  --account-name oadbrandstorage \
  --container-name brand-config \
  --name oad-design-standards.json \
  --permissions r \
  --expiry $(date -u -d "+1 year" '+%Y-%m-%dT%H:%MZ') \
  --https-only \
  --full-uri
```

**Save the SAS URL** - you'll need it for n8n!

---

### Step 2: Import n8n Workflow (5 minutes)

1. **Log in to n8n** → https://app.n8n.cloud (or your self-hosted instance)
2. **Import workflow**:
   - Click **Workflows** → **Import from File**
   - Select `n8n/design-review-workflow.json`
   - Click **Import**
3. **Configure credentials**:
   - **OpenAI API**: Add your API key
   - **Azure Blob SAS URL**: Paste SAS URL from Step 1
4. **Copy webhook URL**:
   - Click on "Webhook Trigger" node
   - Copy the URL (e.g., `https://your-n8n.com/webhook/design-review`)
5. **Activate workflow**: Toggle the switch to "Active"

---

### Step 3: Update Web App Configuration (2 minutes)

Edit `src/app.js` (line 10):

```javascript
const CONFIG = {
    n8nWebhookUrl: 'https://your-n8n.com/webhook/design-review', // ← PASTE YOUR WEBHOOK URL HERE
    maxFileSize: 10 * 1024 * 1024,
    allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml']
};
```

**Save the file!**

---

### Step 4: Deploy Web App (5 minutes)

**Option A: GitHub Pages (Easiest)**

```bash
# Push to GitHub
git add .
git commit -m "Initial deployment"
git push origin main

# Enable GitHub Pages
# Go to: Settings → Pages → Source: main → /src → Save
```

**Your site**: `https://[username].github.io/OAD-DesignReviewer/`

**Option B: Azure Static Web Apps**

```bash
# Create Static Web App
az staticwebapp create \
  --name oad-brand-reviewer \
  --resource-group rg-oad-brand-reviewer \
  --location eastus \
  --source https://github.com/[username]/OAD-DesignReviewer \
  --branch main \
  --app-location "/src"
```

**Your site**: `https://oad-brand-reviewer.azurestaticapps.net`

---

### Step 5: Test End-to-End (3 minutes)

1. **Open your deployed web app**
2. **Upload a sample image** (PNG/JPG)
3. **Select**:
   - Brand: "One A Day"
   - Design Type: "Social Media Post"
   - Email: your email
4. **Click "Analyze Design"**
5. **Wait 10-30 seconds**
6. **View compliance report** with score, violations, warnings

**Expected result**: You should see a detailed compliance report with:
- Compliance score (0-100)
- Critical violations
- Warnings
- Recommendations
- Detailed findings (logo, colors, typography, accessibility)

---

## 🧪 Testing with Mock Data

To test the UI without backend setup:

```javascript
// Open browser console on the web app
window.brandReviewApp.loadMockResults();
```

This will populate the results section with sample data.

---

## 🔧 Troubleshooting

### Issue: "Failed to analyze design"

**Fix**:
1. Check n8n workflow is **Active**
2. Verify webhook URL in `app.js` is correct
3. Test webhook directly:
   ```bash
   curl -X POST https://your-n8n.com/webhook/design-review \
     -H "Content-Type: application/json" \
     -d '{"brandId":"OAD","designType":"test","submittedBy":"test@test.com","imageFile":"test","imageMimeType":"image/png","imageName":"test.png"}'
   ```

### Issue: CORS errors

**Fix**:
1. In n8n, check "Respond to Webhook" node has CORS headers:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: POST, OPTIONS`

### Issue: SAS token expired

**Fix**:
1. Generate new SAS token (see Step 1)
2. Update URL in n8n "Fetch Brand Standards" node
3. Save workflow

---

## 📊 What's Included

```
✅ Static web app (HTML/CSS/JS)
✅ n8n workflow (AI orchestration)
✅ Azure configuration (storage setup)
✅ Complete documentation (architecture, user guide, admin guide)
✅ GitHub Actions CI/CD pipeline
✅ Brand standards JSON (OAD guidelines)
```

---

## 💰 Cost Estimate

| Service | Monthly Cost |
|---------|--------------|
| Azure Blob Storage | $0.20 |
| n8n Cloud | $20 (or $0 if self-hosted) |
| OpenAI GPT-4o | $5 (500 reviews) |
| GitHub Pages | $0 |
| **Total** | **~$25/month** |

---

## 📚 Next Steps

1. ✅ Deploy the application (you did it!)
2. 📖 Read the [User Guide](docs/user-guide.md) to learn features
3. 🔒 Review [Security Best Practices](docs/admin-guide.md#security-hardening)
4. 📊 Set up [Monitoring & Alerts](docs/admin-guide.md#monitoring--maintenance)
5. 🚀 Share with your design team!

---

## 🆘 Getting Help

**Technical Issues**:
- GitHub Issues: https://github.com/MichaelScrivana/OAD-DesignReviewer/issues

**Brand Guidelines Questions**:
- Email: brand-team@bayer.com

**Project-Specific Questions**:
- Email: michael.scrivana@bayer.com

---

## 🎉 Success!

You've successfully deployed the OAD Brand Review Assistant! 

**Share your feedback** and **report issues** to help us improve the system.

---

**Built with ❤️ at Bayer | Powered by n8n + GPT-4o Vision**
