# 🚀 Quick Start Guide

Get your OAD Brand Review Assistant up and running in **under 30 minutes**!

---

## ⚡ 5-Minute Local Setup

```bash
# 1. Clone and setup
git clone https://github.com/MichaelScrivana/OAD-DesignReviewer.git
cd OAD-DesignReviewer

# 2. Run automated setup
./setup.sh

# 3. Configure your Foundry agent (see Step 2 below)

# 4. Start the servers
npm start &  # API server on port 3001
cd src && npx serve  # Frontend on port 3000

# 5. Open browser
# Visit: http://localhost:3000
```

**Note**: For full functionality, you need to configure Azure AI Foundry. Local testing will show the UI but API calls will fail until Foundry is set up.

---

## 📋 Pre-Deployment Checklist

Before deploying, you need:

- [ ] **Azure Account** → [Sign up](https://azure.microsoft.com/free/)
- [ ] **Azure AI Foundry Resource** → Create in Azure Portal
- [ ] **Azure OpenAI Resource** → With GPT-4o deployment
- [ ] **Foundry Agent** → Created with brand compliance instructions
- [ ] **Node.js 18+** → [Download](https://nodejs.org/)

---

## 🎯 Step-by-Step Setup

### Step 1: Azure AI Foundry Setup (10 minutes)

1. **Create Azure AI Foundry Resource**:
   ```bash
   az cognitiveservices account create \
     --name "oad-ai-foundry" \
     --resource-group "rg-oad-brand-reviewer" \
     --kind "AIServices" \
     --sku "S0" \
     --location "eastus"
   ```

2. **Create Azure OpenAI Resource**:
   ```bash
   az cognitiveservices account create \
     --name "oad-openai" \
     --resource-group "rg-oad-brand-reviewer" \
     --kind "OpenAI" \
     --sku "S0" \
     --location "eastus"
   ```

3. **Deploy GPT-4o Model**:
   - Go to [Azure AI Foundry](https://ai.azure.com)
   - Select your resource
   - Go to "Models" → "Deployments"
   - Deploy GPT-4o model

### Step 2: Create Foundry Agent (5 minutes)

1. **Open Azure AI Foundry Studio** → https://ai.azure.com

2. **Create New Project**:
   - Name: "OAD Brand Review"
   - Resource: Your AI Foundry resource

3. **Create Agent**:
   - Go to "Playground" → "Agents"
   - Click "Create agent"
   - Name: "OAD Brand Compliance Agent"
   - Instructions:
     ```
     You are an expert brand compliance reviewer for Bayer's One A Day (OAD) vitamin brand.

     Your task is to analyze design images and check them against OAD brand guidelines:

     BRAND COLORS:
     - Primary: #FF6600 (Orange)
     - Secondary: #333333 (Dark Gray)
     - Accent: #F5F5F5 (Light Gray)
     - Neutral: #FFFFFF (White), #000000 (Black)

     LOGO REQUIREMENTS:
     - Minimum width: 120px
     - Minimum height: 60px
     - Clear space: 20px around logo
     - No modifications to logo design

     TYPOGRAPHY:
     - Primary font: Helvetica Neue
     - Approved weights: 300, 400, 500, 700
     - Minimum size: 14px for accessibility

     ACCESSIBILITY:
     - WCAG AA contrast ratio: 4.5:1 minimum
     - Color combinations must meet contrast requirements

     When analyzing a design:
     1. Examine the image for logo usage, colors, fonts, and layout
     2. Check compliance against all guidelines
     3. Provide a compliance score (0-100)
     4. List specific violations, warnings, and recommendations
     5. Be specific and actionable in your feedback
     ```

4. **Copy Agent Details**:
   - Copy the **Agent ID** (looks like: `asst_...`)
   - Copy the **Project Endpoint** (format: `https://your-resource.services.ai.azure.com/api/projects/your-project-name`)

### Step 3: Configure Application (2 minutes)

**Option A: Environment Variables (Recommended)**

```bash
# Copy template
cp .env.example .env

# Edit .env with your values
FOUNDRY_ENDPOINT=https://your-foundry-resource.services.ai.azure.com/api/projects/your-project-name
FOUNDRY_AGENT_ID=your-agent-id-here
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_KEY=your-api-key-here
```

**Option B: Direct Configuration**

Edit `src/app.js` and update the CONFIG object:

```javascript
const CONFIG = {
    // Foundry Agent Configuration
    foundryEndpoint: 'https://your-foundry-resource.services.ai.azure.com/api/projects/your-project-name',
    agentId: 'your-agent-id-here',
    azureOpenaiEndpoint: 'https://your-openai-resource.openai.azure.com',
    azureOpenaiDeployment: 'gpt-4o',

    // File constraints
    maxFileSize: 10 * 1024 * 1024,
    allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    apiTimeout: 120000
};
```

### Step 4: Test End-to-End (3 minutes)

1. **Start the API server**:
   ```bash
   npm start
   ```

2. **Start the frontend** (in another terminal):
   ```bash
   cd src
   npx serve
   ```

3. **Open browser**: http://localhost:3000

4. **Test the system**:
   - Upload a sample design image (PNG/JPG)
   - Select brand: "One A Day"
   - Select design type: "Social Media Post"
   - Enter your email
   - Click "Analyze Design"
   - Wait 10-30 seconds for Foundry agent response
   - View compliance report with score, violations, warnings

**Expected result**: You should see a detailed compliance report analyzed by your Foundry agent!

---

## 🧪 Testing with Mock Data

To test the UI without Foundry setup:

```javascript
// Open browser console on the web app
window.brandReviewApp.loadMockResults();
```

This will populate the results section with sample data.

---

## 🔧 Troubleshooting

### Issue: "Failed to call Foundry agent"

**Fix**:
1. Check your `.env` file has correct values
2. Verify your Foundry agent is active in Azure AI Studio
3. Check Azure OpenAI endpoint and API key
4. Test the API server health: http://localhost:3001/health

### Issue: "Agent not responding"

**Fix**:
1. Check your agent ID is correct
2. Verify the project endpoint URL
3. Ensure your Azure account has access to the Foundry resource
4. Check Azure OpenAI deployment is active

### Issue: CORS errors

**Fix**:
1. The API server includes CORS headers by default
2. If deploying separately, ensure CORS is configured:
   ```javascript
   app.use(cors({
     origin: 'http://localhost:3000', // or your frontend URL
     methods: ['POST', 'GET'],
     allowedHeaders: ['Content-Type']
   }));
   ```

---

## 📊 What's Included

```
✅ Static web app (HTML/CSS/JS)
✅ Node.js API server (Foundry proxy)
✅ Azure AI Foundry agent integration
✅ Comprehensive documentation
✅ Automated setup script
✅ Environment configuration
✅ CI/CD pipeline ready
```

---

## 💰 Cost Estimate

| Service | Monthly Cost |
|---------|--------------|
| Azure AI Foundry | $10 (S0 tier) |
| Azure OpenAI GPT-4o | $5 (500 reviews) |
| Azure Blob Storage | $0.20 |
| Node.js Hosting | $0 (self-hosted) |
| **Total** | **~$15.20/month** |

---

## 📚 Next Steps

1. ✅ Set up your Foundry agent (you're here!)
2. 📖 Read the [User Guide](docs/user-guide.md) to learn features
3. 🔒 Review [Security Best Practices](docs/admin-guide.md#security-hardening)
4. 📊 Set up [Monitoring & Alerts](docs/admin-guide.md#monitoring--maintenance)
5. 🚀 Share with your design team!

---

## 🆘 Getting Help

**Technical Issues**:
- GitHub Issues: https://github.com/MichaelScrivana/OAD-DesignReviewer/issues

**Azure AI Foundry**:
- Documentation: https://learn.microsoft.com/azure/ai-studio
- Support: https://azure.microsoft.com/support/

**Project-Specific Questions**:
- Email: michael.scrivana@bayer.com

---

## 🎉 Success!

You've successfully integrated Azure AI Foundry with your OAD Brand Review Assistant!

**Share your feedback** and **report issues** to help us improve the system.

---

**Built with ❤️ at Bayer | Powered by Azure AI Foundry**
