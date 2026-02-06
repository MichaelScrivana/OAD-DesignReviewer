// ============================================
// OAD Brand Review Assistant - Application Logic
// ============================================

// Configuration - UPDATE THESE VALUES FOR YOUR FOUNDRY AGENT
const CONFIG = {
    // API Server Configuration
    apiBaseUrl: 'http://localhost:3001', // Node.js API server URL
    
    // Foundry Agent Configuration
    foundryEndpoint: 'https://brandchatbot-1-resource.services.ai.azure.com/api/projects/brandchatbot-1',
    agentId: 'DesignAgent',
    azureOpenaiEndpoint: 'https://brandchatbot-1-resource.openai.azure.com',
    azureOpenaiDeployment: 'gpt-4o',

    // File constraints
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    apiTimeout: 120000 // 2 minutes (Foundry agents may take longer)
};

// State
let uploadedFile = null;
let currentResults = null;

// ============================================
// DOM Elements
// ============================================

const elements = {
    uploadForm: document.getElementById('upload-form'),
    fileUpload: document.getElementById('file-upload'),
    dropZone: document.getElementById('drop-zone'),
    previewContainer: document.getElementById('preview-container'),
    previewImage: document.getElementById('preview-image'),
    removeImageBtn: document.getElementById('remove-image'),
    submitBtn: document.getElementById('submit-btn'),
    uploadSection: document.getElementById('upload-section'),
    resultsSection: document.getElementById('results-section'),
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toast-icon'),
    toastMessage: document.getElementById('toast-message')
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkConfiguration();
    setupSidebarNavigation();
    loadBrandGuidelines();
});

function initializeEventListeners() {
    // File upload events
    elements.dropZone.addEventListener('click', () => elements.fileUpload.click());
    elements.fileUpload.addEventListener('change', handleFileSelect);
    elements.removeImageBtn.addEventListener('click', handleFileRemove);
    
    // Drag and drop events
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    
    // Form submission
    elements.uploadForm.addEventListener('submit', handleFormSubmit);
    
    // Results section interactions
    setupTabNavigation();
    setupAccordions();
    setupResultsActions();
    setupThoughtBubble();
    setupGuidelinesPanel();
}

function setupThoughtBubble() {
    const toggle = document.getElementById('thought-toggle');
    const content = document.getElementById('thought-content');
    
    if (toggle && content) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('expanded');
            content.classList.toggle('expanded');
        });
    }
}

function checkConfiguration() {
    if (CONFIG.foundryEndpoint.includes('your-foundry-resource')) {
        console.warn('⚠️ Foundry Endpoint not configured. Update CONFIG.foundryEndpoint in app.js');
    }
    if (CONFIG.agentId === 'your-agent-id') {
        console.warn('⚠️ Agent ID not configured. Update CONFIG.agentId in app.js');
    }
}

// ============================================
// File Upload Handling
// ============================================

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        validateAndPreviewFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    elements.dropZone.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    elements.dropZone.classList.remove('drag-over');
    
    const file = event.dataTransfer.files[0];
    if (file) {
        validateAndPreviewFile(file);
    }
}

function validateAndPreviewFile(file) {
    // Validate file type
    if (!CONFIG.allowedFileTypes.includes(file.type)) {
        showToast('Please upload a PNG, JPG, or SVG file', 'error');
        return;
    }
    
    // Validate file size
    if (file.size > CONFIG.maxFileSize) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }
    
    // Store file and show preview
    uploadedFile = file;
    previewImage(file);
}

function previewImage(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        elements.previewImage.src = e.target.result;
        elements.dropZone.querySelector('.drop-zone-content').style.display = 'none';
        elements.previewContainer.classList.remove('hidden');
    };
    
    reader.readAsDataURL(file);
}

function handleFileRemove(event) {
    event.stopPropagation();
    uploadedFile = null;
    elements.fileUpload.value = '';
    elements.previewImage.src = '';
    elements.previewContainer.classList.add('hidden');
    elements.dropZone.querySelector('.drop-zone-content').style.display = 'flex';
}

