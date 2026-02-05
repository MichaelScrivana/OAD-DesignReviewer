# Azure MCP Integration for OAD Design Reviewer

## Overview
Your OAD Design Reviewer agent can be integrated with Azure services using Azure MCP (Model Context Protocol) tools. This allows you to deploy, manage, and monitor your brand compliance system using Azure's native tools.

## Current Authentication Status
✅ **Authenticated**: michael.scrivana@bayer.com (Bayer tenant)
✅ **Subscription**: AZS3248_DesignerAI (95bd45e7-6664-419c-8cf3-c0a9eb48cb8c)

## Available Azure MCP Commands

### 1. Storage Management
```bash
# Check existing storage account
mcp_azure_mcp_storage storage_account_get --account oadbrandstorage

# Create storage account if needed
mcp_azure_mcp_storage storage_account_create \
  --resource-group rg-oad-brand-reviewer \
  --account oadbrandstorage \
  --location eastus \
  --sku Standard_LRS

# Create containers
mcp_azure_mcp_storage storage_blob_container_create \
  --account oadbrandstorage \
  --container brand-config

mcp_azure_mcp_storage storage_blob_container_create \
  --account oadbrandstorage \
  --container design-uploads

mcp_azure_mcp_storage storage_blob_container_create \
  --account oadbrandstorage \
  --container design-reviews

# Upload brand standards
mcp_azure_mcp_storage storage_blob_upload \
  --account oadbrandstorage \
  --container brand-config \
  --blob oad-design-standards.json \
  --local-file-path ./azure/oad-design-standards.json
```

### 2. Function App Deployment
```bash
# Get deployment plan
mcp_azure_mcp_deploy deploy_plan_get \
  --workspace-folder /workspaces/OAD-DesignReviewer \
  --project-name OAD-DesignReviewer \
  --target-app-service FunctionApp \
  --provisioning-tool AZD \
  --azd-iac-options bicep

# Get IaC rules for Function Apps
mcp_azure_mcp_deploy iac_rules_get \
  --deployment-tool AZD \
  --iac-type bicep \
  --resource-types function

# Generate architecture diagram
mcp_azure_mcp_deploy deploy_architecture_diagram_generate \
  --workspaceFolder /workspaces/OAD-DesignReviewer \
  --services '[{"name":"oad-design-reviewer","path":"src","language":"javascript","port":"80","azureComputeHost":"function","dependencies":[{"name":"storage","serviceType":"azurestorageaccount","connectionType":"secret","environmentVariables":["AZURE_STORAGE_CONNECTION_STRING"]}],"settings":["OPENAI_API_KEY","N8N_WEBHOOK_URL"]}]'
```

### 3. Application Insights Monitoring
```bash
# Get monitoring best practices
mcp_azure_mcp_get_bestpractices get_bestpractices_get \
  --resource azurefunctions \
  --action deployment
```

### 4. Static Web App Management
```bash
# Get SWA best practices
mcp_azure_mcp_get_bestpractices get_bestpractices_get \
  --resource static-web-app \
  --action all
```

## Deployment Workflow

### Option A: Azure Functions (Recommended for AI workloads)
1. **Create Function App**:
   ```bash
   mcp_azure_mcp_functionapp functionapp_create \
     --resource-group rg-oad-brand-reviewer \
     --name oad-design-reviewer-func \
     --storage-account oadbrandstorage \
     --consumption-plan-location eastus \
     --runtime node \
     --runtime-version 18 \
     --functions-version 4
   ```

2. **Deploy your n8n workflow** as a Function App
3. **Update web app** to call the Function endpoint instead of n8n

### Option B: Azure Static Web Apps (Current setup)
1. **Deploy using SWA CLI**:
   ```bash
   npm install -g @azure/static-web-apps-cli
   swa init --yes
   swa build
   swa deploy --env production
   ```

### Option C: Azure Container Apps
1. **Create Container App**:
   ```bash
   mcp_azure_mcp_appservice containerapp_create \
     --resource-group rg-oad-brand-reviewer \
     --name oad-design-reviewer-ca \
     --environment oad-env \
     --image mcr.microsoft.com/k8se/quickstart:latest \
     --target-port 80 \
     --ingress external
   ```

## Monitoring & Management

### Application Insights
```bash
# Enable monitoring
mcp_azure_mcp_applicationinsights applicationinsights_create \
  --resource-group rg-oad-brand-reviewer \
  --name oad-design-reviewer-ai \
  --location eastus \
  --kind web \
  --application-type web
```

### Log Analytics
```bash
# View application logs
mcp_azure_mcp_deploy deploy_app_logs_get \
  --workspace-folder /workspaces/OAD-DesignReviewer \
  --azd-env-name production \
  --limit 50
```

## Best Practices Applied

- ✅ **Flex Consumption Plan** for Functions (cost-effective scaling)
- ✅ **Application Insights** for monitoring
- ✅ **SAS Tokens** for secure storage access
- ✅ **Private networking** options available
- ✅ **Linux runtime** for Node.js Functions

## Cost Estimation
- **Azure Functions**: ~$0.20/month (consumption-based)
- **Storage**: ~$0.20/month (LRS, minimal usage)
- **Application Insights**: ~$5/month (basic monitoring)
- **Total**: ~$5.40/month

## Next Steps

1. **Fix Authentication**: The MCP tools need proper Azure CLI authentication
2. **Create Resources**: Use the commands above to provision Azure infrastructure
3. **Deploy Agent**: Choose your preferred deployment option
4. **Configure Monitoring**: Set up Application Insights for observability

Would you like me to help you with any specific Azure MCP command or deployment option?