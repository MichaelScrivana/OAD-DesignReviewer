const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { simpleParser } = require('mailparser');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for emails
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large images

// Serve static files from src directory
app.use(express.static(path.join(__dirname, 'src')));

// Load brand data
function loadBrandData(brandId = 'OAD') {
    try {
        const brandRulesPath = path.join(__dirname, 'brand-data', 'brands', brandId, 'brand-rules.json');
        const scoringRubricPath = path.join(__dirname, 'brand-data', 'brands', brandId, 'scoring-rubric.json');
        const gradingScalePath = path.join(__dirname, 'brand-data', 'shared', 'grading-scale.json');

        const brandRules = JSON.parse(fs.readFileSync(brandRulesPath, 'utf8'));
        const scoringRubric = JSON.parse(fs.readFileSync(scoringRubricPath, 'utf8'));
        const gradingScale = JSON.parse(fs.readFileSync(gradingScalePath, 'utf8'));

        return { brandRules, scoringRubric, gradingScale };
    } catch (error) {
        console.error('Error loading brand data:', error.message);
        return null;
    }
}

// Generate system prompt from brand data
function generateSystemPrompt(brandData) {
    if (!brandData) {
        // Fallback to basic prompt
        return `You are an expert brand compliance analyst. Analyze designs for brand guideline compliance.`;
    }

    const { brandRules, scoringRubric, gradingScale } = brandData;
    
    // Safely extract color palette
    const colors = brandRules.colors?.palette || {};
    const primaryColors = Array.isArray(colors.primary) 
        ? colors.primary.map(c => `${c.name}: ${c.hex}`).join(', ')
        : 'Not specified';
    const secondaryColors = Array.isArray(colors.secondary) 
        ? colors.secondary.map(c => `${c.name}: ${c.hex}`).join(', ')
        : 'Not specified';
    const accentColors = Array.isArray(colors.accent) 
        ? colors.accent.map(c => `${c.name}: ${c.hex}`).join(', ')
        : 'Not specified';
    
    // Extract logo rules
    const logoRules = brandRules.logo?.rules?.map(r => `- ${r.name}: ${r.requirement}`).join('\n') || '';
    const logoProhibitions = brandRules.logo?.prohibitions?.map(p => `- ${p}`).join('\n') || '';
    
    // Extract typography - handle new structure
    const typography = brandRules.typography || {};
    const fontFamily = typography.fonts?.primary?.family || 'Not specified';
    const fontFallbacks = typography.fonts?.primary?.fallbacks?.join(', ') || 'Arial, sans-serif';
    const minBodySize = typography.scale?.body?.size || typography.rules?.find(r => r.ruleId === 'TYPE-003')?.minValue || 16;
    
    // Extract accessibility rules
    const a11yRules = brandRules.accessibility?.rules?.map(r => `- ${r.name}: ${r.requirement}`).join('\n') || '';
    const a11yStandard = brandRules.accessibility?.standard || 'WCAG 2.1 AA';
    
    // Build scoring info
    const categoryWeights = scoringRubric?.categories 
        ? Object.entries(scoringRubric.categories)
            .map(([cat, data]) => `- ${cat}: ${data.weight} points (${data.description})`)
            .join('\n')
        : '';
    
    // Prohibited colors
    const prohibitedColors = brandRules.colors?.prohibitedColors?.map(c => `- ${c.hex}: ${c.reason}`).join('\n') || '';

    return `You are a brand compliance reviewer. Return ONLY raw JSON, no other text.

Brand: ${brandRules.brandName} (${brandRules.brandId})
Colors — Primary: ${primaryColors} | Secondary: ${secondaryColors} | Accent: ${accentColors}
Font: ${fontFamily}, min ${minBodySize}px | ${a11yStandard}
Scoring: logo/25, colors/25, typography/20, accessibility/20, layout/10. Pass≥${scoringRubric?.gradingScale?.passThreshold || 70}.

Return this exact JSON schema:
{"complianceScore":0,"grade":"","status":"APPROVED|APPROVED_WITH_NOTES|NEEDS_REVISION|REJECTED","passOrFail":"PASS|FAIL","categoryScores":{"logo":{"score":0,"maxScore":25},"colors":{"score":0,"maxScore":25},"typography":{"score":0,"maxScore":20},"accessibility":{"score":0,"maxScore":20},"layout":{"score":0,"maxScore":10}},"violations":[{"ruleId":"","severity":"critical|major|minor","description":""}],"warnings":[{"description":""}],"recommendations":[""],"summary":""}

Rules: Max 5 violations, max 3 warnings, max 3 recommendations. Each 1 short sentence. Summary: 1 sentence.`;
}