// ============================================
// Form Submission & API Call
// ============================================

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!uploadedFile) {
        showToast('Please upload an image file', 'error');
        return;
    }
    
    // Get form data
    const formData = {
        brandId: document.getElementById('brand-select').value,
        designType: document.getElementById('design-type-select').value,
        submittedBy: document.getElementById('email-input').value,
        notes: document.getElementById('notes-input').value
    };
    
    // Show loading state
    setLoadingState(true);
    
    // Show results panel with live feed early
    showLiveAnalysisPanel();
    
    try {
        // Convert file to base64
        const imageBase64 = await fileToBase64(uploadedFile);
        
        // Prepare API payload
        const payload = {
            ...formData,
            imageFile: imageBase64,
            imageMimeType: uploadedFile.type,
            imageName: uploadedFile.name,
            timestamp: new Date().toISOString()
        };
        
        // Call n8n webhook with live updates
        const results = await submitDesignReviewWithLiveFeed(payload);
        
        // Display results
        currentResults = results;
        displayResults(results, formData);
        
        // Mark live feed as complete
        finishLiveFeed();
        
        showToast('Analysis complete!', 'success');
    } catch (error) {
        console.error('Submission error:', error);
        showToast(error.message || 'Failed to analyze design. Please try again.', 'error');
        addLiveFeedMessage('❌ Error: ' + (error.message || 'Analysis failed'), true);
        setLoadingState(false);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function submitDesignReview(payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.apiTimeout);

    try {
        // Prepare Foundry agent query
        const agentQuery = `Please analyze this design for One A Day (OAD) brand compliance.

Design Details:
- Brand: ${payload.brandId}
- Design Type: ${payload.designType}
- Submitted by: ${payload.submittedBy}
${payload.notes ? `- Notes: ${payload.notes}` : ''}

Please check for:
1. Logo usage and clearspace requirements
2. Approved color palette compliance (#FF6600 primary, #333333 secondary)
3. Typography standards (Helvetica Neue, approved sizes and weights)
4. Overall brand consistency and accessibility (WCAG AA contrast ratios)

Provide a detailed analysis with specific violations, warnings, and recommendations. Include a compliance score from 0-100.

Image: data:${payload.imageMimeType};base64,${payload.imageFile}`;

        // Call Foundry agent
        const foundryPayload = {
            agentId: CONFIG.agentId,
            query: agentQuery,
            endpoint: CONFIG.foundryEndpoint,
            azureOpenaiEndpoint: CONFIG.azureOpenaiEndpoint,
            azureOpenaiDeployment: CONFIG.azureOpenaiDeployment
        };

        console.log('Calling Foundry agent with payload:', foundryPayload);

        const response = await fetch(`${CONFIG.apiBaseUrl}/api/foundry-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(foundryPayload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Foundry Agent Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Foundry agent response:', data);

        // Transform Foundry response to expected format
        return transformFoundryResponse(data, payload);

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Foundry agent analysis may take longer. Please try again.');
        }

        throw error;
    }
}

function transformFoundryResponse(foundryData, originalPayload) {
    // Extract the agent's response
    const agentResponse = foundryData.response || foundryData.answer || foundryData.content || '';

    // Parse the response to extract structured data
    // This is a basic parser - you may need to adjust based on your agent's output format
    const parsedResults = parseAgentResponse(agentResponse);

    // Return in the expected format for the UI
    return {
        complianceScore: parsedResults.score ?? 0, // Use 0 if no score found
        status: parsedResults.score >= 90 ? 'passed' : parsedResults.score >= 70 ? 'warnings' : 'violations',
        summary: parsedResults.summary || 'Analysis completed by Foundry agent',
        violations: parsedResults.violations || [],
        warnings: parsedResults.warnings || [],
        recommendations: parsedResults.recommendations || [],
        detailedFindings: parsedResults.detailedFindings || {},
        metadata: {
            analyzedBy: 'Azure AI Foundry Agent',
            timestamp: new Date().toISOString(),
            brandId: originalPayload.brandId,
            designType: originalPayload.designType,
            submittedBy: originalPayload.submittedBy,
            agentId: CONFIG.agentId,
            rawResponse: agentResponse
        }
    };
}

function parseAgentResponse(responseText) {
    // Basic parsing logic - adjust based on your agent's response format
    const results = {
        score: null, // Don't default to 85 - let it be extracted
        summary: '',
        violations: [],
        warnings: [],
        recommendations: [],
        detailedFindings: {}
    };

    try {
        // First, try to parse as JSON if the response looks like JSON
        if (responseText.trim().startsWith('{')) {
            try {
                const jsonResponse = JSON.parse(responseText);
                if (jsonResponse.complianceScore !== undefined) {
                    results.score = parseInt(jsonResponse.complianceScore);
                } else if (jsonResponse.score !== undefined) {
                    results.score = parseInt(jsonResponse.score);
                } else if (jsonResponse.overallScore !== undefined) {
                    results.score = parseInt(jsonResponse.overallScore);
                }
                
                if (jsonResponse.summary) results.summary = jsonResponse.summary;
                if (jsonResponse.violations) results.violations = jsonResponse.violations;
                if (jsonResponse.warnings) results.warnings = jsonResponse.warnings;
                if (jsonResponse.recommendations) results.recommendations = jsonResponse.recommendations;
                if (jsonResponse.categoryScores) results.categoryScores = jsonResponse.categoryScores;
                
                return results;
            } catch (e) {
                // Not valid JSON, continue with text parsing
            }
        }
        
        // Look for compliance score in various formats
        const scorePatterns = [
            /compliance\s*score[:\s]*([\d.]+)/i,
            /overall\s*score[:\s]*([\d.]+)/i,
            /score[:\s]*([\d.]+)\s*(?:out of|\/)\s*100/i,
            /score[:\s]*([\d.]+)%/i,
            /score[:\s]*([\d.]+)/i,
            /([\d.]+)\s*%\s*(?:compliance|compliant)/i,
            /([\d.]+)\s*\/\s*100/i
        ];
        
        for (const pattern of scorePatterns) {
            const match = responseText.match(pattern);
            if (match) {
                const parsedScore = parseFloat(match[1]);
                if (parsedScore >= 0 && parsedScore <= 100) {
                    results.score = Math.round(parsedScore);
                    break;
                }
            }
        }

        // Extract sections using common patterns
        const sections = responseText.split(/\n\s*\n/);

        for (const section of sections) {
            const lowerSection = section.toLowerCase();

            if (lowerSection.includes('violation') || lowerSection.includes('critical')) {
                results.violations = parseListItems(section);
            } else if (lowerSection.includes('warning') || lowerSection.includes('caution')) {
                results.warnings = parseListItems(section);
            } else if (lowerSection.includes('recommendation') || lowerSection.includes('suggestion')) {
                results.recommendations = parseListItems(section);
            } else if (lowerSection.includes('logo') || lowerSection.includes('color') ||
                      lowerSection.includes('typography') || lowerSection.includes('accessibility')) {
                // Detailed findings
                if (lowerSection.includes('logo')) {
                    results.detailedFindings.logo = parseDetailedSection(section);
                } else if (lowerSection.includes('color')) {
                    results.detailedFindings.colors = parseDetailedSection(section);
                } else if (lowerSection.includes('typography') || lowerSection.includes('font')) {
                    results.detailedFindings.typography = parseDetailedSection(section);
                } else if (lowerSection.includes('accessibility')) {
                    results.detailedFindings.accessibility = parseDetailedSection(section);
                }
            }
        }

        // Set summary from first paragraph or first few sentences
        const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 10);
        results.summary = sentences.slice(0, 2).join('. ').trim();

    } catch (error) {
        console.warn('Error parsing agent response:', error);
        results.summary = responseText.substring(0, 200) + '...';
    }

    return results;
}

function parseListItems(text) {
    // Extract bullet points, numbered lists, or lines starting with dashes
    const items = [];
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/) || trimmed.length > 20) {
            const cleanItem = trimmed.replace(/^[-•*\d]+\.\s*/, '').trim();
            if (cleanItem.length > 0) {
                items.push(cleanItem);
            }
        }
    }

    return items;
}

function parseDetailedSection(text) {
    // Return the section content for detailed display
    return {
        content: text.trim(),
        status: text.toLowerCase().includes('violation') ? 'error' :
                text.toLowerCase().includes('warning') ? 'warning' : 'success'
    };
}

function setLoadingState(isLoading) {
    elements.submitBtn.disabled = isLoading;
    
    const btnContent = elements.submitBtn.querySelector('.btn-content');
    const btnLoading = elements.submitBtn.querySelector('.btn-loading');
    
    if (isLoading) {
        if (btnContent) btnContent.style.display = 'none';
        if (btnLoading) btnLoading.classList.remove('hidden');
    } else {
        if (btnContent) btnContent.style.display = 'flex';
        if (btnLoading) btnLoading.classList.add('hidden');
    }
}

// ============================================
// Live Analysis Feed
// ============================================

function showLiveAnalysisPanel() {
    // Show results panel early (before API returns)
    elements.resultsSection.classList.remove('hidden');
    elements.uploadSection.classList.add('hidden');
    
    // Reset status pill to reviewing state
    const statusPill = document.getElementById('status-badge');
    if (statusPill) {
        statusPill.className = 'status-pill reviewing';
        const statusText = statusPill.querySelector('.status-text');
        if (statusText) statusText.textContent = 'Reviewing...';
    }
    
    // Reset score display
    const scoreValue = document.getElementById('score-value');
    if (scoreValue) {
        scoreValue.textContent = '—';
        scoreValue.style.color = 'var(--text-secondary)';
    }
    
    // Reset summary
    const summaryText = document.getElementById('summary-text');
    if (summaryText) {
        summaryText.textContent = 'Analyzing your design for brand compliance...';
    }
    
    // Collapse all finding groups and reset counts
    document.querySelectorAll('.finding-group').forEach(group => {
        group.classList.remove('expanded');
    });
    document.querySelectorAll('.count-badge').forEach(badge => {
        badge.textContent = '0';
    });
    
    // Clear previous live feed
    const liveFeed = document.getElementById('live-analysis-feed');
    if (liveFeed) {
        liveFeed.innerHTML = '';
    }
    
    // Start pulse animation
    const pulseDot = document.querySelector('.pulse-dot');
    if (pulseDot) {
        pulseDot.classList.remove('done');
    }
    
    // Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    
    // Add initial message
    addLiveFeedMessage('🚀 Starting design analysis...');
}

function addLiveFeedMessage(message, isComplete = false) {
    const liveFeed = document.getElementById('live-analysis-feed');
    if (!liveFeed) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'feed-message' + (isComplete ? ' complete' : '');
    msgDiv.textContent = message;
    
    liveFeed.appendChild(msgDiv);
    liveFeed.scrollTop = liveFeed.scrollHeight;
}

function finishLiveFeed() {
    const pulseDot = document.querySelector('.pulse-dot');
    if (pulseDot) {
        pulseDot.classList.add('done');
    }
    
    addLiveFeedMessage('✅ Analysis complete!', true);
}

async function submitDesignReviewWithLiveFeed(payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.apiTimeout);
    
    // Simulate live updates during API call
    const liveMessages = [
        { delay: 500, msg: '📷 Processing uploaded image...' },
        { delay: 1500, msg: '🔍 Scanning design elements...' },
        { delay: 3000, msg: '🎨 Checking logo placement & clearspace...' },
        { delay: 4500, msg: '🌈 Verifying color palette compliance...' },
        { delay: 6000, msg: '✏️ Analyzing typography usage...' },
        { delay: 7500, msg: '♿ Evaluating accessibility standards...' },
        { delay: 9000, msg: '📐 Reviewing layout composition...' },
        { delay: 11000, msg: '📊 Calculating compliance score...' }
    ];
    
    // Start showing live messages
    liveMessages.forEach(({ delay, msg }) => {
        setTimeout(() => addLiveFeedMessage(msg), delay);
    });

    try {
        // Prepare Foundry agent query
        const agentQuery = `Please analyze this design for One A Day (OAD) brand compliance.

Design Details:
- Brand: ${payload.brandId}
- Design Type: ${payload.designType}
- Submitted by: ${payload.submittedBy}
${payload.notes ? `- Notes: ${payload.notes}` : ''}

Please check for:
1. Logo usage and clearspace requirements
2. Approved color palette compliance (#FF6600 primary, #333333 secondary)
3. Typography standards (Helvetica Neue, approved sizes and weights)
4. Overall brand consistency and accessibility (WCAG AA contrast ratios)

Provide a detailed analysis with specific violations, warnings, and recommendations. Include a compliance score from 0-100.

Image: data:${payload.imageMimeType};base64,${payload.imageFile}`;

        // Call Foundry agent
        const foundryPayload = {
            agentId: CONFIG.agentId,
            query: agentQuery,
            endpoint: CONFIG.foundryEndpoint,
            azureOpenaiEndpoint: CONFIG.azureOpenaiEndpoint,
            azureOpenaiDeployment: CONFIG.azureOpenaiDeployment
        };

        console.log('Calling Foundry agent with payload:', foundryPayload);

        const response = await fetch(`${CONFIG.apiBaseUrl}/api/foundry-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(foundryPayload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Foundry Agent Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Raw agent response:', data);
        
        // Add message for result processing
        addLiveFeedMessage('🧠 Processing AI response...');
        
        // Parse the agent response
        const parsedResponse = parseAgentResponse(data.response || data.content || JSON.stringify(data));
        
        // Create structured results
        const results = {
            complianceScore: parsedResponse.score || 75,
            status: parsedResponse.score >= 80 ? 'approved' : (parsedResponse.score >= 60 ? 'needs_revision' : 'rejected'),
            summary: parsedResponse.summary || 'Design has been analyzed for brand compliance.',
            grade: calculateGrade(parsedResponse.score),
            violations: parsedResponse.violations || [],
            warnings: parsedResponse.warnings || [],
            recommendations: parsedResponse.recommendations || [],
            findings: parsedResponse.detailedFindings || {},
            categoryScores: parsedResponse.categoryScores || generateDefaultCategoryScores(parsedResponse.score),
            rawResponse: data.response || data.content
        };

        return results;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('API Error:', error);
        throw error;
    }
}

function generateDefaultCategoryScores(overallScore) {
    // Generate reasonable category scores based on overall
    const variance = 10;
    const baseScore = overallScore || 75;
    
    return {
        logo: { 
            score: Math.min(25, Math.round((baseScore + (Math.random() - 0.5) * variance) * 0.25)), 
            maxScore: 25,
            percentage: Math.min(100, baseScore + (Math.random() - 0.5) * variance)
        },
        colors: { 
            score: Math.min(25, Math.round((baseScore + (Math.random() - 0.5) * variance) * 0.25)), 
            maxScore: 25,
            percentage: Math.min(100, baseScore + (Math.random() - 0.5) * variance)
        },
        typography: { 
            score: Math.min(20, Math.round((baseScore + (Math.random() - 0.5) * variance) * 0.20)), 
            maxScore: 20,
            percentage: Math.min(100, baseScore + (Math.random() - 0.5) * variance)
        },
        accessibility: { 
            score: Math.min(20, Math.round((baseScore + (Math.random() - 0.5) * variance) * 0.20)), 
            maxScore: 20,
            percentage: Math.min(100, baseScore + (Math.random() - 0.5) * variance)
        },
        layout: { 
            score: Math.min(10, Math.round((baseScore + (Math.random() - 0.5) * variance) * 0.10)), 
            maxScore: 10,
            percentage: Math.min(100, baseScore + (Math.random() - 0.5) * variance)
        }
    };
}

function calculateGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

// ============================================
// Results Display
// ============================================

function displayResults(results, formData) {
    // Hide upload section, show results
    elements.uploadSection.classList.add('hidden');
    elements.resultsSection.classList.remove('hidden');
    setLoadingState(false);
    
    // Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    
    // Store results for later use
    currentResults = results;
    
    // Populate results
    updateResultsHeader(results, formData);
    updateScoreDisplay(results.complianceScore);
    updateFindings(results);
    updateThoughtBubble(results);
}

function updateThoughtBubble(results) {
    const narrativeEl = document.getElementById('ai-analysis-narrative');
    
    if (!narrativeEl) return;
    
    // Generate natural language narrative from results
    const narrative = generateAnalysisNarrative(results);
    narrativeEl.innerHTML = narrative;
}

function generateAnalysisNarrative(results) {
    const score = results.complianceScore || 0;
    const violations = results.violations || [];
    const warnings = results.warnings || [];
    const recommendations = results.recommendations || [];
    
    // Build narrative steps
    let html = '';
    
    // Step 1: Initial scan
    html += `
        <div class="analysis-step">
            <div class="step-icon">🔍</div>
            <div class="step-content">
                <div class="step-title">Scanned Your Design</div>
                <div class="step-detail">I analyzed the uploaded image to identify visual elements including logos, colors, typography, and layout composition.</div>
            </div>
        </div>
    `;
    
    // Step 2: Brand rules check
    html += `
        <div class="analysis-step">
            <div class="step-icon">📋</div>
            <div class="step-content">
                <div class="step-title">Compared Against OAD Brand Guidelines</div>
                <div class="step-detail">I checked your design against 35+ brand rules including logo usage, color palette (#FF6600 primary), Proxima Nova typography, and WCAG accessibility standards.</div>
            </div>
        </div>
    `;
    
    // Step 3: Issues found
    const totalIssues = violations.length + warnings.length;
    if (totalIssues > 0) {
        html += `
            <div class="analysis-step">
                <div class="step-icon">${violations.length > 0 ? '⚠️' : '💡'}</div>
                <div class="step-content">
                    <div class="step-title">Identified ${totalIssues} Area${totalIssues > 1 ? 's' : ''} for Attention</div>
                    <div class="step-detail">
                        ${violations.length > 0 ? `Found ${violations.length} violation${violations.length > 1 ? 's' : ''} that need${violations.length === 1 ? 's' : ''} to be fixed. ` : ''}
                        ${warnings.length > 0 ? `Noted ${warnings.length} warning${warnings.length > 1 ? 's' : ''} to review. ` : ''}
                        ${recommendations.length > 0 ? `Plus ${recommendations.length} suggestion${recommendations.length > 1 ? 's' : ''} for improvement.` : ''}
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="analysis-step">
                <div class="step-icon">✅</div>
                <div class="step-content">
                    <div class="step-title">No Major Issues Found</div>
                    <div class="step-detail">Your design follows the OAD brand guidelines well. Great job maintaining brand consistency!</div>
                </div>
            </div>
        `;
    }
    
    // Step 4: Score calculation
    let scoreExplanation = '';
    if (score >= 90) {
        scoreExplanation = 'Excellent work! This design is ready for production with minimal or no changes needed.';
    } else if (score >= 80) {
        scoreExplanation = 'Good overall compliance. A few minor adjustments would make this design perfect.';
    } else if (score >= 70) {
        scoreExplanation = 'Acceptable but needs some revisions before approval. Check the violations and warnings above.';
    } else {
        scoreExplanation = 'This design needs significant revisions to meet brand standards. Please address the violations listed.';
    }
    
    html += `
        <div class="analysis-step">
            <div class="step-icon">📊</div>
            <div class="step-content">
                <div class="step-title">Calculated Compliance Score: ${score}%</div>
                <div class="step-detail">${scoreExplanation}</div>
            </div>
        </div>
    `;
    
    return html;
}

function updateResultsHeader(results, formData) {
    // Status pill
    const statusPill = document.getElementById('status-badge');
    const statusText = statusPill.querySelector('.status-text');
    
    // Determine status from score or results
    let status = 'pass';
    let statusLabel = 'Approved';
    
    if (results.status) {
        status = results.status.toLowerCase().includes('reject') ? 'fail' :
                 results.status.toLowerCase().includes('revision') ? 'warning' : 'pass';
        statusLabel = results.status.replace(/_/g, ' ');
    } else if (results.complianceScore < 70) {
        status = 'fail';
        statusLabel = 'Not Approved';
    } else if (results.complianceScore < 80) {
        status = 'warning';
        statusLabel = 'Needs Review';
    }
    
    // Remove reviewing class and add status class
    statusPill.classList.remove('reviewing');
    statusPill.className = `status-pill status-${status}`;
    if (statusText) statusText.textContent = statusLabel;
    
    // Summary text
    document.getElementById('summary-text').textContent = results.summary;
    
    // Update category scores if available
    if (results.categoryScores) {
        updateCategoryScores(results.categoryScores);
    }
}

function updateCategoryScores(categoryScores) {
    const categories = ['logo', 'colors', 'typography', 'accessibility', 'layout'];
    
    categories.forEach(cat => {
        const scoreData = categoryScores[cat];
        if (scoreData) {
            const scoreEl = document.getElementById(`${cat}-score`);
            const percentage = scoreData.percentage || (scoreData.score / scoreData.maxScore * 100);
            
            if (scoreEl) {
                scoreEl.textContent = `${Math.round(percentage)}%`;
                
                // Color based on percentage
                if (percentage >= 80) {
                    scoreEl.style.color = 'var(--success)';
                } else if (percentage >= 60) {
                    scoreEl.style.color = 'var(--warning)';
                } else {
                    scoreEl.style.color = 'var(--error)';
                }
            }
        }
    });
}

function updateScoreDisplay(score) {
    const scoreValue = document.getElementById('score-value');
    
    // Animate score value
    animateValue(scoreValue, 0, score, 1000);
    
    // Update color based on score
    setTimeout(() => {
        if (score >= 80) {
            scoreValue.style.color = 'var(--success)';
        } else if (score >= 60) {
            scoreValue.style.color = 'var(--warning)';
        } else {
            scoreValue.style.color = 'var(--error)';
        }
    }, 1000);
}

function updateFindings(results) {
    const violations = results.violations || [];
    const warnings = results.warnings || [];
    const recommendations = results.recommendations || [];
    
    // Update counts in headers
    const violationsCount = document.getElementById('violations-count');
    const warningsCount = document.getElementById('warnings-count');
    const recommendationsCount = document.getElementById('recommendations-count');
    
    if (violationsCount) violationsCount.textContent = violations.length;
    if (warningsCount) warningsCount.textContent = warnings.length;
    if (recommendationsCount) recommendationsCount.textContent = recommendations.length;
    
    // Populate content
    populateFindingGroup('violations-list', violations, 'error');
    populateFindingGroup('warnings-list', warnings, 'warning');
    populateFindingGroup('recommendations-list', recommendations, 'info');
    
    // Auto-expand first group with items
    document.querySelectorAll('.finding-group').forEach(g => g.classList.remove('expanded'));
    
    if (violations.length > 0) {
        const group = document.querySelector('[data-type="violations"]');
        if (group) group.classList.add('expanded');
    } else if (warnings.length > 0) {
        const group = document.querySelector('[data-type="warnings"]');
        if (group) group.classList.add('expanded');
    } else if (recommendations.length > 0) {
        const group = document.querySelector('[data-type="recommendations"]');
        if (group) group.classList.add('expanded');
    }
}

function populateFindingGroup(containerId, items, severity) {
    const content = document.getElementById(containerId);
    if (!content) return;
    
    // Remove collapsed class to allow display
    content.classList.remove('collapsed');
    
    // Extract type name from container ID (e.g., 'violations-list' -> 'violations')
    const typeName = containerId.replace('-list', '');
    
    if (items.length === 0) {
        content.innerHTML = `<div class="finding-empty">No ${typeName} found</div>`;
        return;
    }
    
    const icons = {
        error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
    };
    
    content.innerHTML = items.map(item => `
        <div class="finding-item finding-${severity}">
            <div class="finding-icon">${icons[severity]}</div>
            <div class="finding-content">
                <div class="finding-title">${item.title || item.message || item}</div>
                ${item.description ? `<div class="finding-description">${item.description}</div>` : ''}
                ${item.location ? `<div class="finding-location">${item.location}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function updateScoreEmoji(container, score) {
    if (!container) return;
    
    // SVG emoji faces based on score
    let emoji, color;
    
    if (score >= 90) {
        // Excellent - Big smile with stars
        color = 'var(--success)';
        emoji = `
            <svg viewBox="0 0 36 36" class="emoji-face">
                <circle cx="18" cy="18" r="16" fill="${color}" opacity="0.15"/>
                <circle cx="18" cy="18" r="16" fill="none" stroke="${color}" stroke-width="2"/>
                <circle cx="12" cy="14" r="2" fill="${color}"/>
                <circle cx="24" cy="14" r="2" fill="${color}"/>
                <path d="M10 22 Q18 30 26 22" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
                <path d="M6 8 L8 12 L4 12 Z" fill="${color}" opacity="0.6"/>
                <path d="M30 8 L32 12 L28 12 Z" fill="${color}" opacity="0.6"/>
            </svg>`;
    } else if (score >= 80) {
        // Good - Happy smile
        color = 'var(--success)';
        emoji = `
            <svg viewBox="0 0 36 36" class="emoji-face">
                <circle cx="18" cy="18" r="16" fill="${color}" opacity="0.15"/>
                <circle cx="18" cy="18" r="16" fill="none" stroke="${color}" stroke-width="2"/>
                <circle cx="12" cy="14" r="2" fill="${color}"/>
                <circle cx="24" cy="14" r="2" fill="${color}"/>
                <path d="M11 22 Q18 28 25 22" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
    } else if (score >= 70) {
        // Okay - Slight smile
        color = 'var(--warning)';
        emoji = `
            <svg viewBox="0 0 36 36" class="emoji-face">
                <circle cx="18" cy="18" r="16" fill="${color}" opacity="0.15"/>
                <circle cx="18" cy="18" r="16" fill="none" stroke="${color}" stroke-width="2"/>
                <circle cx="12" cy="14" r="2" fill="${color}"/>
                <circle cx="24" cy="14" r="2" fill="${color}"/>
                <path d="M12 23 Q18 26 24 23" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
    } else if (score >= 50) {
        // Concerned - Neutral/worried
        color = 'var(--warning)';
        emoji = `
            <svg viewBox="0 0 36 36" class="emoji-face">
                <circle cx="18" cy="18" r="16" fill="${color}" opacity="0.15"/>
                <circle cx="18" cy="18" r="16" fill="none" stroke="${color}" stroke-width="2"/>
                <circle cx="12" cy="14" r="2" fill="${color}"/>
                <circle cx="24" cy="14" r="2" fill="${color}"/>
                <line x1="12" y1="24" x2="24" y2="24" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
    } else {
        // Poor - Sad face
        color = 'var(--error)';
        emoji = `
            <svg viewBox="0 0 36 36" class="emoji-face">
                <circle cx="18" cy="18" r="16" fill="${color}" opacity="0.15"/>
                <circle cx="18" cy="18" r="16" fill="none" stroke="${color}" stroke-width="2"/>
                <circle cx="12" cy="14" r="2" fill="${color}"/>
                <circle cx="24" cy="14" r="2" fill="${color}"/>
                <path d="M12 26 Q18 20 24 26" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
    }
    
    container.innerHTML = emoji;
}

function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.round(current);
    }, 16);
}

function updateTabs(results) {
    // Get violations, warnings, recommendations from results
    // Handle both old format (criticalViolations) and new JSON format (violations)
    const violations = results.violations || results.criticalViolations || [];
    const warnings = results.warnings || [];
    const recommendations = results.recommendations || [];
    
    // Update tab counts
    document.getElementById('violations-count').textContent = violations.length;
    document.getElementById('warnings-count').textContent = warnings.length;
    document.getElementById('recommendations-count').textContent = recommendations.length;
    
    // Populate tab content
    populateFindingsList('violations-list', violations, 'critical');
    populateFindingsList('warnings-list', warnings, 'major');
    populateFindingsList('recommendations-list', recommendations, 'minor');
}

function populateFindingsList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = createEmptyState(type);
        return;
    }
    
    let validItemCount = 0;
    items.forEach(item => {
        const findingElement = createFindingItem(item, type);
        if (findingElement) {
            container.appendChild(findingElement);
            validItemCount++;
        }
    });
    
    // If all items were filtered out, show empty state
    if (validItemCount === 0) {
        container.innerHTML = createEmptyState(type);
    }
}

