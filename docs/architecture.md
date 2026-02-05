# System Architecture

## Overview

The OAD Brand Review Assistant is built on a serverless, event-driven architecture that leverages cloud services and AI APIs to provide scalable, automated brand compliance checking.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Layer                              │
├─────────────────────────────────────────────────────────────┤
│  Web App (HTML/CSS/JS) - Static Hosting                     │
│  • File upload interface                                     │
│  • Results visualization                                     │
│  • Responsive UI (mobile/desktop)                           │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS POST
             │ (Base64 Image + Metadata)
             ↓
┌─────────────────────────────────────────────────────────────┐
│                   Orchestration Layer                        │
├─────────────────────────────────────────────────────────────┤
│  n8n Workflow Engine                                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 1. Webhook Trigger (REST API)                         │ │
│  │ 2. Input Validation (Schema check)                    │ │
│  │ 3. Fetch Brand Standards (Azure Blob GET)            │ │
│  │ 4. Prepare Analysis (Prompt engineering)             │ │
│  │ 5. GPT-4o Vision API Call (Image + Guidelines)       │ │
│  │ 6. Parse AI Response (JSON extraction)                │ │
│  │ 7. Automated Validation (Color palette check)        │ │
│  │ 8. Format Report (Final JSON structure)              │ │
│  │ 9. Save to Azure (Audit trail - optional)            │ │
│  │ 10. Respond to Webhook (Return compliance report)    │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────┬──────────────────────┬────────────────────────┘
             │                      │
             │                      │
   ┌─────────▼──────────┐  ┌────────▼────────┐
   │  OpenAI API        │  │  Azure Blob     │
   │  (GPT-4o Vision)   │  │  Storage        │
   │  • Image analysis  │  │  • Brand config │
   │  • Compliance      │  │  • Audit logs   │
   │    report          │  │  • Asset repo   │
   └────────────────────┘  └─────────────────┘
```

---

## Component Deep Dive

### 1. Web Application (Frontend)

**Technology**: Vanilla JavaScript (ES6+), HTML5, CSS3  
**Hosting**: Azure Static Web Apps / GitHub Pages  
**State Management**: Client-side only (no persistent state)

**Key Files**:
- `index.html` - DOM structure, form, results UI
- `styles.css` - Responsive design with CSS Grid/Flexbox
- `app.js` - API client, file handling, UI updates

**Responsibilities**:
- Image upload and preview
- Form validation (file size, type)
- API communication (POST to n8n webhook)
- Results rendering (tabs, accordions, charts)
- Export functionality (Markdown download)

**Security**:
- Client-side file size validation (10MB max)
- No sensitive data storage (sessionStorage/localStorage)
- HTTPS-only communication
- Content Security Policy headers

---

### 2. Orchestration Layer (n8n Workflow)

**Technology**: n8n (Low-code workflow automation)  
**Deployment**: n8n Cloud or self-hosted (Docker/Kubernetes)  
**State**: Stateless execution (each request independent)

#### Workflow Nodes

| Node | Type | Purpose | Error Handling |
|------|------|---------|----------------|
| **Webhook Trigger** | `n8n-nodes-base.webhook` | Receives POST requests | 400 for invalid JSON |
| **Validate Input** | `n8n-nodes-base.if` | Schema validation | Stops execution on fail |
| **Fetch Brand Standards** | `n8n-nodes-base.httpRequest` | Azure Blob GET | Retry 3x with exponential backoff |
| **Prepare Analysis** | `n8n-nodes-base.code` | Prompt construction | Fallback to default prompt |
| **GPT-4o Vision** | `n8n-nodes-base.openAi` | AI image analysis | Timeout 60s, retry 2x |
| **Parse AI Response** | `n8n-nodes-base.code` | JSON extraction | Fallback report if parse fails |
| **Automated Validation** | `n8n-nodes-base.code` | Color palette check | Skip if brand data missing |
| **Format Report** | `n8n-nodes-base.code` | Response formatting | Ensure required fields |
| **Save to Azure** | `n8n-nodes-base.microsoftAzure` | Audit logging | `continueOnFail: true` |
| **Respond to Webhook** | `n8n-nodes-base.respondToWebhook` | Return JSON | Include CORS headers |

#### Data Flow

1. **Input** (from web app):
```json
{
  "brandId": "OAD",
  "designType": "social-media",
  "submittedBy": "designer@bayer.com",
  "notes": "Campaign banner v2",
  "imageFile": "BASE64_ENCODED_IMAGE_DATA",
  "imageMimeType": "image/png",
  "imageName": "oad-campaign-banner.png"
}
```

2. **Brand Standards** (from Azure):
```json
{
  "colorPalettes": { "primary": ["#FF6600"], ... },
  "typography": { "headings": { "fontFamily": "Helvetica Neue", ... } },
  "logoUsage": { "minWidth": "120px", ... },
  "accessibility": { "minContrastRatio": "4.5:1", ... }
}
```

3. **GPT-4o Prompt**:
```
You are a brand compliance expert analyzing a design...
[Brand Guidelines]
[Task Instructions]
[Required JSON Format]
```

4. **Output** (to web app):
```json
{
  "overallCompliance": "fail",
  "complianceScore": 72,
  "findings": { ... },
  "criticalViolations": [ ... ],
  "warnings": [ ... ],
  "recommendations": [ ... ],
  "summary": "...",
  "metadata": { "reviewDate": "2026-02-04T10:30:00Z", ... }
}
```

---

### 3. AI Analysis Layer (GPT-4o Vision)

**Model**: `gpt-4o` (Multimodal - Text + Vision)  
**API**: OpenAI REST API  
**Rate Limits**: 10,000 requests/minute (Enterprise tier)

**Configuration**:
```javascript
{
  "model": "gpt-4o",
  "temperature": 0.3,  // Lower = more consistent/deterministic
  "max_tokens": 2000,  // Sufficient for detailed report
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "[Prompt]" },
        { "type": "image", "imageData": "[Base64]", "mimeType": "image/png" }
      ]
    }
  ]
}
```

**Analysis Capabilities**:
- Logo detection and size measurement
- Color extraction (hex codes)
- Font identification (with limitations)
- Layout analysis
- Text readability assessment
- Accessibility checks (contrast ratios)

**Limitations**:
- Cannot measure exact pixel dimensions (estimates)
- Font detection not 100% accurate (requires visual similarity matching)
- No access to vector data (SVG rendered as raster)
- Context window: ~128K tokens (sufficient for most designs)

---

### 4. Storage Layer (Azure Blob Storage)

**Service**: Azure Blob Storage (Hot Tier)  
**Redundancy**: LRS (Locally Redundant Storage)  
**Access**: Private containers with SAS tokens

#### Container Structure

```
oadbrandstorage.blob.core.windows.net/
├── brand-config/              # Brand guidelines (JSON)
│   ├── oad-design-standards.json
│   ├── claritin-design-standards.json
│   └── ...
├── design-uploads/            # Submitted images (optional archival)
│   ├── 2026/02/04/
│   │   ├── review-1738673400000.png
│   │   └── review-1738673401000.jpg
│   └── ...
└── design-reviews/            # Compliance reports (audit trail)
    ├── 2026/02/04/
    │   ├── review-1738673400000.json
    │   └── review-1738673401000.json
    └── ...
