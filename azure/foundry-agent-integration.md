# Calling Azure AI Foundry Agents

## Overview
Azure AI Foundry (formerly Azure Machine Learning Studio) allows you to create and deploy AI agents that can be called programmatically. Your OAD Design Reviewer could potentially integrate with or be enhanced by Foundry agents.

## Available Foundry Agent Operations

### 1. List Available Agents
```bash
mcp_azure_mcp_foundry foundry_agents_list \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project"
```

### 2. Call/Query a Foundry Agent
```bash
mcp_azure_mcp_foundry foundry_agents_connect \
  --agent-id "your-agent-id" \
  --query "Analyze this design for brand compliance" \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project"
```

### 3. Query and Evaluate Agent Response
```bash
mcp_azure_mcp_foundry foundry_agents_query-and-evaluate \
  --agent-id "your-agent-id" \
  --query "Check OAD brand guidelines compliance" \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project" \
  --azure-openai-endpoint "https://your-openai.openai.azure.com" \
  --azure-openai-deployment "gpt-4o"
```

## Integration with Your OAD Agent

### Option A: Replace OpenAI with Foundry Agent
Instead of calling OpenAI GPT-4o directly in your n8n workflow, you could:

1. **Create a Foundry Agent** for brand compliance analysis
2. **Update n8n workflow** to call the Foundry agent instead of OpenAI
3. **Use Foundry's evaluation tools** for automated quality assessment

### Option B: Hybrid Approach
Keep your current OpenAI setup but add Foundry agent calls for:
- **Advanced evaluation** of compliance results
- **Multi-agent collaboration** (one agent for logo analysis, another for colors)
- **Knowledge retrieval** from brand document indexes

### Option C: Full Foundry Migration
Move your entire agent to Azure AI Foundry:
- **Create agent** with GPT-4o model deployment
- **Add knowledge indexes** for brand guidelines
- **Use Foundry evaluation tools** for automated testing
- **Deploy as web service** callable from your frontend

## Foundry Agent Capabilities

### Model Deployments
```bash
# List available models
mcp_azure_mcp_foundry foundry_models_list

# Deploy a model
mcp_azure_mcp_foundry foundry_models_deploy \
  --resource-group "rg-oad-brand-reviewer" \
  --deployment "oad-gpt4o-deployment" \
  --model-name "gpt-4o" \
  --model-format "OpenAI" \
  --azure-ai-services "your-ai-service"
```

### Knowledge Management
```bash
# List knowledge indexes
mcp_azure_mcp_foundry foundry_knowledge_index_list \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project"

# Get index schema
mcp_azure_mcp_foundry foundry_knowledge_index_schema \
  --endpoint "https://your-resource.services.ai.azure.com/api/projects/your-project" \
  --index "brand-guidelines-index"
```

### Direct AI Operations
```bash
# Chat completions
mcp_azure_mcp_foundry foundry_openai_chat-completions-create \
  --resource-group "rg-oad-brand-reviewer" \
  --resource-name "your-openai-resource" \
  --deployment "gpt-4o" \
  --message-array '[{"role":"user","content":"Analyze this design"}]'

# Create embeddings
mcp_azure_mcp_foundry foundry_openai_embeddings-create \
  --resource-group "rg-oad-brand-reviewer" \
  --resource-name "your-openai-resource" \
  --deployment "text-embedding-ada-002" \
  --input-text "brand compliance analysis"
```

## Benefits of Foundry Agents

### 1. **Unified Platform**
- Single place to manage models, agents, and evaluations
- Built-in monitoring and logging
- Enterprise-grade security and compliance

### 2. **Advanced Evaluation**
- Automated evaluation of agent responses
- Built-in evaluators for accuracy, relevance, safety
- Performance metrics and benchmarking

### 3. **Knowledge Integration**
- RAG (Retrieval-Augmented Generation) capabilities
- Vector search over brand documents
- Dynamic knowledge updates

### 4. **Scalability**
- Auto-scaling based on demand
- Global distribution options
- High availability configurations

## Migration Path

### Phase 1: Exploration
1. Create Azure AI Foundry resource
2. Deploy GPT-4o model
3. Test basic agent calls
4. Compare with current OpenAI setup

### Phase 2: Knowledge Base
1. Upload brand guidelines to knowledge indexes
2. Create vector embeddings for brand standards
3. Test RAG-enhanced responses

### Phase 3: Agent Development
1. Build specialized agents for different compliance checks
2. Implement evaluation workflows
3. Test multi-agent collaboration

### Phase 4: Production Migration
1. Update n8n workflows to use Foundry agents
2. Implement monitoring and alerting
3. Gradual rollout with A/B testing

## Prerequisites

### Required Azure Resources
- **Azure AI Foundry Resource** (Cognitive Services)
- **Azure OpenAI Resource** (for model deployments)
- **Storage Account** (for knowledge indexes)
- **Azure AI Search** (for vector search)

### Authentication
- Azure AD authentication (already configured)
- Managed identity for secure service-to-service calls
- API keys for development/testing

## Cost Comparison

| Service | Current Setup | Foundry Agent |
|---------|---------------|---------------|
| AI Model | OpenAI GPT-4o (~$5/month) | Azure OpenAI (~$3/month) |
| Orchestration | n8n Cloud ($20/month) | Built-in (included) |
| Storage | Azure Blob ($0.20/month) | Azure AI Search (~$2/month) |
| **Total** | **~$25.20/month** | **~$5.20/month** |

## Next Steps

1. **Create Azure AI Foundry Resource**:
   ```bash
   az cognitiveservices account create \
     --name "oad-ai-foundry" \
     --resource-group "rg-oad-brand-reviewer" \
     --kind "AIServices" \
     --sku "S0" \
     --location "eastus"
   ```

2. **Deploy GPT-4o Model** in Foundry Studio

3. **Create Your First Agent** with brand compliance instructions

4. **Test Agent Calls** using the MCP commands above

Would you like me to help you set up a Foundry agent for your OAD Design Reviewer?