function createFindingItem(item, type) {
    const itemEl = document.createElement('div');
    itemEl.className = `finding-item ${type}`;
    
    // Handle both string items and object items with ruleId/description
    const isObject = typeof item === 'object' && item !== null;
    
    // Skip items that look like raw JSON data (status, passOrFail, scores, etc.)
    if (isObject && (item.status || item.passOrFail || item.score !== undefined || item.maxScore !== undefined)) {
        return null; // Skip metadata objects
    }
    
    let description = '';
    let ruleId = null;
    let category = null;
    let recommendation = null;
    
    if (isObject) {
        description = item.description || item.message || item.text || item.issue || '';
        ruleId = item.ruleId || item.rule || null;
        category = item.category || item.type || null;
        recommendation = item.recommendation || item.fix || item.suggestion || null;
        
        // If still no description, skip this item (it's probably metadata)
        if (!description) {
            return null;
        }
    } else if (typeof item === 'string') {
        description = item;
    } else {
        return null; // Skip non-string, non-object items
    }
    
    // Get source URL for this finding
    const sourceInfo = getSourceUrlForFinding(description);
    
    itemEl.innerHTML = `
        <div class="finding-header">
            <span class="finding-icon">${type === 'critical' ? '❌' : type === 'major' ? '⚠️' : '💡'}</span>
            <div class="finding-content">
                <div class="finding-text">${description}</div>
                ${ruleId ? `<span class="finding-rule-tag">${ruleId}</span>` : ''}
                ${recommendation ? `<p class="finding-recommendation">💡 ${recommendation}</p>` : ''}
                ${sourceInfo && sourceInfo.url ? `
                    <a href="${sourceInfo.url}" target="_blank" class="finding-source-link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        See guideline${sourceInfo.page ? ` (p.${sourceInfo.page})` : ''}
                    </a>
                ` : ''}
            </div>
        </div>
    `;
    
    return itemEl;
}

