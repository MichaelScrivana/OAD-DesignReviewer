# Azure Blob Storage Setup Guide

## Overview

This guide walks you through setting up Azure Blob Storage to host brand guidelines, design standards, uploaded images, and compliance reports for the OAD Brand Review Assistant.

---

## Prerequisites

- **Azure Account** with active subscription
- **Azure CLI** installed (optional, but recommended)
- **Azure Storage Explorer** (optional, for GUI management)

---

## Step 1: Create Azure Storage Account

### Using Azure Portal

1. **Sign in to Azure Portal**: https://portal.azure.com
2. **Create Storage Account**:
   - Click **"Create a resource"** → Search for **"Storage account"**
   - Click **"Create"**
3. **Configure Basic Settings**:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or use existing (e.g., `rg-oad-brand-reviewer`)
   - **Storage Account Name**: `oadbrandstorageXXXX` (must be globally unique, lowercase, no special characters)
   - **Region**: Choose closest to your users (e.g., `East US`, `West Europe`)
   - **Performance**: **Standard**
   - **Redundancy**: **LRS (Locally Redundant Storage)** (cost-effective) or **GRS (Geo-Redundant)** (for high availability)
4. **Advanced Settings**:
   - **Security**: Enable **"Require secure transfer (HTTPS)"**
   - **Blob Storage**: Enable **"Allow Blob public access"** (optional, only if serving public assets)
   - **Hierarchical Namespace**: **Disabled** (unless using Data Lake features)
5. **Review + Create** → Click **"Create"**
6. Wait for deployment to complete (~2 minutes)

### Using Azure CLI

```bash
# Variables
RESOURCE_GROUP="rg-oad-brand-reviewer"
STORAGE_ACCOUNT="oadbrandstorage$(openssl rand -hex 4)"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --allow-blob-public-access false

echo "Storage Account Created: $STORAGE_ACCOUNT"
```

---

## Step 2: Create Blob Containers

You need 3 containers:

| Container Name | Purpose | Access Level |
|----------------|---------|--------------|
| `brand-config` | Store brand standards JSON | Private |
| `design-uploads` | Store uploaded design images | Private |
| `design-reviews` | Store completed review reports | Private |

### Using Azure Portal

1. Go to your Storage Account → **"Containers"** (under Data storage)
2. Click **"+ Container"**
3. Create each container:
   - **Name**: `brand-config`
   - **Public access level**: **Private (no anonymous access)**
   - Click **"Create"**
4. Repeat for `design-uploads` and `design-reviews`

### Using Azure CLI

```bash
# Get connection string
CONNECTION_STRING=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Create containers
az storage container create --name brand-config --connection-string $CONNECTION_STRING
az storage container create --name design-uploads --connection-string $CONNECTION_STRING
az storage container create --name design-reviews --connection-string $CONNECTION_STRING

echo "Containers created successfully"
```

---

## Step 3: Upload Brand Standards JSON

1. **Prepare the file**: Use `azure/oad-design-standards.json` from this repository
2. **Upload to Azure**:

### Using Azure Portal

1. Go to **Storage Account** → **Containers** → `brand-config`
2. Click **"Upload"**
3. Select `oad-design-standards.json`
4. Click **"Upload"**

### Using Azure CLI

```bash
az storage blob upload \
  --container-name brand-config \
  --name oad-design-standards.json \
  --file ./azure/oad-design-standards.json \
  --connection-string $CONNECTION_STRING \
  --content-type application/json

echo "Brand standards uploaded"
```

---

## Step 4: Generate SAS Tokens

**SAS (Shared Access Signature)** tokens provide secure, time-limited access to your blobs without exposing account keys.

### Generate SAS Token for Brand Standards (Read-Only)

#### Using Azure Portal

1. Go to **Storage Account** → **Containers** → `brand-config`
2. Click on `oad-design-standards.json`
3. Click **"Generate SAS"** (top menu)
4. Configure SAS:
   - **Permissions**: **Read** only
   - **Start date**: Today
   - **Expiry date**: 1 year from now (e.g., 2027-02-04)
   - **Allowed IP addresses**: Leave blank (or restrict to your n8n server IP)
   - **Allowed protocols**: **HTTPS only**