```

**Security**:
- **SAS Tokens**: Time-limited, permission-scoped URLs
- **Private Access**: No anonymous blob access
- **HTTPS Only**: TLS 1.2+ enforced
- **Firewall**: Optional IP restrictions

**Performance**:
- **CDN**: Azure CDN for brand-config (low latency)
- **Caching**: n8n can cache brand standards for 1 hour
- **Lifecycle Management**: Auto-delete old design-uploads after 30 days

---

## Security Architecture

### Authentication & Authorization

| Component | Auth Method | Credentials |
|-----------|-------------|-------------|
| **Web App → n8n** | None (public webhook) | - |
| **n8n → OpenAI** | API Key (Bearer token) | Stored in n8n Credentials |
| **n8n → Azure Blob** | SAS Token (URL param) | Time-limited, read-only |
| **Web App Users** | (Future) Azure AD SSO | OAuth 2.0 / OIDC |

### Data Protection

**In Transit**:
- TLS 1.2+ for all HTTP communication
- Certificate pinning (optional, for mobile apps)

**At Rest**:
- Azure Storage Service Encryption (SSE) - AES-256
- Customer-managed keys (optional, via Azure Key Vault)

**Data Retention**:
- **Images**: Not stored (unless audit required) - deleted after analysis
- **Reports**: Retained for 1 year (compliance/legal)
- **Brand Standards**: Versioned, retained indefinitely

### Threat Mitigation

| Threat | Mitigation |
|--------|------------|
| **DDoS** | Azure DDoS Protection, rate limiting in n8n |
| **Injection Attacks** | Input validation, parameterized queries |
| **XSS** | Content Security Policy, output escaping |
| **CSRF** | SameSite cookies, CORS headers |
| **API Key Leakage** | Secrets in n8n vault, never in code |
| **Unauthorized Access** | SAS token expiry, IP whitelisting |

---

## Scalability & Performance

### Current Capacity

- **Web App**: Serverless, auto-scales with CDN
- **n8n**: 5 concurrent executions (Cloud Plan) → 100+ (Enterprise)
- **OpenAI API**: 10,000 requests/minute
- **Azure Blob**: 20,000 requests/second per storage account

### Bottlenecks

1. **OpenAI API**: Slowest component (~5-15 seconds per analysis)
2. **n8n Execution Queue**: Limited by plan tier
3. **Azure Blob Storage**: Not a bottleneck for this workload

### Optimization Strategies

**Caching**:
- Cache brand standards in n8n workflow static data (1 hour TTL)
- CDN for static web assets (HTML/CSS/JS)

**Async Processing**:
- Return `202 Accepted` immediately, send results via webhook/email
- Queue multiple reviews for batch processing

**Horizontal Scaling**:
- Deploy n8n on Kubernetes (auto-scale worker pods)
- Use multiple OpenAI API keys (round-robin)

**Cost Optimization**:
- Azure Storage lifecycle policies (archive old reports)
- OpenAI API batching (if available)

---

## Monitoring & Observability

### Logging

**n8n Workflow Logs**:
- Execution history (success/failure/duration)
- Error messages and stack traces
- Input/output data for each node

**Azure Blob Storage Logs**:
- Access logs (who, what, when)
- Failed authentication attempts
- Data transfer metrics

**OpenAI API Logs**:
- Request/response latency
- Token usage (input/output)
- Error rates

### Metrics

| Metric | Source | Threshold |
|--------|--------|-----------|
| **Response Time** | n8n | < 30 seconds (p95) |
| **Success Rate** | n8n | > 95% |
| **API Errors** | OpenAI | < 5% |
| **Storage Capacity** | Azure | < 80% of quota |
| **Cost per Review** | Azure + OpenAI | < $0.50 |

### Alerting

**Critical Alerts** (PagerDuty/Teams):
- n8n workflow failure rate > 10%
- OpenAI API down (3+ consecutive failures)
- Azure Blob Storage unavailable

**Warning Alerts** (Email):
- Response time > 45 seconds
- Cost per review > $0.75
- SAS token expires in < 30 days

---

## Disaster Recovery

### Backup Strategy

**Brand Standards**:
- **Primary**: Azure Blob Storage (LRS)
- **Backup**: Git repository (version-controlled JSON)
- **Recovery**: Restore from Git within 5 minutes

**Workflow Configuration**:
- **Primary**: n8n Cloud (managed backups)
- **Backup**: Exported JSON in Git
- **Recovery**: Re-import workflow within 10 minutes

**Compliance Reports**:
- **Primary**: Azure Blob Storage
- **Backup**: Azure Geo-Redundant Storage (GRS) - optional
- **Recovery**: Automated failover to secondary region

### RTO/RPO

- **RTO** (Recovery Time Objective): < 1 hour
- **RPO** (Recovery Point Objective): < 5 minutes (for brand standards)

---

## Future Enhancements

### Phase 2: Vector Database (RAG)

```
┌───────────────┐
│  Brand PDF    │
│  Guidelines   │
└───────┬───────┘
        │
        ↓ Parse & Chunk