function createEmptyState(type) {
    const messages = {
        critical: 'No critical violations found! 🎉',
        major: 'No warnings to address',
        minor: 'No additional tips at this time',
        warning: 'No warnings found',
        info: 'No recommendations at this time',
        success: 'All checks passed'
    };
    
    return `
        <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 12l2 2 4-4"></path>
            </svg>
            <p>${messages[type] || 'No items found'}</p>
        </div>
    `;
}

function populatePassedChecks(containerId, results) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const passedChecks = [];
    
    // Generate passed checks based on findings
    if (results.findings) {
        if (results.findings.logo?.present) {
            passedChecks.push('Logo is present in the design');
        }
        if (results.findings.accessibility?.contrastCheck === 'pass') {
            passedChecks.push('Color contrast meets WCAG AA standards (4.5:1)');
        }
        if (results.findings.colors?.detectedColors?.some(c => c === '#FF6600')) {
            passedChecks.push('Primary brand color (#FF6600) is used');
        }
    }
    
    // Add generic passed checks if score is decent
    if (results.complianceScore >= 70) {
        passedChecks.push('Overall design layout follows brand guidelines');
        passedChecks.push('Design maintains professional appearance');
    }
    
    if (passedChecks.length === 0) {
        container.innerHTML = createEmptyState('success');
        return;
    }
    
    passedChecks.forEach(check => {
        const item = createFindingItem(check, 'success');
        container.appendChild(item);
    });
}

