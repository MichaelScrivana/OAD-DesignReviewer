# n8n Workflow Setup Guide

## Overview

This directory contains the n8n workflow configuration for the OAD Brand Review Assistant. The workflow orchestrates AI-powered design compliance checking using GPT-4o Vision API.

## Workflow Architecture

```
[Webhook] → [Validate] → [Fetch Brand Standards] → [Prepare Analysis]
    ↓
[GPT-4o Vision] → [Parse Response] → [Automated Validation]
    ↓
[Format Report] → [Save to Azure] → [Respond to Webhook]
```

## Prerequisites

Before importing the workflow, ensure you have:

1. **n8n Instance** (Cloud or self-hosted)
2. **OpenAI API Key** (with GPT-4o Vision access)
3. **Azure Blob Storage Account** (with SAS tokens)
4. **Brand Standards JSON** uploaded to Azure Blob Storage

---

## Installation Steps

### 1. Import Workflow to n8n

1. Log in to your n8n instance
2. Click **Workflows** → **Import from File**
3. Select `design-review-workflow.json`
4. Click **Import**

### 2. Configure Credentials

#### OpenAI API Credentials

1. In n8n, go to **Credentials** → **Add Credential**
2. Select **OpenAI API**
3. Enter your OpenAI API key
4. Name it: `OpenAI API`
5. Save

#### Azure Blob Storage SAS URL (HTTP Header Auth)

1. In n8n, go to **Credentials** → **Add Credential**
2. Select **HTTP Header Auth**
3. Configure:
   - **Name**: `Azure Blob Storage SAS`
   - **Header Name**: `x-ms-blob-type`
   - **Header Value**: `BlockBlob`
4. Save

**Note**: The actual SAS URL will be configured directly in the "Fetch Brand Standards from Azure" node.

#### Azure Storage API (Optional - for saving reports)

1. In n8n, go to **Credentials** → **Add Credential**
2. Select **Microsoft Azure Storage**
3. Enter:
   - **Account Name**: Your Azure Storage account name
   - **Account Key**: Your Azure Storage account key
4. Name it: `Azure Blob Storage`
5. Save

### 3. Configure Webhook Node

1. Open the workflow in n8n
2. Click on the **"Webhook Trigger"** node
3. Copy the **Webhook URL** (e.g., `https://your-n8n.com/webhook/design-review`)
4. Update this URL in `src/app.js` → `CONFIG.n8nWebhookUrl`

### 4. Configure Azure Blob Storage URL

1. Click on the **"Fetch Brand Standards from Azure"** node
2. In the **URL** field, enter your Azure Blob SAS URL:
   ```
   https://[YOUR-STORAGE-ACCOUNT].blob.core.windows.net/brand-config/oad-design-standards.json?[YOUR-SAS-TOKEN]
   ```
3. Save the node

### 5. Test the Workflow

1. Click **Execute Workflow** in n8n
2. The workflow will wait for a webhook request
3. Use the web app or send a test POST request:

```bash
curl -X POST https://your-n8n.com/webhook/design-review \
  -H "Content-Type: application/json" \
  -d '{
    "brandId": "OAD",
    "designType": "social-media",
    "submittedBy": "test@bayer.com",
    "notes": "Test submission",
    "imageFile": "BASE64_ENCODED_IMAGE",
    "imageMimeType": "image/png",
    "imageName": "test-design.png"
  }'
```

### 6. Activate the Workflow

1. Toggle the **Active** switch in n8n to enable the webhook
2. The workflow is now ready to receive requests

---

## Workflow Nodes Explained

### 1. Webhook Trigger
- **Type**: `n8n-nodes-base.webhook`
- **Purpose**: Receives POST requests from the web app
- **Configuration**: Path = `/design-review`, Method = `POST`

### 2. Validate Input
- **Type**: `n8n-nodes-base.if`
- **Purpose**: Checks that required fields (imageFile, brandId) are present
- **Outputs**: True (continue) or False (error)

### 3. Fetch Brand Standards from Azure
- **Type**: `n8n-nodes-base.httpRequest`
- **Purpose**: Retrieves brand guidelines JSON from Azure Blob Storage
- **Configuration**: GET request with SAS URL

### 4. Prepare Analysis Data
- **Type**: `n8n-nodes-base.code` (JavaScript)
- **Purpose**: Constructs the prompt for GPT-4o Vision with brand guidelines
- **Logic**: Combines brand standards, user input, and creates structured prompt