// Foundry Agent Configuration
const FOUNDRY_CONFIG = {
    endpoint: process.env.FOUNDRY_ENDPOINT,
    agentId: process.env.FOUNDRY_AGENT_ID,
    azureOpenaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
    azureOpenaiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiKey: process.env.AZURE_OPENAI_API_KEY
};

// Validate configuration
function validateConfig() {
    const required = ['endpoint', 'agentId', 'azureOpenaiEndpoint', 'azureOpenaiDeployment', 'apiKey'];
    const missing = required.filter(key => !FOUNDRY_CONFIG[key]);

    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing);
        console.error('Please set these environment variables:');
        missing.forEach(key => {
            console.error(`  ${key.toUpperCase()}=your_value_here`);
        });
        process.exit(1);
    }
}

// Foundry Agent API Endpoint
app.post('/api/foundry-agent', async (req, res) => {
    try {
        const { agentId, query, endpoint } = req.body;

        console.log('Received request for agent:', agentId);
        console.log('Query length:', query.length);

        // Call Foundry agent
        const foundryResponse = await callFoundryAgent(agentId, query, endpoint);

        res.json({
            response: foundryResponse,
            timestamp: new Date().toISOString(),
            agentId: agentId
        });

    } catch (error) {
        console.error('Foundry agent error:', error);
        res.status(500).json({
            error: 'Failed to call Foundry agent',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Function to call Azure OpenAI for brand compliance analysis
async function callFoundryAgent(agentId, query, endpoint) {
    try {
        const azureEndpoint = FOUNDRY_CONFIG.azureOpenaiEndpoint;
        const deployment = FOUNDRY_CONFIG.azureOpenaiDeployment;
        const apiKey = FOUNDRY_CONFIG.apiKey;

        // Azure OpenAI Chat Completions API URL
        const apiUrl = `${azureEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

        console.log('Calling Azure OpenAI API...');
        console.log('Endpoint:', azureEndpoint);
        console.log('Deployment:', deployment);

        // Load brand data and generate system prompt
        const brandData = loadBrandData('OAD');
        const systemPrompt = generateSystemPrompt(brandData);
        
        console.log('Brand data loaded:', brandData ? 'Yes' : 'No (using fallback)');

        // Check if query contains an embedded base64 image
        const imageMatch = query.match(/data:(image\/[^;]+);base64,([A-Za-z0-9+/=]+)/);
        
        let messages;
        let textQuery = query;
        let isChat = false;
        
        if (imageMatch) {
            // Extract image and text separately for vision API
            const mimeType = imageMatch[1];
            const base64Data = imageMatch[2];
            textQuery = query.replace(imageMatch[0], '[Image attached for analysis]');
            
            console.log('Image detected, using Vision API format');
            console.log('Image MIME type:', mimeType);
            console.log('Image size (base64):', Math.round(base64Data.length / 1024), 'KB');
            
            // Use proper vision message format
            messages = [
                { role: 'system', content: systemPrompt },
                { 
                    role: 'user', 
                    content: [
                        { type: 'text', text: textQuery },
                        { 
                            type: 'image_url', 
                            image_url: { 
                                url: `data:${mimeType};base64,${base64Data}`,
                                detail: 'high'  // Use 'low' for faster/cheaper, 'high' for detailed analysis
                            }
                        }
                    ]
                }
            ];
        } else {
            // Text-only query (chat) — no brand system prompt needed, the query carries its own instructions
            console.log('No image detected, using text-only format');
            isChat = true;
            messages = [
                { role: 'system', content: 'You are a concise brand compliance assistant. Keep replies focused and actionable. Use short bullet points when listing multiple items. Avoid long introductions or repetition.' },
                { role: 'user', content: query }
            ];
        }

        const response = await axios.post(apiUrl, {
            messages: messages,
            max_tokens: isChat ? 500 : 800,
            temperature: isChat ? 0.3 : 0.15
        }, {
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            timeout: 120000 // 2 minute timeout for image analysis
        });

        // Extract the response content
        const content = response.data.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No response content from Azure OpenAI');
        }

        console.log('Azure OpenAI response received, length:', content.length, 'chars');

        return content;

    } catch (error) {
        console.error('Error calling Azure OpenAI:', error.response?.data || error.message);
        
        // Provide more specific error messages
        if (error.response?.status === 401) {
            throw new Error('Invalid API key. Please check your AZURE_OPENAI_API_KEY.');
        } else if (error.response?.status === 404) {
            throw new Error('Deployment not found. Please check your AZURE_OPENAI_DEPLOYMENT.');
        } else if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout. The analysis is taking too long.');
        }
        
        throw new Error(`Azure OpenAI call failed: ${error.response?.data?.error?.message || error.message}`);
    }
}

// Legacy mock response generator - kept for testing/fallback purposes
// To use mock mode, set environment variable USE_MOCK_API=true
function generateMockFoundryResponse(query) {
    // Extract design type and brand from query
    const isOadBrand = query.includes('One A Day') || query.includes('OAD');
    const hasImage = query.includes('data:image');

    let score = 85;
    let violations = [];
    let warnings = [];
    let recommendations = [];

    // Simulate analysis based on query content
    if (!isOadBrand) {
        violations.push('Incorrect brand identity - should be One A Day (OAD)');
        score -= 20;
    }

    if (!hasImage) {
        warnings.push('No image provided for visual analysis');
        score -= 10;
    }

    if (query.includes('logo')) {
        if (query.includes('small') || query.includes('tiny')) {
            violations.push('Logo too small - minimum 120px width required');
            score -= 15;
        } else {
            recommendations.push('Logo placement and size appear appropriate');
        }
    }

    if (query.includes('color') || query.includes('#FF6600')) {
        if (query.includes('wrong') || query.includes('incorrect')) {
            violations.push('Incorrect color usage - must use OAD brand colors (#FF6600, #333333)');
            score -= 10;
        } else {
            recommendations.push('Color palette follows OAD brand guidelines');
        }
    }

    if (query.includes('font') || query.includes('typography')) {
        if (query.includes('wrong') || query.includes('arial') || query.includes('times')) {
            warnings.push('Non-standard font detected - recommend Helvetica Neue');
            score -= 5;
        }
    }

    // Generate detailed response
    let response = `Brand Compliance Analysis Complete

Compliance Score: ${score}/100

Summary: ${score >= 90 ? 'Excellent compliance with OAD brand guidelines' :
           score >= 70 ? 'Good compliance with minor issues to address' :
           'Significant compliance issues requiring attention'}

`;

    if (violations.length > 0) {
        response += '\nCritical Violations:\n';
        violations.forEach(v => response += `- ${v}\n`);
    }

    if (warnings.length > 0) {
        response += '\nWarnings:\n';
        warnings.forEach(w => response += `- ${w}\n`);
    }

    if (recommendations.length > 0) {
        response += '\nRecommendations:\n';
        recommendations.forEach(r => response += `- ${r}\n`);
    }

    response += '\nDetailed Analysis:\n\n';

    response += 'Logo Usage:\n';
    if (query.includes('logo')) {
        response += 'Logo appears to be properly positioned with adequate clearspace.\n';
    } else {
        response += 'No logo detected in the design.\n';
    }

    response += '\nColor Palette:\n';
    response += 'Primary OAD orange (#FF6600) should be the dominant brand color.\n';
    response += 'Secondary dark gray (#333333) provides good contrast.\n';

    response += '\nTypography:\n';
    response += 'Helvetica Neue is the recommended typeface for OAD communications.\n';
    response += 'Font sizes should maintain minimum 14px for accessibility.\n';

    response += '\nAccessibility:\n';
    response += 'Design meets WCAG AA contrast requirements (4.5:1 ratio).\n';
    response += 'All interactive elements are properly sized and spaced.\n';

    return response;
}

// API endpoint to get brand rules (for Guidelines panel)
app.get('/api/brand-rules/:brandId', (req, res) => {
    const brandId = req.params.brandId || 'OAD';
    
    try {
        const brandRulesPath = path.join(__dirname, 'brand-data', 'brands', brandId, 'brand-rules.json');
        
        if (!fs.existsSync(brandRulesPath)) {
            return res.status(404).json({ error: 'Brand rules not found' });
        }
        
        const brandRules = JSON.parse(fs.readFileSync(brandRulesPath, 'utf8'));
        res.json(brandRules);
    } catch (error) {
        console.error('Error loading brand rules:', error);
        res.status(500).json({ error: 'Failed to load brand rules' });
    }
});

// ============================================
// Email Parsing Endpoint
// ============================================

app.post('/api/parse-email', upload.single('email'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No email file provided' });
        }

        console.log(`📧 Parsing email: ${req.file.originalname}`);

        // Parse the email
        const parsed = await simpleParser(req.file.buffer);
        
        const images = [];
        
        // Extract images from attachments
        if (parsed.attachments && parsed.attachments.length > 0) {
            for (const attachment of parsed.attachments) {
                // Check if it's an image
                if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                    images.push({
                        filename: attachment.filename || `attachment_${images.length + 1}`,
                        mimeType: attachment.contentType,
                        base64: attachment.content.toString('base64'),
                        size: attachment.size
                    });
                    console.log(`  📎 Found attachment: ${attachment.filename}`);
                }
            }
        }

        // Extract inline images (CID references in HTML)
        if (parsed.attachments) {
            for (const attachment of parsed.attachments) {
                // CID images are referenced in HTML with cid:
                if (attachment.cid && attachment.contentType && attachment.contentType.startsWith('image/')) {
                    // Check if we already added this (avoid duplicates)
                    const alreadyAdded = images.some(img => 
                        img.filename === attachment.filename && img.size === attachment.size
                    );
                    if (!alreadyAdded) {
                        images.push({
                            filename: attachment.filename || `inline_${images.length + 1}`,
                            mimeType: attachment.contentType,
                            base64: attachment.content.toString('base64'),
                            size: attachment.size,
                            inline: true
                        });
                        console.log(`  🖼️ Found inline image: ${attachment.filename}`);
                    }
                }
            }
        }

        console.log(`✅ Extracted ${images.length} image(s) from email`);

        res.json({
            success: true,
            emailSubject: parsed.subject,
            emailFrom: parsed.from?.text,
            emailDate: parsed.date,
            images: images
        });

    } catch (error) {
        console.error('Email parsing error:', error);
        res.status(500).json({ 
            error: 'Failed to parse email',
            details: error.message 
        });
    }
});

// ============================================
// PDF Parsing Endpoint
// ============================================

app.post('/api/parse-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        console.log(`📄 Processing PDF: ${req.file.originalname}`);
        console.log(`   Size: ${Math.round(req.file.size / 1024)}KB`);

        // GPT-4o Vision can analyze PDFs directly when sent as base64
        // We'll send the PDF as-is and let the AI handle it
        const base64PDF = req.file.buffer.toString('base64');
        
        const images = [{
            filename: req.file.originalname,
            base64: base64PDF,
            mimeType: 'application/pdf',
            pageNumber: 1,
            isFullPDF: true
        }];

        console.log(`✅ PDF ready for AI analysis`);

        res.json({
            success: true,
            message: 'PDF will be analyzed directly by AI',
            images: images
        });

    } catch (error) {
        console.error('PDF processing error:', error);
        res.status(500).json({ 
            error: 'Failed to process PDF',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        config: {
            foundryEndpoint: !!FOUNDRY_CONFIG.endpoint,
            agentId: !!FOUNDRY_CONFIG.agentId,
            azureOpenaiConfigured: !!(FOUNDRY_CONFIG.azureOpenaiEndpoint && FOUNDRY_CONFIG.apiKey)
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Foundry Agent Proxy Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);

    validateConfig();
    console.log('✅ Configuration validated');
    console.log('🎯 Ready to proxy Foundry agent requests');
});

module.exports = app;