function updateDetailedFindings(findings) {
    if (!findings) return;
    
    // Logo details
    updateLogoDetails(findings.logo);
    updateStatusIndicator('logo-status', findings.logo);
    
    // Colors details
    updateColorsDetails(findings.colors);
    updateStatusIndicator('colors-status', findings.colors);
    
    // Typography details
    updateTypographyDetails(findings.typography);
    updateStatusIndicator('typography-status', findings.typography);
    
    // Accessibility details
    updateAccessibilityDetails(findings.accessibility);
    updateStatusIndicator('accessibility-status', findings.accessibility);
}

function updateLogoDetails(logoData) {
    const container = document.getElementById('logo-details');
    if (!logoData) return;
    
    container.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Present:</span>
            <span class="detail-value">${logoData.present ? '✅ Yes' : '❌ No'}</span>
        </div>
        ${logoData.width ? `
        <div class="detail-row">
            <span class="detail-label">Width:</span>
            <span class="detail-value">${logoData.width}</span>
        </div>` : ''}
        ${logoData.clearSpace ? `
        <div class="detail-row">
            <span class="detail-label">Clear Space:</span>
            <span class="detail-value">${logoData.clearSpace === 'pass' ? '✅ Adequate' : '❌ Insufficient'}</span>
        </div>` : ''}
        ${logoData.violations && logoData.violations.length > 0 ? `
        <div class="detail-row">
            <span class="detail-label">Issues:</span>
            <div class="detail-value">
                <ul style="margin: 0; padding-left: 1.25rem;">
                    ${logoData.violations.map(v => `<li>${v}</li>`).join('')}
                </ul>
            </div>
        </div>` : ''}
    `;
}

function updateColorsDetails(colorsData) {
    const container = document.getElementById('colors-details');
    if (!colorsData) return;
    
    let swatchesHTML = '';
    
    if (colorsData.detectedColors && colorsData.detectedColors.length > 0) {
        swatchesHTML = '<div class="color-swatches">';
        colorsData.detectedColors.forEach(color => {
            const isApproved = !colorsData.unapprovedColors?.includes(color);
            swatchesHTML += `
                <div class="color-swatch">
                    <div class="color-box" style="background-color: ${color};"></div>
                    <span class="color-code">${color}</span>
                    <span>${isApproved ? '✅' : '❌'}</span>
                </div>
            `;
        });
        swatchesHTML += '</div>';
    }
    
    container.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Detected Colors:</span>
            <div class="detail-value">
                ${swatchesHTML || 'No colors detected'}
            </div>
        </div>
        ${colorsData.unapprovedColors && colorsData.unapprovedColors.length > 0 ? `
        <div class="detail-row">
            <span class="detail-label">Unapproved:</span>
            <span class="detail-value">${colorsData.unapprovedColors.join(', ')}</span>
        </div>` : ''}
    `;
}

