# OAD Brand Review Assistant

> AI-powered brand compliance checking system for Bayer's One A Day (OAD) brand using Azure AI Foundry Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Azure Foundry](https://img.shields.io/badge/Azure-Foundry-0078D4)](https://azure.microsoft.com/products/ai-studio)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991)](https://openai.com)
[![Azure](https://img.shields.io/badge/Azure-Blob%20Storage-0078D4)](https://azure.microsoft.com)

---

## 🚀 Project Overview

The **OAD Brand Review Assistant** is an AI-powered system that automatically checks design compliance against brand guidelines using Azure AI Foundry agents. Designers can upload images, select their brand, and receive instant feedback on:

- ✅ Logo usage (size, placement, clearspace)
- 🎨 Color palette compliance
- 📝 Typography standards
- ♿ Accessibility requirements (WCAG contrast ratios)

The system provides detailed, actionable reports with violations, warnings, and recommendations—reducing brand review cycles from days to seconds.

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Web App       │  ← User uploads design image
│  (HTML/CSS/JS)  │
└────────┬────────┘
         │ POST /api/foundry-agent
         ↓
┌─────────────────┐
│   Node.js API   │  ← Proxy server for Foundry calls
│   Server        │
└────────┬────────┘
         │ Foundry Agent Query
         ↓
┌─────────────────┐
│ Azure AI Foundry│  ← AI agent with brand knowledge
│     Agent       │
│                 │
│  • GPT-4o Vision│  ← Image analysis
│  • Brand Rules  │  ← Knowledge indexes
│  • Evaluation   │  ← Quality assessment
└────────┬────────┘
         │ JSON Report
         ↓
┌─────────────────┐
│   Azure Blob    │  ← Store reports for audit trail
│   Storage       │
└─────────────────┘
```

---

## ✨ Features

### For Designers
- **Instant Feedback**: Get compliance results in <30 seconds
- **Detailed Reports**: Visual breakdown of violations, warnings, and passed checks
- **Actionable Recommendations**: Specific guidance on fixing issues
- **Download Reports**: Export as Markdown for documentation
- **Mobile-Responsive**: Works on desktop, tablet, and mobile

### For Brand Teams
- **Automated Pre-Screening**: Reduce manual review workload by 70%
- **Audit Trail**: All reviews stored in Azure for compliance tracking
- **Consistent Standards**: AI applies guidelines uniformly
- **Scalable**: Review hundreds of designs without additional headcount

### Technical Capabilities
- **Multi-Brand Support**: Supports OAD, Claritin, Aleve, Bayer Aspirin, Citracal
- **Design Type Awareness**: Tailored checks for social media, banners, emails, print, packaging
- **Color Detection**: Automatically identifies hex codes in designs
- **Typography Analysis**: Detects fonts and validates against approved list
- **Accessibility Checks**: WCAG AA contrast ratio validation

---

## 📁 Project Structure

```
OAD-DesignReviewer/
├── src/                          # Web application
│   ├── index.html                # Main UI with upload form & results
│   ├── styles.css                # Responsive CSS with OAD brand colors
│   └── app.js                    # Frontend logic & Foundry API integration
├── server.js                     # Node.js API server for Foundry proxy
├── package.json                  # Node.js dependencies
├── .env.example                  # Environment variables template
├── azure/                        # Cloud configuration
│   ├── oad-design-standards.json # Brand guidelines data
│   ├── mcp-integration-guide.md  # Azure MCP usage guide
│   └── foundry-agent-integration.md # Foundry setup instructions
├── docs/                         # Documentation
│   ├── architecture.md           # System design & data flow
│   ├── user-guide.md             # How to use the web app
│   └── admin-guide.md            # Deployment & maintenance
├── .github/workflows/            # CI/CD
│   └── deploy.yml                # GitHub Actions for Azure deployment
├── .gitignore                    # Git ignore rules
├── LICENSE                       # MIT License
└── README.md                     # This file
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Static web app for user interaction |
| **Backend API** | Node.js + Express | Proxy server for Foundry agent calls |
| **AI Agent** | Azure AI Foundry | AI agent orchestration & evaluation |
| **AI/ML** | Azure OpenAI GPT-4o | Image analysis & compliance checking |
| **Storage** | Azure Blob Storage | Brand guidelines, images, reports |
| **Deployment** | Azure Static Web Apps / GitHub Pages | Hosting & CDN |
| **CI/CD** | GitHub Actions | Automated deployment pipeline |

---

## 🚦 Quick Start

### Prerequisites

- **Node.js** (for local testing with `npx serve`)
- **n8n account** (Cloud or self-hosted)
- **OpenAI API key** (with GPT-4o Vision access)
- **Azure account** (with Blob Storage)

### 1. Clone the Repository

```bash
git clone https://github.com/MichaelScrivana/OAD-DesignReviewer.git
cd OAD-DesignReviewer
```

### 2. Set Up Azure Blob Storage

Follow the comprehensive guide: **[azure/setup-guide.md](azure/setup-guide.md)**

**Summary**:
1. Create Azure Storage Account
2. Create 3 containers: `brand-config`, `design-uploads`, `design-reviews`
3. Upload `azure/oad-design-standards.json` to `brand-config`
4. Generate SAS tokens (read access for brand standards)
5. Save SAS URL for n8n configuration

### 3. Set Up Azure AI Foundry Agent

Follow the setup guide: **[azure/foundry-agent-integration.md](azure/foundry-agent-integration.md)**

**Summary**:
1. Create Azure AI Foundry resource
2. Deploy GPT-4o model in Foundry Studio
3. Create a new agent with brand compliance instructions
4. Copy your agent ID and endpoint URL

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your Foundry configuration:

```bash
# Foundry Agent Configuration
FOUNDRY_ENDPOINT=https://your-foundry-resource.services.ai.azure.com/api/projects/your-project-name
FOUNDRY_AGENT_ID=your-agent-id-here

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_KEY=your-api-key-here
```

### 5. Configure Web App

Edit `src/app.js` and update the Foundry configuration:

```javascript
const CONFIG = {
    // Foundry Agent Configuration - UPDATE THESE VALUES
    foundryEndpoint: 'https://your-foundry-resource.services.ai.azure.com/api/projects/your-project-name', // ← CHANGE THIS
    agentId: 'your-agent-id', // ← CHANGE THIS
    azureOpenaiEndpoint: 'https://your-openai-resource.openai.azure.com', // ← CHANGE THIS
    azureOpenaiDeployment: 'gpt-4o', // ← CHANGE THIS IF DIFFERENT

    // File constraints
    maxFileSize: 10 * 1024 * 1024,
    allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    apiTimeout: 120000 // 2 minutes for Foundry agents
};
```

### 6. Install Dependencies & Test Locally

```bash
# Install Node.js dependencies
npm install

# Start the API server
npm start
```

In another terminal, serve the frontend:

```bash
cd src
npx serve
```

Open http://localhost:3000 in your browser.

**Test the flow**:
1. Upload a sample design image (PNG/JPG)
2. Select brand: "One A Day"
3. Select design type: "Social Media Post"
4. Enter your email
5. Click "Analyze Design"
6. View compliance report with score, violations, warnings

### 7. Deploy to Production

**Option A: Azure Static Web Apps + Azure App Service** (Recommended)

```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./src --deployment-token <YOUR_TOKEN>
```

**Option B: GitHub Pages**

1. Push code to GitHub
2. Go to **Settings** → **Pages**
3. Source: Deploy from a branch → `main` → `/src`
4. Save

**Option C: Azure Blob Storage Static Website**

```bash
# Enable static website hosting
az storage blob service-properties update \
  --account-name oadbrandstorage \
  --static-website \
  --index-document index.html

# Upload files
az storage blob upload-batch \
  --account-name oadbrandstorage \
  --source ./src \
  --destination '$web'
```

---

## 📖 Documentation

- **[Architecture Guide](docs/architecture.md)** - System design, data flow, security
- **[User Guide](docs/user-guide.md)** - How to use the web app
- **[Admin Guide](docs/admin-guide.md)** - Deployment, configuration, monitoring
- **[n8n Setup](n8n/README.md)** - Workflow installation & customization
- **[Azure Setup](azure/setup-guide.md)** - Cloud storage configuration

---

## 🎯 Use Cases

### 1. Design Team Pre-Flight Check
Before submitting designs to brand team, designers run them through the assistant to catch obvious violations early.

### 2. Agency Partner Onboarding
External agencies use the tool to self-check designs against brand guidelines, reducing back-and-forth iterations.

### 3. Audit & Compliance
Brand team reviews historical submissions stored in Azure to identify common mistakes and update training materials.

### 4. Template Validation
Marketing teams validate email templates, banner ads, and social media templates before deployment.

---

## 🧪 Testing with Mock Data

To test the UI without the backend, use the built-in mock data function:

1. Open browser console on the web app
2. Run:
   ```javascript
   window.brandReviewApp.loadMockResults();
   ```
3. View a sample compliance report with violations, warnings, and recommendations

---

## 🔒 Security & Compliance

### Data Privacy
- **Image data is not stored permanently** unless explicitly saved to Azure for audit
- **No personally identifiable information (PII)** is collected beyond email
- **HTTPS enforced** for all API communication

### API Keys & Secrets
- ✅ **Never commit API keys** to version control
- ✅ **Use n8n Credentials Manager** for OpenAI API key
- ✅ **Use SAS tokens** (not account keys) for Azure Blob Storage
- ✅ **Rotate SAS tokens annually**

### Access Control
- Web app can be restricted to Bayer employees using **Azure AD authentication**
- n8n webhook can require **authentication headers**
- Azure Blob Storage uses **private containers** with SAS tokens

---

## 🚧 Roadmap / Future Enhancements

### Phase 2: RAG-Powered Guidelines Agent
- **PDF Ingestion**: Parse brand guidelines PDF and index to Pinecone vector database
- **Natural Language Q&A**: "What are the approved logo sizes for social media?"
- **Contextual Recommendations**: AI references specific guideline pages in reports

### Phase 3: Copy & Content Assistance
- **Headline Generation**: AI suggests on-brand headlines and copy
- **Tone Analysis**: Check if messaging aligns with brand voice
- **A/B Testing**: Generate multiple copy variations

### Phase 4: Asset Management Integration
- **DAM Search**: Find approved logos, images, icons from digital asset management system
- **Asset Metadata**: Automatically tag uploaded designs with brand, type, date
- **Version Control**: Track design iterations and approvals

### Phase 5: Enterprise Features
- **Azure AD SSO**: Restrict access to Bayer employees
- **Teams Integration**: Submit designs via Microsoft Teams bot
- **Batch Processing**: Review multiple images simultaneously
- **Dashboard Analytics**: View trends, common violations, team performance

---

## 🤝 Contributing

This project is maintained internally by Bayer's DSO (Digital Solutions Organization). For external contributors:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Contribution Guidelines**:
- Follow existing code style (ESLint, Prettier)
- Add tests for new features
- Update documentation (README, inline comments)
- Ensure all workflows pass in GitHub Actions

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors & Acknowledgments

**Project Lead**: Michael Scrivana (Bayer Digital Solutions Organization)

**Inspired by**:
- Bayer's DSO operating model (federated automation champions)
- n8n community workflows
- OpenAI GPT-4o Vision API examples

**Special Thanks**:
- Bayer Brand Team for providing brand guidelines
- n8n community for workflow inspiration
- OpenAI for GPT-4o Vision API access

---

## 📞 Support & Contact

### For Technical Issues
- **GitHub Issues**: https://github.com/MichaelScrivana/OAD-DesignReviewer/issues
- **n8n Community**: https://community.n8n.io

### For Brand Guideline Questions
- **Email**: brand-team@bayer.com
- **Brand Portal**: https://bayer-brand-portal.com/oad

### For DSO/AACoE Inquiries
- **Email**: michael.scrivana@bayer.com
- **Internal Wiki**: [Bayer Confluence - AACoE Proposal]

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/MichaelScrivana/OAD-DesignReviewer?style=social)
![GitHub forks](https://img.shields.io/github/forks/MichaelScrivana/OAD-DesignReviewer?style=social)
![GitHub issues](https://img.shields.io/github/issues/MichaelScrivana/OAD-DesignReviewer)
![GitHub last commit](https://img.shields.io/github/last-commit/MichaelScrivana/OAD-DesignReviewer)

---

**Built with ❤️ at Bayer | Powered by n8n + GPT-4o Vision**
Agent to review designs