┌───────────────┐
│  Pinecone     │  ← Vector embeddings
│  Index        │
└───────┬───────┘
        │
        ↓ Semantic Search
┌───────────────┐
│  GPT-4o       │  ← Context-aware Q&A
│  (RAG)        │
└───────────────┘
```

**Benefits**:
- Natural language queries: "What are logo size requirements for Instagram?"
- Context-aware recommendations
- Reference specific guideline pages in reports

### Phase 3: Microservices Architecture

```
┌─────────────┐   ┌──────────────┐   ┌─────────────┐
│ Design API  │   │ Guidelines   │   │ Reporting   │
│ (FastAPI)   │   │ API (Flask)  │   │ API (Node)  │
└──────┬──────┘   └──────┬───────┘   └──────┬──────┘
       │                 │                   │
       └─────────────────┴───────────────────┘
                         │
                ┌────────▼────────┐
                │  Kubernetes     │
                │  (AKS)          │
                └─────────────────┘
```

**Benefits**:
- Independent scaling per service
- Polyglot architecture (best tool for each job)
- Fault isolation

---

## Appendix

### Technology Choices

**Why n8n?**
- Low-code (accessible to non-developers)
- Rich integration library (OpenAI, Azure, HTTP)
- Visual workflow designer
- Self-hostable (data sovereignty)

**Why GPT-4o Vision?**
- State-of-the-art multimodal AI
- High accuracy for design analysis
- Structured output (JSON mode)
- Reasonable cost (~$0.01 per image)

**Why Azure Blob Storage?**
- Enterprise-grade reliability (99.9% SLA)
- Global presence (low latency)
- Integration with Microsoft ecosystem
- Cost-effective ($0.018/GB/month)

### API Endpoints

**n8n Webhook** (POST):
```
https://your-n8n.com/webhook/design-review
```

**Azure Blob Storage** (GET - with SAS token):
```
https://oadbrandstorage.blob.core.windows.net/brand-config/oad-design-standards.json?sp=r&...
```

---

**Last Updated**: 2026-02-04  
**Version**: 1.0.0  
**Author**: Michael Scrivana (Bayer DSO)
