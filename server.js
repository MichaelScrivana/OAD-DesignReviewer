const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

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

    return `You are the ${brandRules.brandName} (${brandRules.brandId}) Brand Compliance Review Agent.
Your job is to analyze design images and evaluate them against brand guidelines.

## BRAND IDENTITY
- Brand: ${brandRules.brandName}
- Brand ID: ${brandRules.brandId}
- Guidelines Version: ${brandRules.version}
- Tagline: ${brandRules.brandEssence?.tagline || 'N/A'}

## COLOR PALETTE
Primary Colors: ${primaryColors}
Secondary Colors: ${secondaryColors}
Accent Colors: ${accentColors}

Prohibited Colors:
${prohibitedColors}

## LOGO RULES
${logoRules}

Logo Prohibitions:
${logoProhibitions}

## TYPOGRAPHY
Primary Font: ${fontFamily}
Fallbacks: ${fontFallbacks}
Minimum body text size: ${minBodySize}px

## ACCESSIBILITY (${a11yStandard})
${a11yRules}

## SCORING SYSTEM
Total Points: ${scoringRubric?.gradingScale?.maxScore || 100}
Pass Threshold: ${scoringRubric?.gradingScale?.passThreshold || 70}

Category Weights:
${categoryWeights}

## GRADING SCALE
${scoringRubric?.gradingScale?.grades?.map(g => `- ${g.grade}: ${g.minScore}-${g.maxScore} (${g.label})`).join('\n') || 'A-F scale'}

## FAILURE RULES
- Critical Failure: ${scoringRubric?.failureRules?.criticalFailure?.description || 'Results in automatic failure'}
- Major Failures (${scoringRubric?.failureRules?.majorFailures?.threshold || 3}+): ${scoringRubric?.failureRules?.majorFailures?.description || 'Caps grade at C'}
- Minor Failures (${scoringRubric?.failureRules?.minorFailures?.threshold || 5}+): ${scoringRubric?.failureRules?.minorFailures?.description || 'Caps grade at B'}

## OUTPUT FORMAT
You MUST return your analysis as valid JSON with this structure:
{
  "score": <number 0-100>,
  "grade": "<A+ to F>",
  "status": "<APPROVED|APPROVED_WITH_NOTES|NEEDS_REVISION|REJECTED>",
  "passOrFail": "<PASS|FAIL>",
  "categoryScores": {
    "logo": {"score": <number>, "maxScore": 25, "percentage": <number>},
    "colors": {"score": <number>, "maxScore": 25, "percentage": <number>},
    "typography": {"score": <number>, "maxScore": 20, "percentage": <number>},
    "accessibility": {"score": <number>, "maxScore": 20, "percentage": <number>},
    "layout": {"score": <number>, "maxScore": 10, "percentage": <number>}
  },
  "violations": [
    {"ruleId": "<rule ID>", "category": "<category>", "severity": "<critical|major|minor>", "description": "<what's wrong>", "recommendation": "<how to fix>"}
  ],
  "warnings": [
    {"description": "<potential issue>", "severity": "minor"}
  ],
  "recommendations": ["<actionable improvement 1>", "<actionable improvement 2>"],
  "summary": "<2-3 sentence summary of the review>"
}

## IMPORTANT RULES
1. Be precise - cite exact measurements and values when possible
2. Be fair - don't fail designs for minor issues
3. Be helpful - always provide actionable recommendations
4. Reference specific rule IDs when citing violations
5. When uncertain, note it as "Cannot Determine" rather than guessing
6. ALWAYS return valid JSON - no markdown, no extra text`;
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
            // Text-only query
            console.log('No image detected, using text-only format');
            messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ];
        }

        const response = await axios.post(apiUrl, {
            messages: messages,
            max_tokens: 2000,
            temperature: 0.3
        }, {
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            timeout: 120000 // 2 minute timeout for image analysis
        });

        console.log('Azure OpenAI response received');

        // Extract the response content
        const content = response.data.choices[0]?.message?.content;
        
        if (!content) {
            throw new Error('No response content from Azure OpenAI');
        }

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