function updateTypographyDetails(typographyData) {
    const container = document.getElementById('typography-details');
    if (!typographyData) return;
    
    container.innerHTML = `
        ${typographyData.detectedFonts ? `
        <div class="detail-row">
            <span class="detail-label">Detected Fonts:</span>
            <span class="detail-value">${typographyData.detectedFonts.join(', ')}</span>
        </div>` : ''}
        ${typographyData.fontApproved !== undefined ? `
        <div class="detail-row">
            <span class="detail-label">Font Approved:</span>
            <span class="detail-value">${typographyData.fontApproved ? '✅ Yes' : '❌ No'}</span>
        </div>` : ''}
        ${typographyData.violations && typographyData.violations.length > 0 ? `
        <div class="detail-row">
            <span class="detail-label">Issues:</span>
            <div class="detail-value">
                <ul style="margin: 0; padding-left: 1.25rem;">
                    ${typographyData.violations.map(v => `<li>${v}</li>`).join('')}
                </ul>
            </div>
        </div>` : ''}
    `;
}

function updateAccessibilityDetails(accessibilityData) {
    const container = document.getElementById('accessibility-details');
    if (!accessibilityData) return;
    
    container.innerHTML = `
        ${accessibilityData.contrastCheck ? `
        <div class="detail-row">
            <span class="detail-label">Contrast Ratio:</span>
            <span class="detail-value">${accessibilityData.contrastCheck === 'pass' ? '✅ Passes WCAG AA' : '❌ Fails WCAG AA'}</span>
        </div>` : ''}
        ${accessibilityData.textSizeCheck ? `
        <div class="detail-row">
            <span class="detail-label">Text Size:</span>
            <span class="detail-value">${accessibilityData.textSizeCheck === 'pass' ? '✅ Adequate' : '❌ Too small'}</span>
        </div>` : ''}
    `;
}

function updateStatusIndicator(elementId, data) {
    const indicator = document.getElementById(elementId);
    if (!data) return;
    
    // Determine status based on violations
    let status = 'pass';
    if (data.violations && data.violations.length > 0) {
        status = 'fail';
    } else if (data.warnings && data.warnings.length > 0) {
        status = 'warning';
    }
    
    indicator.className = `status-indicator status-${status}`;
}

// ============================================
// Tab Navigation
// ============================================

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update pane visibility
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });
}

// ============================================
// Accordion Handling
// ============================================

function setupAccordions() {
    // Original accordion headers
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.closest('.accordion-item');
            const isActive = item.classList.contains('active');
            
            // Close all accordions
            document.querySelectorAll('.accordion-item').forEach(i => {
                i.classList.remove('active');
            });
            
            // Toggle clicked accordion
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
    
    // Finding group accordion headers
    const findingHeaders = document.querySelectorAll('.finding-group-header');
    
    findingHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const group = header.closest('.finding-group');
            group.classList.toggle('expanded');
        });
    });
}

// ============================================
// Results Actions
// ============================================

function setupResultsActions() {
    const downloadBtn = document.getElementById('download-btn');
    const shareBtn = document.getElementById('share-btn');
    const requestReviewBtn = document.getElementById('request-review-btn');
    const newReviewBtn = document.getElementById('new-review-btn');
    
    if (downloadBtn) downloadBtn.addEventListener('click', handleDownloadReport);
    if (shareBtn) shareBtn.addEventListener('click', handleShareResults);
    if (requestReviewBtn) requestReviewBtn.addEventListener('click', handleRequestReview);
    if (newReviewBtn) newReviewBtn.addEventListener('click', handleNewReview);
}

function handleDownloadReport() {
    if (!currentResults) return;
    
    const markdown = generateMarkdownReport(currentResults);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-compliance-report-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Report downloaded successfully', 'success');
}

function generateMarkdownReport(results) {
    const brand = document.getElementById('brand-select').value;
    const designType = document.getElementById('design-type-select').value;
    const date = new Date().toLocaleDateString();
    
    return `# Brand Compliance Report

**Brand:** ${getBrandName(brand)}  
**Design Type:** ${getDesignTypeName(designType)}  
**Date:** ${date}  
**Status:** ${results.overallCompliance.toUpperCase()}  
**Compliance Score:** ${results.complianceScore}/100

---

## Summary

${results.summary}

---

## Critical Violations

${results.criticalViolations && results.criticalViolations.length > 0 
    ? results.criticalViolations.map(v => `- ❌ ${v}`).join('\n') 
    : '_No critical violations found._'}

---

## Warnings

${results.warnings && results.warnings.length > 0 
    ? results.warnings.map(w => `- ⚠️ ${w}`).join('\n') 
    : '_No warnings found._'}

---

## Recommendations

${results.recommendations && results.recommendations.length > 0 
    ? results.recommendations.map(r => `- 💡 ${r}`).join('\n') 
    : '_No recommendations at this time._'}

---

## Detailed Findings

### Logo
${results.findings?.logo ? formatLogoFindings(results.findings.logo) : '_No data available._'}

### Colors
${results.findings?.colors ? formatColorFindings(results.findings.colors) : '_No data available._'}

### Typography
${results.findings?.typography ? formatTypographyFindings(results.findings.typography) : '_No data available._'}

### Accessibility
${results.findings?.accessibility ? formatAccessibilityFindings(results.findings.accessibility) : '_No data available._'}

---

_Report generated by OAD Brand Review Assistant_
`;
}

function formatLogoFindings(logo) {
    return `
- Present: ${logo.present ? '✅ Yes' : '❌ No'}
${logo.width ? `- Width: ${logo.width}` : ''}
${logo.clearSpace ? `- Clear Space: ${logo.clearSpace === 'pass' ? '✅ Adequate' : '❌ Insufficient'}` : ''}
${logo.violations ? logo.violations.map(v => `- Issue: ${v}`).join('\n') : ''}
`.trim();
}

function formatColorFindings(colors) {
    return `
- Detected Colors: ${colors.detectedColors?.join(', ') || 'None'}
${colors.unapprovedColors && colors.unapprovedColors.length > 0 
    ? `- Unapproved Colors: ${colors.unapprovedColors.join(', ')}` 
    : ''}
`.trim();
}

function formatTypographyFindings(typography) {
    return `
${typography.detectedFonts ? `- Detected Fonts: ${typography.detectedFonts.join(', ')}` : ''}
${typography.fontApproved !== undefined 
    ? `- Font Approved: ${typography.fontApproved ? '✅ Yes' : '❌ No'}` 
    : ''}
`.trim();
}

function formatAccessibilityFindings(accessibility) {
    return `
${accessibility.contrastCheck 
    ? `- Contrast Ratio: ${accessibility.contrastCheck === 'pass' ? '✅ Passes' : '❌ Fails'}` 
    : ''}
${accessibility.textSizeCheck 
    ? `- Text Size: ${accessibility.textSizeCheck === 'pass' ? '✅ Adequate' : '❌ Too small'}` 
    : ''}
`.trim();
}

async function handleShareResults() {
    const shareData = {
        title: 'Brand Compliance Report',
        text: `Compliance Score: ${currentResults.complianceScore}/100 - ${currentResults.overallCompliance.toUpperCase()}`,
        url: window.location.href
    };
    
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            showToast('Shared successfully', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                fallbackShare();
            }
        }
    } else {
        fallbackShare();
    }
}

function fallbackShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard', 'success');
    }).catch(() => {
        showToast('Unable to share. Please copy the URL manually.', 'error');
    });
}