5. Click **"Generate SAS token and URL"**
6. **Copy the "Blob SAS URL"** (starts with `https://oadbrandstorage...`)
7. **Save this URL securely** - you'll need it for n8n configuration

#### Using Azure CLI

```bash
# Generate SAS token with 1-year expiry
EXPIRY_DATE=$(date -u -d "+1 year" '+%Y-%m-%dT%H:%MZ')

SAS_TOKEN=$(az storage blob generate-sas \
  --account-name $STORAGE_ACCOUNT \
  --container-name brand-config \
  --name oad-design-standards.json \
  --permissions r \
  --expiry $EXPIRY_DATE \
  --https-only \
  --output tsv)

# Construct full URL
BLOB_URL="https://$STORAGE_ACCOUNT.blob.core.windows.net/brand-config/oad-design-standards.json?$SAS_TOKEN"

echo "SAS URL for brand standards:"
echo $BLOB_URL
```

**⚠️ Important**: Save this SAS URL in a secure location. You'll use it in your n8n workflow.

### Generate SAS Token for Container (Write Access for Reports)

If you want n8n to save compliance reports back to Azure, generate a container-level SAS token:

```bash
# Generate container SAS token with write permission
CONTAINER_SAS=$(az storage container generate-sas \
  --account-name $STORAGE_ACCOUNT \
  --name design-reviews \
  --permissions rwdl \
  --expiry $EXPIRY_DATE \
  --https-only \
  --output tsv)

CONTAINER_URL="https://$STORAGE_ACCOUNT.blob.core.windows.net/design-reviews?$CONTAINER_SAS"

echo "Container SAS URL for saving reports:"
echo $CONTAINER_URL
```

---

## Step 5: Configure CORS (Optional)

If your web app needs to directly upload images to Azure Blob Storage (instead of sending them through n8n), enable CORS.

### Using Azure Portal

1. Go to **Storage Account** → **Settings** → **Resource sharing (CORS)**
2. Click **"Blob service"** tab
3. Add CORS rule:
   - **Allowed origins**: `*` (or your specific domain, e.g., `https://yourdomain.com`)
   - **Allowed methods**: `GET, POST, PUT, OPTIONS`
   - **Allowed headers**: `*`
   - **Exposed headers**: `*`
   - **Max age**: `3600`
4. Click **"Save"**

### Using Azure CLI

```bash
az storage cors add \
  --account-name $STORAGE_ACCOUNT \
  --services b \
  --methods GET POST PUT OPTIONS \
  --origins '*' \
  --allowed-headers '*' \
  --exposed-headers '*' \
  --max-age 3600
```

---

## Step 6: Secure Your Storage Account

### Enable Firewall (Optional)

Restrict access to specific IP addresses or virtual networks:

1. Go to **Storage Account** → **Security + networking** → **Networking**
2. **Public network access**: Select **"Enabled from selected virtual networks and IP addresses"**
3. **Firewall**:
   - Add your n8n server's public IP address
   - Add your office/development IP addresses
4. Click **"Save"**

### Enable Storage Account Encryption

Azure Storage is encrypted by default using Microsoft-managed keys. For additional security:

1. Go to **Security + networking** → **Encryption**
2. Choose **"Customer-managed keys"** (optional, for enhanced control)
3. Configure Azure Key Vault integration

---

## Step 7: Monitor Storage Usage

### Set Up Alerts

1. Go to **Storage Account** → **Monitoring** → **Alerts**
2. Create alert rules:
   - **Storage capacity approaching limit**
   - **High API request rates** (to detect abuse)
   - **Failed requests**

### View Metrics

1. Go to **Monitoring** → **Metrics**
2. Add charts for:
   - **Blob capacity**
   - **Transactions**
   - **Availability**
   - **Ingress/Egress**

---

## Configuration Summary

After completing all steps, you'll have:

| Item | Value | Where to Use |
|------|-------|--------------|
| **Storage Account Name** | `oadbrandstorageXXXX` | n8n workflow, documentation |
| **Brand Standards SAS URL** | `https://...blob.core.windows.net/brand-config/oad-design-standards.json?sp=r&...` | n8n "Fetch Brand Standards" node |
| **Design Reviews Container SAS** | `https://...blob.core.windows.net/design-reviews?sp=rwdl&...` | n8n "Save Report" node (optional) |
| **Storage Account Key** | `[64-character key]` | n8n Azure Storage credentials (if using native Azure node) |

---

## Step 8: Upload Agent Instructions as Knowledge File

To enhance your Foundry agent with RAG (Retrieval-Augmented Generation), upload the agent instructions as a knowledge file.

### Option A: Azure AI Foundry Portal

1. **Navigate to Azure AI Foundry** → Your Project → **Knowledge** → **+ Add Knowledge**
2. **Select Source**: Choose **"Upload files"**
3. **Upload Files**:
   - Upload `azure/agent-instructions.md` from this repository
   - Upload `brand-data/brands/OAD/brand-rules.json`
   - Upload `brand-data/brands/OAD/scoring-rubric.json`
4. **Configure Index**:
   - **Index Name**: `oad-brand-guidelines`
   - **Chunking Strategy**: `Sentence` (recommended for structured content)
   - **Chunk Size**: 512 tokens
   - **Overlap**: 128 tokens
5. **Create Embeddings**: Let Azure create vector embeddings
6. **Attach to Agent**: In your agent settings, connect this knowledge index

### Option B: Upload to Azure Blob + AI Search Index

```bash
# Upload agent instructions to brand-config container
az storage blob upload \
  --container-name brand-config \
  --name agent-instructions.md \
  --file ./azure/agent-instructions.md \
  --connection-string $CONNECTION_STRING \
  --content-type text/markdown

# Upload brand rules
az storage blob upload \
  --container-name brand-config \
  --name brand-rules.json \
  --file ./brand-data/brands/OAD/brand-rules.json \
  --connection-string $CONNECTION_STRING \
  --content-type application/json

# Upload scoring rubric
az storage blob upload \
  --container-name brand-config \
  --name scoring-rubric.json \
  --file ./brand-data/brands/OAD/scoring-rubric.json \
  --connection-string $CONNECTION_STRING \
  --content-type application/json

echo "Knowledge files uploaded"
```

Then create an Azure AI Search index pointing to these blobs for vector search.

### Option C: Azure MCP Commands

```bash
# List existing knowledge indexes
mcp_azure_mcp_foundry foundry_knowledge_index_list \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project"

# View index schema (after creation)
mcp_azure_mcp_foundry foundry_knowledge_index_schema \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project" \
  --index "oad-brand-guidelines"
```

---

## Step 9: Use Agent Instructions with the API

The agent instructions can be used as a system prompt when calling Azure OpenAI directly.

### Option A: Inline System Prompt (Current Approach)

The `server.js` already uses `generateSystemPrompt()` to dynamically build instructions from the JSON files:

```javascript
// In server.js - callFoundryAgent function
const brandData = loadBrandData('OAD');
const systemPrompt = generateSystemPrompt(brandData);

const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
        { type: 'text', text: 'Analyze this design for brand compliance' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
    ]}
];
```

### Option B: Load from Agent Instructions File

To use the comprehensive instructions directly:

```javascript
const fs = require('fs');
const path = require('path');

// Load agent instructions as system prompt
function loadAgentInstructions() {
    const instructionsPath = path.join(__dirname, 'azure', 'agent-instructions.md');
    const instructions = fs.readFileSync(instructionsPath, 'utf8');
    return instructions;
}

// Use in API call
const systemPrompt = loadAgentInstructions();
const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query }
];
```

### Option C: Azure Foundry Agent with Instructions

When creating a Foundry agent, paste the contents of `agent-instructions.md` into the agent's **Instructions** field:

1. Go to **Azure AI Foundry** → **Agents** → **+ Create Agent**
2. **Name**: `OAD Brand Compliance Reviewer`
3. **Model**: `gpt-4o` (vision-enabled)
4. **Instructions**: Paste full contents of `azure/agent-instructions.md`
5. **Knowledge**: Attach `oad-brand-guidelines` index (from Step 8)
6. **Tools**: Enable **Code Interpreter** (optional, for detailed analysis)
7. **Save and Deploy**

Then call via MCP:

```bash
mcp_azure_mcp_foundry foundry_agents_connect \
  --agent-id "oad-brand-compliance-reviewer" \
  --query "Analyze this design image for OAD brand compliance" \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project"
```

### Option D: API Call with cURL

```bash
curl -X POST "https://YOUR_ENDPOINT.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "messages": [
      {
        "role": "system",
        "content": "You are the One A Day (OAD) Brand Compliance Review Agent... [full instructions from agent-instructions.md]"
      },
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Analyze this design for brand compliance"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,YOUR_BASE64_IMAGE"}}
        ]
      }
    ],
    "max_tokens": 2000,
    "temperature": 0.3
  }'
```

### Environment Variables

Ensure these are set in your `.env` file:

```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

---

## Next Steps

1. ✅ Create Azure Storage Account
2. ✅ Create 3 blob containers
3. ✅ Upload `oad-design-standards.json`
4. ✅ Generate SAS tokens
5. ✅ Save SAS URLs securely
6. ✅ Upload agent instructions as knowledge file
7. ✅ Configure API with agent instructions
8. 🔄 Configure n8n workflow with Azure URLs
9. 🔄 Test end-to-end: Upload design → n8n fetches standards → Analysis → Save report

---

## Troubleshooting

### SAS Token Expired

**Error**: `403 Forbidden` or `Server failed to authenticate the request`

**Solution**:
1. Generate a new SAS token with extended expiry
2. Update the URL in your n8n workflow
3. Test the connection

### CORS Errors

**Error**: `No 'Access-Control-Allow-Origin' header is present`

**Solution**:
1. Enable CORS in Azure Storage (see Step 5)
2. Ensure your domain is in the allowed origins list
3. Use HTTPS for all requests

### Blob Not Found

**Error**: `404 Not Found`

**Solution**:
1. Verify the blob name matches exactly (case-sensitive)
2. Check that the container name is correct
3. Ensure the file was uploaded successfully

### Access Denied

**Error**: `403 Forbidden`

**Solution**:
1. Verify SAS token has correct permissions (`r` for read, `w` for write)
2. Check that SAS token hasn't expired
3. Ensure IP restrictions (if any) include your server's IP

---

## Cost Estimation

Azure Blob Storage pricing (as of 2026):

| Resource | Cost (USD/month) |
|----------|------------------|
| **Storage (Hot Tier)** | $0.018 per GB (~$1.80 for 100GB) |
| **Write Operations** | $0.055 per 10,000 operations (~$0.55 for 100,000 reviews) |
| **Read Operations** | $0.004 per 10,000 operations (~$0.04 for 100,000 fetches) |
| **Data Transfer (Outbound)** | $0.087 per GB (first 5GB free) |

**Estimated monthly cost for moderate usage**: **$5-10/month**

---

## Security Best Practices

1. ✅ **Use HTTPS only** for all blob access
2. ✅ **Generate SAS tokens with minimum required permissions** (read vs. write)
3. ✅ **Set SAS token expiry to 1 year maximum** and rotate regularly
4. ✅ **Never commit SAS URLs or account keys to version control**
5. ✅ **Enable firewall to restrict access to known IPs** (optional)
6. ✅ **Monitor access logs** for suspicious activity
7. ✅ **Use Azure AD authentication** for production (instead of SAS tokens)

---

## Support

- **Azure Documentation**: https://docs.microsoft.com/azure/storage/
- **Azure Storage Pricing**: https://azure.microsoft.com/pricing/details/storage/
- **Azure Support**: https://azure.microsoft.com/support/

For project-specific issues:
- **GitHub Issues**: https://github.com/MichaelScrivana/OAD-DesignReviewer/issues