### 5. GPT-4o Vision Analysis
- **Type**: `n8n-nodes-base.openAi`
- **Purpose**: Sends image + prompt to OpenAI GPT-4o Vision API
- **Configuration**: 
  - Model: `gpt-4o`
  - Temperature: `0.3` (for consistent results)
  - Max Tokens: `2000`

### 6. Parse AI Response
- **Type**: `n8n-nodes-base.code` (JavaScript)
- **Purpose**: Extracts and validates JSON from AI response
- **Error Handling**: Returns fallback report if parsing fails

### 7. Automated Validation
- **Type**: `n8n-nodes-base.code` (JavaScript)
- **Purpose**: Programmatically validates detected colors against approved palette
- **Logic**: Cross-checks colors, adjusts compliance score

### 8. Format Final Report
- **Type**: `n8n-nodes-base.code` (JavaScript)
- **Purpose**: Ensures all report fields are properly formatted
- **Output**: Complete compliance report JSON

### 9. Save Report to Azure (Optional)
- **Type**: `n8n-nodes-base.microsoftAzure`
- **Purpose**: Archives compliance reports for audit trail
- **Configuration**: `continueOnFail: true` (workflow continues even if save fails)

### 10. Respond to Webhook
- **Type**: `n8n-nodes-base.respondToWebhook`
- **Purpose**: Returns compliance report JSON to the web app
- **Headers**: Includes CORS headers for cross-origin requests

---

## Customization

### Adjust GPT-4o Analysis Prompt

Edit the **"Prepare Analysis Data"** node to modify the prompt:

```javascript
const prompt = `Your custom prompt here...`;
```

### Change Scoring Logic

Edit the **"Automated Validation"** node to adjust how compliance scores are calculated:

```javascript
// Example: Stricter scoring
const reduction = Math.min(violationCount * 15, 60);
```

### Add Additional Validation Rules

Add new code nodes between **"Automated Validation"** and **"Format Final Report"** to implement custom checks (e.g., image dimensions, file size, specific design patterns).

---

## Troubleshooting

### Workflow Returns Empty Response

- **Check**: OpenAI API credentials are valid
- **Check**: SAS URL for Azure Blob Storage is not expired
- **Solution**: Regenerate SAS token with 1-year expiry

### JSON Parsing Error

- **Cause**: GPT-4o returned non-JSON response
- **Solution**: Adjust temperature to `0.2` for more consistent JSON output
- **Workaround**: The workflow includes fallback handling for parse errors

### CORS Errors in Web App

- **Check**: "Respond to Webhook" node has CORS headers configured:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
- **Solution**: Add OPTIONS method handling if needed

### Timeout Errors

- **Cause**: GPT-4o Vision takes >30 seconds to respond
- **Solution**: Increase timeout in web app (`CONFIG.apiTimeout = 90000`)
- **Alternative**: Add a timeout node in n8n workflow

---

## Performance Optimization

1. **Caching Brand Standards**: Store brand standards in workflow static data to avoid repeated Azure fetches
2. **Batch Processing**: Modify workflow to accept multiple images in one request
3. **Async Processing**: Use n8n sub-workflows for long-running analyses
4. **Rate Limiting**: Add rate-limiting logic to prevent API quota exhaustion

---

## Security Best Practices

1. **Never hardcode credentials** - Always use n8n Credentials Manager
2. **Use SAS tokens with minimal permissions** (Read-only for brand-config container)
3. **Set SAS token expiry** to 1 year maximum
4. **Rotate API keys regularly** (OpenAI, Azure)
5. **Enable webhook authentication** for production deployments
6. **Validate input size** to prevent abuse (max 10MB image uploads)

---

## Monitoring & Logging

### Enable Workflow Execution Logging

1. Go to **Settings** → **Log Streaming** in n8n
2. Connect to external logging service (optional)

### View Execution History

1. Click on **Executions** tab in n8n
2. Filter by workflow name: "OAD Brand Design Review Workflow"
3. Review success/failure rates

### Set Up Alerts

1. Use n8n **Error Workflow** feature
2. Configure notifications for failed executions
3. Send alerts to Slack, Email, or Microsoft Teams

---

## Next Steps

1. ✅ Import workflow to n8n
2. ✅ Configure all credentials
3. ✅ Update webhook URL in web app
4. ✅ Test end-to-end with sample design
5. 🔄 Monitor performance and adjust prompt/scoring as needed

---

## Support

For issues with n8n workflow:
- n8n Community: https://community.n8n.io
- n8n Documentation: https://docs.n8n.io
- OpenAI API Status: https://status.openai.com

For project-specific issues:
- GitHub Issues: https://github.com/MichaelScrivana/OAD-DesignReviewer/issues