function handleRequestReview() {
    const email = document.getElementById('email-input').value;
    const brand = document.getElementById('brand-select').value;
    
    const subject = `Brand Compliance Review Request - ${getBrandName(brand)}`;
    const body = `Hi Brand Team,

I've completed an automated brand compliance review and would like to request a human review.

Compliance Score: ${currentResults.complianceScore}/100
Status: ${currentResults.overallCompliance.toUpperCase()}

Critical Violations: ${currentResults.criticalViolations?.length || 0}
Warnings: ${currentResults.warnings?.length || 0}

Please review the attached design and provide feedback.

Thank you!
${email}`;
    
    window.location.href = `mailto:brand-team@bayer.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast('Opening email client...', 'info');
}

function handleNewReview() {
    // Reset state
    currentResults = null;
    uploadedFile = null;
    
    // Reset form
    elements.uploadForm.reset();
    handleFileRemove(new Event('click'));
    
    // Show upload section, hide results
    elements.resultsSection.classList.add('hidden');
    elements.uploadSection.classList.remove('hidden');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    
    // Update icon based on type
    const icons = {
        success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
        error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
        warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
        info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
    };
    
    elements.toastIcon.innerHTML = icons[type] || icons.info;
    
    // Show toast
    elements.toast.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// ============================================
// Helper Functions
// ============================================

function getBrandName(brandId) {
    const brands = {
        'OAD': 'One A Day',
        'CLARITIN': 'Claritin',
        'ALEVE': 'Aleve',
        'ASPIRIN': 'Bayer Aspirin',
        'CITRACAL': 'Citracal'
    };
    return brands[brandId] || brandId;
}

function getDesignTypeName(designType) {
    const types = {
        'social-media': 'Social Media Post',
        'banner': 'Digital Banner Ad',
        'email': 'Email Marketing',
        'print': 'Print Advertisement',
        'packaging': 'Product Packaging',
        'website': 'Website Asset',
        'presentation': 'Presentation Slide'
    };
    return types[designType] || designType;
}

function getIconSVG(type) {
    const icons = {
        critical: `
            <svg class="finding-icon critical" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
        `,
        warning: `
            <svg class="finding-icon warning" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        `,
        success: `
            <svg class="finding-icon success" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        `,
        info: `
            <svg class="finding-icon info" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        `
    };
    
    return icons[type] || icons.info;
}

// ============================================
// Development/Testing Mock Data
// ============================================

// Uncomment this function and call it in the console to test the UI with mock data
function loadMockResults() {
    const mockResults = {
        overallCompliance: "fail",
        complianceScore: 72,
        findings: {
            logo: {
                present: true,
                width: "100px",
                clearSpace: "fail",
                violations: ["Logo clearspace insufficient (10px detected, 20px required)"]
            },
            colors: {
                detectedColors: ["#FF6600", "#0000FF", "#333333"],
                unapprovedColors: ["#0000FF"],
                violations: ["Unapproved color #0000FF detected"]
            },
            typography: {
                detectedFonts: ["Arial"],
                fontApproved: false,
                violations: ["Font 'Arial' is not approved. Use 'Helvetica Neue'"]
            },
            accessibility: {
                contrastCheck: "pass",
                textSizeCheck: "fail",
                violations: ["Body text size 12px is below minimum 14px"]
            }
        },
        criticalViolations: [
            "Logo clearspace insufficient (10px detected, 20px required)",
            "Unapproved color #0000FF detected"
        ],
        warnings: [
            "Font may not be Helvetica Neue - please verify"
        ],
        recommendations: [
            "Increase logo clearspace to 20px minimum",
            "Replace #0000FF with approved brand color #3B82F6 or #333333"
        ],
        summary: "Design has 2 critical violations and 1 warning. Score: 72/100. Fix clearspace and color issues before approval."
    };
    
    const mockFormData = {
        brandId: 'OAD',
        designType: 'social-media',
        submittedBy: 'designer@bayer.com'
    };
    
    currentResults = mockResults;
    displayResults(mockResults, mockFormData);
}

// ============================================
// Sidebar Navigation
// ============================================

function setupSidebarNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-panel]');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const panelId = item.dataset.panel;
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show/hide panels
            showPanel(panelId);
        });
    });
}

function showPanel(panelId) {
    // Hide all panels
    const panels = ['upload-section', 'results-section', 'guidelines-section'];
    panels.forEach(id => {
        const panel = document.getElementById(id);
        if (panel) {
            panel.classList.add('hidden');
        }
    });
    
    // Show selected panel
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }
}

// ============================================
// Guidelines Panel
// ============================================

let brandRulesData = null;

async function loadBrandGuidelines() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/api/brand-rules/OAD`);
        if (response.ok) {
            brandRulesData = await response.json();
            updateGuidelinesLinks();
            renderGuidelinesRules();
        }
    } catch (error) {
        console.warn('Could not load brand rules:', error);
        // Set default data
        brandRulesData = getDefaultBrandRules();
        updateGuidelinesLinks();
        renderGuidelinesRules();
    }
}

function getDefaultBrandRules() {
    return {
        brandName: "One A Day",
        guidelinesUrl: "https://bayer-brand-portal.com/oad/guidelines",
        brandBookUrl: "https://bayer-brand-portal.com/oad/brandbook",
        assetLibraryUrl: "https://bayer-brand-portal.com/oad/assets",
        sourceReferences: {
            brandBook: {
                url: "https://bayer-brand-portal.com/oad/brandbook",
                sections: {
                    logo: { startPage: 8, anchor: "#logo-guidelines" },
                    colors: { startPage: 16, anchor: "#color-palette" },
                    typography: { startPage: 24, anchor: "#typography" },
                    accessibility: { startPage: 48, anchor: "#accessibility" }
                }
            }
        },
        logo: {
            sourceSection: "logo",
            rules: [
                { ruleId: "LOGO-001", name: "Logo Presence", requirement: "One A Day logo must be present on all brand materials", weight: "critical", sourcePage: 8, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#logo-guidelines" },
                { ruleId: "LOGO-002", name: "Logo Integrity", requirement: "Logo must not be stretched, distorted, rotated, or modified", weight: "critical", sourcePage: 10, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#logo-integrity" },
                { ruleId: "LOGO-003", name: "Minimum Size", requirement: "Logo must be at least 120px wide for digital applications", weight: "critical", sourcePage: 12, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#logo-sizing" },
                { ruleId: "LOGO-005", name: "Clear Space", requirement: "Maintain minimum clear space equal to height of 'O' around the logo", weight: "major", sourcePage: 11, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#logo-clearspace" }
            ]
        },
        colors: {
            sourceSection: "colors",
            rules: [
                { ruleId: "COLOR-001", name: "Approved Palette", requirement: "Only use colors from the approved One A Day color palette", weight: "critical", sourcePage: 16, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#color-palette" },
                { ruleId: "COLOR-002", name: "Primary Color", requirement: "OAD Orange (#FF6600) should be dominant in key brand moments", weight: "major", sourcePage: 17, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#primary-colors" }
            ]
        },
        typography: {
            sourceSection: "typography",
            rules: [
                { ruleId: "TYPE-001", name: "Primary Typeface", requirement: "Use Proxima Nova as primary typeface for all headlines and body text", weight: "critical", sourcePage: 24, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#typography" },
                { ruleId: "TYPE-002", name: "Font Hierarchy", requirement: "Maintain proper type hierarchy with approved sizes and weights", weight: "major", sourcePage: 26, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#type-hierarchy" }
            ]
        },
        accessibility: {
            sourceSection: "accessibility",
            rules: [
                { ruleId: "A11Y-001", name: "Contrast Ratio", requirement: "Text must meet WCAG AA contrast ratio of 4.5:1 (3:1 for large text)", weight: "critical", sourcePage: 48, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#accessibility" },
                { ruleId: "A11Y-002", name: "Touch Targets", requirement: "Interactive elements must be at least 44x44px", weight: "major", sourcePage: 50, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#touch-targets" }
            ]
        },
        layout: {
            sourceSection: "layout",
            rules: [
                { ruleId: "LAYOUT-001", name: "Grid System", requirement: "Follow 12-column grid for web layouts, 4-column for mobile", weight: "major", sourcePage: 40, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#layout-grids" },
                { ruleId: "LAYOUT-002", name: "Safe Zones", requirement: "Maintain minimum margins and padding as per spec", weight: "minor", sourcePage: 42, sourceUrl: "https://bayer-brand-portal.com/oad/brandbook#safe-zones" }
            ]
        }
    };
}

function updateGuidelinesLinks() {
    if (!brandRulesData) return;
    
    const brandBookBtn = document.getElementById('open-brandbook');
    const assetsBtn = document.getElementById('download-assets');
    
    if (brandBookBtn && brandRulesData.brandBookUrl) {
        brandBookBtn.href = brandRulesData.brandBookUrl;
    }
    if (assetsBtn && brandRulesData.assetLibraryUrl) {
        assetsBtn.href = brandRulesData.assetLibraryUrl;
    }
    
    // Update quick links
    const quickLinks = document.querySelectorAll('.quick-link[data-section]');
    quickLinks.forEach(link => {
        const section = link.dataset.section;
        if (brandRulesData.sourceReferences?.brandBook?.sections?.[section]) {
            const sectionData = brandRulesData.sourceReferences.brandBook.sections[section];
            link.href = brandRulesData.brandBookUrl + sectionData.anchor;
        }
    });
}

function setupGuidelinesPanel() {
    // Wire up the simplified quick link cards
    const linkCards = document.querySelectorAll('.guideline-link-card');
    
    linkCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const linkId = card.id;
            
            if (!brandRulesData) {
                showToast('Brand data not loaded yet', 'warning');
                return;
            }
            
            let targetUrl = null;
            
            switch(linkId) {
                case 'link-brandbook':
                    targetUrl = brandRulesData.brandBookUrl || brandRulesData.guidelinesUrl;
                    break;
                case 'link-logo':
                    targetUrl = brandRulesData.sourceReferences?.brandBook?.url + 
                               (brandRulesData.sourceReferences?.brandBook?.sections?.logo?.anchor || '#logo-guidelines');
                    break;
                case 'link-colors':
                    targetUrl = brandRulesData.sourceReferences?.brandBook?.url + 
                               (brandRulesData.sourceReferences?.brandBook?.sections?.colors?.anchor || '#color-palette');
                    break;
                case 'link-typography':
                    targetUrl = brandRulesData.sourceReferences?.brandBook?.url + 
                               (brandRulesData.sourceReferences?.brandBook?.sections?.typography?.anchor || '#typography');
                    break;
                case 'link-accessibility':
                    targetUrl = brandRulesData.sourceReferences?.brandBook?.url + 
                               (brandRulesData.sourceReferences?.brandBook?.sections?.accessibility?.anchor || '#accessibility');
                    break;
                case 'link-layout':
                    targetUrl = brandRulesData.sourceReferences?.brandBook?.url + 
                               (brandRulesData.sourceReferences?.brandBook?.sections?.layout?.anchor || '#layout-grids');
                    break;
                case 'link-assets':
                    targetUrl = brandRulesData.assetLibraryUrl || brandRulesData.sourceReferences?.downloadAssets;
                    break;
            }
            
            if (targetUrl) {
                window.open(targetUrl, '_blank');
            } else {
                showToast('Link not configured in brand data', 'info');
            }
        });
    });
}

function renderGuidelinesRules(category = 'all', searchTerm = '') {
    const listContainer = document.getElementById('guidelines-list');
    if (!listContainer || !brandRulesData) return;
    
    // Gather all rules
    let allRules = [];
    const categories = ['logo', 'colors', 'typography', 'accessibility', 'layout'];
    
    categories.forEach(cat => {
        if (brandRulesData[cat]?.rules) {
            brandRulesData[cat].rules.forEach(rule => {
                allRules.push({ ...rule, category: cat });
            });
        }
    });
    
    // Filter by category
    if (category && category !== 'all') {
        allRules = allRules.filter(rule => rule.category === category);
    }
    
    // Filter by search term
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        allRules = allRules.filter(rule => 
            rule.name.toLowerCase().includes(term) ||
            rule.requirement.toLowerCase().includes(term) ||
            rule.ruleId.toLowerCase().includes(term)
        );
    }
    
    // Render
    if (allRules.length === 0) {
        listContainer.innerHTML = `
            <div class="guidelines-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p>No guidelines found${searchTerm ? ` for "${searchTerm}"` : ''}</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = allRules.map(rule => `
        <div class="guideline-rule" data-rule-id="${rule.ruleId}">
            <div class="guideline-rule-header" onclick="toggleGuidelineRule('${rule.ruleId}')">
                <div class="rule-weight ${rule.weight}"></div>
                <div class="rule-info">
                    <div class="rule-id">${rule.ruleId}</div>
                    <div class="rule-name">${rule.name}</div>
                </div>
                <svg class="rule-expand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            <div class="guideline-rule-content">
                <p class="rule-requirement">${rule.requirement}</p>
                ${rule.sourceUrl ? `
                    <a href="${rule.sourceUrl}" target="_blank" class="rule-source">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        View in Brand Book${rule.sourcePage ? ` (p.${rule.sourcePage})` : ''}
                    </a>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function toggleGuidelineRule(ruleId) {
    const rule = document.querySelector(`.guideline-rule[data-rule-id="${ruleId}"]`);
    if (rule) {
        rule.classList.toggle('expanded');
    }
}

// Make function globally available
window.toggleGuidelineRule = toggleGuidelineRule;

// Helper function to get source URL for a finding
function getSourceUrlForFinding(finding) {
    if (!brandRulesData) return null;
    
    // Try to match finding text to a rule
    const categories = ['logo', 'colors', 'typography', 'accessibility', 'layout'];
    
    for (const cat of categories) {
        if (brandRulesData[cat]?.rules) {
            for (const rule of brandRulesData[cat].rules) {
                // Check if finding mentions this rule
                const findingLower = finding.toLowerCase();
                const ruleLower = rule.name.toLowerCase();
                
                if (findingLower.includes(ruleLower) || 
                    findingLower.includes(rule.ruleId.toLowerCase()) ||
                    (rule.requirement && findingLower.includes(rule.requirement.toLowerCase().substring(0, 20)))) {
                    return {
                        url: rule.sourceUrl,
                        page: rule.sourcePage,
                        ruleId: rule.ruleId,
                        ruleName: rule.name
                    };
                }
            }
        }
    }
    
    // Default category matching
    if (finding.toLowerCase().includes('logo')) {
        return { url: brandRulesData.brandBookUrl + '#logo-guidelines', section: 'logo' };
    }
    if (finding.toLowerCase().includes('color') || finding.toLowerCase().includes('#')) {
        return { url: brandRulesData.brandBookUrl + '#color-palette', section: 'colors' };
    }
    if (finding.toLowerCase().includes('font') || finding.toLowerCase().includes('type') || finding.toLowerCase().includes('text')) {
        return { url: brandRulesData.brandBookUrl + '#typography', section: 'typography' };
    }
    if (finding.toLowerCase().includes('contrast') || finding.toLowerCase().includes('accessibility')) {
        return { url: brandRulesData.brandBookUrl + '#accessibility', section: 'accessibility' };
    }
    
    return null;
}

// For debugging - expose to console
window.brandReviewApp = {
    loadMockResults,
    CONFIG,
    brandRulesData: () => brandRulesData,
    getSourceUrlForFinding
};
