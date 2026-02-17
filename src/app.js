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
    allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'message/rfc822', 'application/pdf'],
    apiTimeout: 120000, // 2 minutes (Foundry agents may take longer)
    
    // Analysis steps for animated status display
    analysisSteps: [
        { id: 'upload', label: 'Processing file...', duration: 500 },
        { id: 'logo', label: 'Checking logo compliance...', duration: 800 },
        { id: 'colors', label: 'Analyzing color palette...', duration: 800 },
        { id: 'typography', label: 'Reviewing typography...', duration: 700 },
        { id: 'accessibility', label: 'Verifying accessibility (WCAG AA)...', duration: 800 },
        { id: 'imagery', label: 'Evaluating imagery...', duration: 600 },
        { id: 'layout', label: 'Checking layout & hierarchy...', duration: 700 },
        { id: 'scoring', label: 'Calculating compliance score...', duration: 500 },
        { id: 'complete', label: 'Generating report...', duration: 400 }
    ]
};

// State - Batch processing
let uploadedFiles = []; // Array of {id, file, preview, status, results}
let batchResults = []; // Array of completed results
let isProcessing = false;
let currentFileIndex = 0;

// ============================================
// DOM Elements
// ============================================

const elements = {
    uploadForm: document.getElementById('upload-form'),
    fileUpload: document.getElementById('file-upload'),
    dropZone: document.getElementById('drop-zone'),
    submitBtn: document.getElementById('submit-btn'),
    uploadSection: document.getElementById('upload-section'),
    resultsSection: document.getElementById('results-section'),
    imageQueue: document.getElementById('image-queue'),
    queueItems: document.getElementById('queue-items'),
    queueCount: document.getElementById('queue-count'),
    btnCount: document.getElementById('btn-count'),
    clearQueueBtn: document.getElementById('clear-queue'),
    batchResults: document.getElementById('batch-results'),
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
    
    // Drag and drop events
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    
    // Queue management
    if (elements.clearQueueBtn) {
        elements.clearQueueBtn.addEventListener('click', clearQueue);
    }
    
    // Submit button (direct click instead of form submit)
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleFormSubmit);
    }
    
    // Brand selector change
    const brandSelect = document.getElementById('brand-select');
    if (brandSelect) {
        brandSelect.addEventListener('change', handleBrandChange);
    }
    
    // Results section interactions
    setupAccordions();
    setupResultsActions();
    setupModal();
}

function handleBrandChange(e) {
    const brandName = e.target.options[e.target.selectedIndex].text;
    const badgeName = document.getElementById('selected-brand-name');
    if (badgeName) {
        badgeName.textContent = brandName;
    }
}

function setupModal() {
    const modal = document.getElementById('result-modal');
    const closeBtn = document.getElementById('modal-close');
    const backdrop = modal?.querySelector('.modal-backdrop');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeModal);
    }
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
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
// File Upload Handling (Multi-file)
// ============================================

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    processFiles(files);
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
    
    const files = Array.from(event.dataTransfer.files);
    processFiles(files);
}

async function processFiles(files) {
    for (const file of files) {
        // Check if it's an email file
        if (file.name.endsWith('.eml') || file.type === 'message/rfc822') {
            await processEmailFile(file);
        } else {
            addFileToQueue(file);
        }
    }
}

async function processEmailFile(emailFile) {
    try {
        showToast('Extracting images from email...', 'info');
        
        const formData = new FormData();
        formData.append('email', emailFile);
        
        const response = await fetch(`${CONFIG.apiBaseUrl}/api/parse-email`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to parse email');
        }
        
        const { images } = await response.json();
        
        if (images.length === 0) {
            showToast('No images found in email', 'warning');
            return;
        }
        
        // Add extracted images to queue
        for (const img of images) {
            const fileObj = {
                id: generateId(),
                name: img.filename,
                preview: `data:${img.mimeType};base64,${img.base64}`,
                base64: img.base64,
                mimeType: img.mimeType,
                fromEmail: emailFile.name,
                status: 'pending',
                results: null
            };
            uploadedFiles.push(fileObj);
        }
        
        updateQueueUI();
        showToast(`Extracted ${images.length} image(s) from email`, 'success');
        
    } catch (error) {
        console.error('Email parsing error:', error);
        showToast('Failed to extract images from email', 'error');
    }
}

// Process PDF files - extract pages or send directly to AI
async function processPDFFile(pdfFile) {
    try {
        showToast('Processing PDF...', 'info');
        
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        
        const response = await fetch(`${CONFIG.apiBaseUrl}/api/parse-pdf`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to process PDF');
        }
        
        const { images, message } = await response.json();
        
        if (!images || images.length === 0) {
            showToast('Could not process PDF', 'warning');
            return;
        }
        
        // Add extracted pages/PDF to queue
        for (const img of images) {
            const fileObj = {
                id: generateId(),
                name: img.filename,
                preview: img.mimeType === 'application/pdf' 
                    ? createPDFPreview(pdfFile.name) 
                    : `data:${img.mimeType};base64,${img.base64}`,
                base64: img.base64,
                mimeType: img.mimeType,
                fromPDF: pdfFile.name,
                pageNumber: img.pageNumber || 1,
                status: 'pending',
                results: null
            };
            uploadedFiles.push(fileObj);
        }
        
        updateQueueUI();
        showToast(message || `PDF ready for analysis`, 'success');
        
    } catch (error) {
        console.error('PDF processing error:', error);
        showToast('Failed to process PDF', 'error');
    }
}

// Create a visual preview for PDF files
function createPDFPreview(filename) {
    // Create an SVG data URL as a placeholder for PDF preview
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f8f9fa"/>
        <rect x="50" y="30" width="100" height="130" fill="#fff" stroke="#dee2e6" stroke-width="2" rx="4"/>
        <rect x="60" y="50" width="60" height="8" fill="#FF6600" rx="2"/>
        <rect x="60" y="65" width="80" height="6" fill="#e9ecef" rx="2"/>
        <rect x="60" y="78" width="70" height="6" fill="#e9ecef" rx="2"/>
        <rect x="60" y="91" width="75" height="6" fill="#e9ecef" rx="2"/>
        <rect x="60" y="104" width="65" height="6" fill="#e9ecef" rx="2"/>
        <rect x="60" y="117" width="80" height="6" fill="#e9ecef" rx="2"/>
        <rect x="60" y="130" width="50" height="6" fill="#e9ecef" rx="2"/>
        <text x="100" y="180" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6c757d">PDF</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function addFileToQueue(file) {
    // Validate file type - now includes PDF
    const isImage = ['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type);
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (!isImage && !isPDF) {
        showToast(`Skipped ${file.name} - unsupported format`, 'warning');
        return;
    }
    
    // Validate file size
    if (file.size > CONFIG.maxFileSize) {
        showToast(`Skipped ${file.name} - file too large (max 10MB)`, 'warning');
        return;
    }
    
    // Handle PDF files - send to server for processing
    if (isPDF) {
        processPDFFile(file);
        return;
    }
    
    // Create file object with preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const fileObj = {
            id: generateId(),
            file: file,
            name: file.name,
            preview: e.target.result,
            base64: e.target.result.split(',')[1],
            mimeType: file.type,
            status: 'pending',
            results: null
        };
        uploadedFiles.push(fileObj);
        updateQueueUI();
    };
    reader.readAsDataURL(file);
}

function generateId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function updateQueueUI() {
    const count = uploadedFiles.length;
    
    // Update count displays
    if (elements.queueCount) {
        elements.queueCount.textContent = count;
    }
    if (elements.btnCount) {
        elements.btnCount.textContent = count;
    }
    
    // Update submit button state
    if (elements.submitBtn) {
        elements.submitBtn.disabled = count === 0;
    }
    
    // Update clear button state
    if (elements.clearQueueBtn) {
        elements.clearQueueBtn.disabled = count === 0;
    }
    
    // Toggle empty state
    const emptyState = document.getElementById('queue-empty');
    if (emptyState) {
        emptyState.classList.toggle('hidden', count > 0);
    }
    
    // Render queue items as grid tiles
    if (elements.queueItems) {
        elements.queueItems.innerHTML = uploadedFiles.map(f => `
            <div class="queue-tile ${f.status}" data-id="${f.id}">
                <img src="${f.preview}" alt="${f.name}" class="queue-tile-img">
                <div class="queue-tile-overlay">
                    ${f.status === 'processing' ? '<div class="queue-tile-spinner"></div>' : ''}
                    ${f.status === 'done' ? '<svg class="queue-tile-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    ${f.status === 'error' ? '<svg class="queue-tile-error" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : ''}
                </div>
                ${f.status === 'pending' ? `
                    <button class="queue-tile-remove" onclick="removeFromQueue('${f.id}')" title="Remove">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `).join('');
    }
}

function getStatusText(status) {
    const texts = {
        pending: 'Waiting...',
        processing: 'Analyzing...',
        done: 'Complete',
        error: 'Failed'
    };
    return texts[status] || status;
}

function removeFromQueue(id) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    updateQueueUI();
}

function clearQueue() {
    uploadedFiles = [];
    updateQueueUI();
    elements.fileUpload.value = '';
}

// Make removeFromQueue available globally
window.removeFromQueue = removeFromQueue;

// ============================================
// Analysis Status Animation
// ============================================

let analysisAnimationInterval = null;
let currentStepIndex = 0;

function startAnalysisAnimation() {
    const statusContainer = document.getElementById('analysis-status');
    if (!statusContainer) return;
    
    statusContainer.classList.remove('hidden');
    currentStepIndex = 0;
    
    function updateStep() {
        const steps = CONFIG.analysisSteps;
        if (currentStepIndex >= steps.length) {
            currentStepIndex = 0; // Loop back
        }
        
        const step = steps[currentStepIndex];
        const statusText = document.getElementById('analysis-status-text');
        const statusDot = document.getElementById('analysis-status-dot');
        
        if (statusText) {
            // Fade out, update, fade in
            statusText.style.opacity = '0';
            setTimeout(() => {
                statusText.textContent = step.label;
                statusText.style.opacity = '1';
            }, 150);
        }
        
        // Update dot color based on step
        if (statusDot) {
            statusDot.className = `analysis-status-dot step-${step.id}`;
        }
        
        currentStepIndex++;
    }
    
    // Initial update
    updateStep();
    
    // Cycle through steps every 1.5 seconds
    analysisAnimationInterval = setInterval(updateStep, 1500);
}

function stopAnalysisAnimation() {
    if (analysisAnimationInterval) {
        clearInterval(analysisAnimationInterval);
        analysisAnimationInterval = null;
    }
    
    const statusContainer = document.getElementById('analysis-status');
    if (statusContainer) {
        statusContainer.classList.add('hidden');
    }
    currentStepIndex = 0;
}

// ============================================
// Batch Form Submission & Processing
// ============================================

async function handleFormSubmit(event) {
    if (event) event.preventDefault();
    
    if (uploadedFiles.length === 0) {
        showToast('Please add images to the queue', 'error');
        return;
    }
    
    // Get form data
    const formData = {
        brandId: document.getElementById('brand-select').value,
        designType: document.getElementById('design-type-select')?.value || 'social-media',
        submittedBy: document.getElementById('email-input')?.value || 'reviewer@bayer.com',
        notes: document.getElementById('notes-input')?.value || ''
    };
    
    // Start batch processing
    isProcessing = true;
    currentFileIndex = 0;
    batchResults = [];
    
    // Show loading state and start animation
    setLoadingState(true);
    startAnalysisAnimation();
    
    // Show results section
    elements.resultsSection.classList.remove('hidden');
    elements.uploadSection.classList.add('hidden');
    
    // Initialize results UI
    initBatchResultsUI();
    
    // Process files sequentially
    for (let i = 0; i < uploadedFiles.length; i++) {
        currentFileIndex = i;
        const fileObj = uploadedFiles[i];
        
        // Update progress
        updateProgress(i + 1, uploadedFiles.length);
        
        // Update file status
        fileObj.status = 'processing';
        updateQueueUI();
        addProcessingCard(fileObj);
        
        try {
            const result = await analyzeImage(fileObj, formData);
            fileObj.status = 'done';
            fileObj.results = result;
            batchResults.push({ ...fileObj, ...result });
            updateResultCard(fileObj.id, result);
        } catch (error) {
            console.error(`Error processing ${fileObj.name}:`, error);
            fileObj.status = 'error';
            fileObj.results = { error: error.message };
            updateResultCard(fileObj.id, { error: error.message });
        }
        
        updateQueueUI();
        updateBatchStats();
    }
    
    // Finished
    isProcessing = false;
    setLoadingState(false);
    stopAnalysisAnimation();
    showToast(`Batch complete: ${uploadedFiles.length} designs analyzed`, 'success');
    
    // Reset chat for new batch
    chatHistory = [];
    conversationForExport = [];
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
    
    // Auto-generate summary
    setTimeout(() => {
        generateAutoSummary();
    }, 500);
}

function updateProgress(current, total) {
    const progressText = document.getElementById('progress-text');
    if (progressText) {
        progressText.textContent = `Analyzing ${current}/${total}...`;
    }
}

async function analyzeImage(fileObj, formData) {
    // Build a short query - the system prompt on the server already has all the rules
    const agentQuery = `Analyze this design for ${formData.brandId} brand compliance. Design type: ${formData.designType}.${formData.notes ? ` Notes: ${formData.notes}` : ''} Return JSON only.

Image: data:${fileObj.mimeType};base64,${fileObj.base64}`;

    const payload = {
        agentId: CONFIG.agentId,
        query: agentQuery,
        endpoint: CONFIG.foundryEndpoint,
        azureOpenaiEndpoint: CONFIG.azureOpenaiEndpoint,
        azureOpenaiDeployment: CONFIG.azureOpenaiDeployment
    };
    
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/foundry-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Analysis failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the response - it may be a string that needs JSON parsing
    let result = data.response;
    if (typeof result === 'string') {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                result = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error('JSON parse error:', e);
                result = { complianceScore: 0, status: 'ERROR', summary: 'Failed to parse response', violations: [] };
            }
        }
    }
    
    // Normalize: ensure complianceScore exists (server may return "score" or "complianceScore")
    if (result.score !== undefined && result.complianceScore === undefined) {
        result.complianceScore = result.score;
    }
    if (result.complianceScore === undefined) {
        result.complianceScore = 0;
    }
    
    // Ensure arrays exist
    result.violations = result.violations || [];
    result.warnings = result.warnings || [];
    result.recommendations = result.recommendations || [];
    
    return result;
}

// ============================================
// Batch Results UI
// ============================================

function initBatchResultsUI() {
    if (elements.batchResults) {
        elements.batchResults.innerHTML = '';
    }
    updateBatchStats();
}

function addProcessingCard(fileObj) {
    if (!elements.batchResults) return;
    
    const card = document.createElement('div');
    card.className = 'result-card processing';
    card.id = `result-${fileObj.id}`;
    card.innerHTML = `
        <div class="result-card-header">
            <img src="${fileObj.preview}" alt="${fileObj.name}" class="result-thumb">
            <div class="result-meta">
                <div class="result-filename">${fileObj.name}</div>
                <div class="result-status-row">
                    <span class="result-badge">Analyzing</span>
                    <div class="result-spinner"></div>
                </div>
            </div>
        </div>
        <div class="result-summary">Analyzing design for brand compliance...</div>
    `;
    elements.batchResults.appendChild(card);
}

function updateResultCard(fileId, result) {
    const card = document.getElementById(`result-${fileId}`);
    if (!card) return;
    
    const fileObj = uploadedFiles.find(f => f.id === fileId);
    if (!fileObj) return;
    
    // Determine status
    let status = 'pass';
    let statusLabel = 'Approved';
    const score = result.complianceScore || 0;
    
    if (result.error) {
        status = 'fail';
        statusLabel = 'Error';
    } else if (score < 70) {
        status = 'fail';
        statusLabel = 'Not Approved';
    } else if (score < 80) {
        status = 'warning';
        statusLabel = 'Needs Review';
    }
    
    card.className = `result-card status-${status}`;
    card.onclick = () => openResultModal(fileId);
    
    // Generate brief summary
    const summary = generateBriefSummary(result);
    
    card.innerHTML = `
        <div class="result-card-header">
            <img src="${fileObj.preview}" alt="${fileObj.name}" class="result-thumb">
            <div class="result-meta">
                <div class="result-filename">${fileObj.name}</div>
                <div class="result-status-row">
                    <span class="result-badge">${statusLabel}</span>
                    ${!result.error ? `<span class="result-score">${score}%</span>` : ''}
                </div>
            </div>
        </div>
        <div class="result-summary">${summary}</div>
    `;
}

function generateBriefSummary(result) {
    if (result.error) {
        return `Analysis failed: ${result.error}`;
    }
    
    const violations = result.violations?.length || 0;
    const warnings = result.warnings?.length || 0;
    
    if (violations === 0 && warnings === 0) {
        return 'Design meets all brand guidelines.';
    }
    
    const parts = [];
    if (violations > 0) {
        parts.push(`${violations} violation${violations !== 1 ? 's' : ''}`);
    }
    if (warnings > 0) {
        parts.push(`${warnings} warning${warnings !== 1 ? 's' : ''}`);
    }
    
    // Include first issue if available
    const firstIssue = result.violations?.[0]?.title || result.warnings?.[0]?.title;
    if (firstIssue) {
        return `${parts.join(', ')}: ${firstIssue}`;
    }
    
    return `Found ${parts.join(' and ')}.`;
}

function updateBatchStats() {
    const total = uploadedFiles.length;
    const completed = uploadedFiles.filter(f => f.status === 'done' || f.status === 'error').length;
    const passed = uploadedFiles.filter(f => f.results && !f.results.error && (f.results.complianceScore || 0) >= 80).length;
    const warnings = uploadedFiles.filter(f => f.results && !f.results.error && (f.results.complianceScore || 0) >= 70 && (f.results.complianceScore || 0) < 80).length;
    const failed = uploadedFiles.filter(f => f.results && (f.results.error || (f.results.complianceScore || 0) < 70)).length;
    
    // Update the results count in the collapsible section
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        resultsCount.textContent = `${total} design${total !== 1 ? 's' : ''}`;
    }
}

// ============================================
// Result Modal
// ============================================

function openResultModal(fileId) {
    const fileObj = uploadedFiles.find(f => f.id === fileId);
    if (!fileObj || !fileObj.results) return;
    
    const modal = document.getElementById('result-modal');
    const result = fileObj.results;
    
    // Populate modal
    document.getElementById('modal-filename').textContent = fileObj.name;
    document.getElementById('modal-image').src = fileObj.preview;
    document.getElementById('modal-summary').textContent = result.summary || 'No summary available.';
    
    // Score and status
    const score = result.complianceScore || 0;
    let status = 'pass';
    let statusLabel = 'Approved';
    
    if (result.error) {
        status = 'fail';
        statusLabel = 'Error';
    } else if (score < 70) {
        status = 'fail';
        statusLabel = 'Not Approved';
    } else if (score < 80) {
        status = 'warning';
        statusLabel = 'Needs Review';
    }
    
    const statusPill = document.getElementById('modal-status');
    statusPill.className = `status-pill status-${status}`;
    statusPill.querySelector('.status-text').textContent = statusLabel;
    
    document.getElementById('modal-score').textContent = score;
    
    // Populate findings
    populateModalFindings('modal-violations', result.violations || []);
    populateModalFindings('modal-warnings', result.warnings || []);
    populateModalFindings('modal-recommendations', result.recommendations || []);
    
    // Show modal
    modal.classList.remove('hidden');
}

function populateModalFindings(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = '<li class="empty">None</li>';
    } else {
        container.innerHTML = items.map(item => {
            const text = typeof item === 'string' ? item : (item.title || item.message || 'Issue');
            return `<li>${text}</li>`;
        }).join('');
    }
}

function closeModal() {
    const modal = document.getElementById('result-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ============================================
// Results Actions & AI Chat
// ============================================

// Chat history for conversation context
let chatHistory = [];

function setupResultsActions() {
    const newBatchBtn = document.getElementById('new-batch-btn');
    const sendMessageBtn = document.getElementById('send-message');
    const chatInput = document.getElementById('chat-input');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportEmailBtn = document.getElementById('export-email');
    const exportPptBtn = document.getElementById('export-ppt');
    
    if (newBatchBtn) newBatchBtn.addEventListener('click', startNewBatch);
    if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendChatMessage);
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => exportToPDF());
    if (exportEmailBtn) exportEmailBtn.addEventListener('click', () => exportToEmail());
    if (exportPptBtn) exportPptBtn.addEventListener('click', () => exportToPPT());
    
    // Enter to send (Shift+Enter for new line)
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        
        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });
    }
    
    // Quick prompt buttons
    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.value = prompt;
                chatInput.focus();
            }
        });
    });
}

// Store conversation for export
let conversationForExport = [];

async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput?.value?.trim();
    
    if (!message) return;
    
    if (batchResults.length === 0) {
        showToast('No results to discuss', 'warning');
        return;
    }
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Add user message to chat
    addChatMessage(message, 'user');
    chatHistory.push({ role: 'user', content: message });
    
    // Show loading indicator
    const loadingId = addLoadingMessage();
    
    try {
        const response = await callAIChat(message);
        
        // Remove loading and add AI response
        removeLoadingMessage(loadingId);
        addChatMessage(response, 'ai');
        chatHistory.push({ role: 'assistant', content: response });
        conversationForExport.push({ user: message, ai: response });
        
    } catch (error) {
        console.error('Chat error:', error);
        removeLoadingMessage(loadingId);
        addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
    }
}

function addChatMessage(content, type) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const avatar = type === 'ai' ? '✨' : '👤';
    const formattedContent = type === 'ai' ? formatAIResponse(content) : escapeHtml(content);
    
    const messageHtml = `
        <div class="chat-message ${type}">
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${formattedContent}</div>
        </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addLoadingMessage() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return null;
    
    const id = 'loading-' + Date.now();
    const loadingHtml = `
        <div id="${id}" class="chat-message ai">
            <div class="message-avatar">✨</div>
            <div class="message-content">
                <div class="message-loading">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', loadingHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

function removeLoadingMessage(id) {
    const loadingEl = document.getElementById(id);
    if (loadingEl) loadingEl.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function callAIChat(userMessage, detailedContext) {
    let resultsContext;
    if (detailedContext) {
        // Use provided detailed context (for auto-summary)
        resultsContext = detailedContext;
    } else {
        // Build compact context for follow-up chat
        resultsContext = batchResults.map(r => {
            const score = r.complianceScore || 0;
            const topViolation = r.violations?.[0]?.description || r.violations?.[0] || '';
            return `${r.name}: ${score}/100${topViolation ? ', ' + topViolation : ''}`;
        }).join('; ');
    }
    
    // Last 4 messages for conversation continuity
    const recentChat = chatHistory.slice(-4).map(msg => 
        `${msg.role === 'user' ? 'U' : 'A'}: ${msg.content}`
    ).join('\n');
    
    const aiQuery = `Batch results:\n${resultsContext}\n${recentChat ? recentChat + '\n' : ''}U: ${userMessage}`;

    const payload = {
        agentId: CONFIG.agentId,
        query: aiQuery,
        endpoint: CONFIG.foundryEndpoint,
        azureOpenaiEndpoint: CONFIG.azureOpenaiEndpoint,
        azureOpenaiDeployment: CONFIG.azureOpenaiDeployment
    };
    
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/foundry-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error('Failed to get AI response');
    }
    
    const data = await response.json();
    return data.response || 'No response generated';
}

async function generateAutoSummary() {
    // Build a client-side summary first (no AI call needed for basic stats)
    const total = batchResults.length;
    const passed = batchResults.filter(r => (r.complianceScore || 0) >= 80).length;
    const failed = batchResults.filter(r => (r.complianceScore || 0) < 70).length;
    const needsReview = total - passed - failed;
    
    // Show static summary immediately
    let staticSummary = `Reviewed ${total} design${total !== 1 ? 's' : ''}: `;
    const parts = [];
    if (passed > 0) parts.push(`${passed} approved`);
    if (needsReview > 0) parts.push(`${needsReview} needs review`);
    if (failed > 0) parts.push(`${failed} not approved`);
    staticSummary += parts.join(', ') + '.';
    
    addChatMessage(staticSummary, 'ai');
    
    // Build detailed per-design context for the AI
    const detailedContext = batchResults.map(r => {
        const score = r.complianceScore || 0;
        const status = score >= 80 ? 'Approved' : score >= 70 ? 'Needs Review' : 'Not Approved';
        const violations = (r.violations || []).map(v => typeof v === 'string' ? v : v.description || v.title || '').filter(Boolean);
        const warnings = (r.warnings || []).map(w => typeof w === 'string' ? w : w.description || w.title || '').filter(Boolean);
        const recs = (r.recommendations || []).filter(Boolean);
        let detail = `- ${r.name}: ${score}/100 (${status})`;
        if (violations.length) detail += `\n  Violations: ${violations.join('; ')}`;
        if (warnings.length) detail += `\n  Warnings: ${warnings.join('; ')}`;
        if (recs.length) detail += `\n  Recommendations: ${recs.join('; ')}`;
        return detail;
    }).join('\n');
    
    const loadingId = addLoadingMessage();
    
    try {
        const response = await callAIChat(
            `Give a brief review for each design (1-2 sentences each highlighting key issues or pass status), then end with an overall recommendation for the batch.`,
            detailedContext
        );
        
        removeLoadingMessage(loadingId);
        addChatMessage(response, 'ai');
        chatHistory.push({ role: 'assistant', content: response });
        conversationForExport.push({ user: '[Auto-summary]', ai: `${staticSummary}\n${response}` });
        
    } catch (error) {
        console.error('Auto-summary error:', error);
        removeLoadingMessage(loadingId);
        // Static summary already shown, so no need for error message
    }
}

function formatAIResponse(text) {
    // Convert markdown-like formatting to HTML
    let html = text
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h4>$1</h4>')
        .replace(/^# (.+)$/gm, '<h4>$1</h4>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Wrap in paragraphs
    html = '<p>' + html + '</p>';
    
    // Fix list items
    html = html.replace(/<\/li><br>/g, '</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul><ul>/g, '');
    
    return html;
}

function copyAIResponse() {
    if (!lastAIResponse) return;
    
    navigator.clipboard.writeText(lastAIResponse).then(() => {
        showToast('Copied to clipboard', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

function getConversationText() {
    // Build text from chat conversation
    return conversationForExport.map(conv => 
        `Q: ${conv.user}\n\nA: ${conv.ai}`
    ).join('\n\n---\n\n');
}

function exportToPDF() {
    if (batchResults.length === 0) {
        showToast('No results to export', 'warning');
        return;
    }
    
    // Fallback: create a printable HTML page
    const printWindow = window.open('', '_blank');
    const brandId = document.getElementById('brand-select').value;
    const conversationHtml = conversationForExport.map(conv => `
        <div class="conversation-item">
            <div class="user-msg"><strong>Question:</strong> ${escapeHtml(conv.user)}</div>
            <div class="ai-msg">${formatAIResponse(conv.ai)}</div>
        </div>
    `).join('');
    
    // Build design results with images
    const designResultsHtml = batchResults.map((r, i) => {
        const score = r.complianceScore || 0;
        const status = score >= 80 ? 'Approved' : score >= 70 ? 'Needs Review' : 'Not Approved';
        const statusClass = score >= 80 ? 'pass' : score >= 70 ? 'warning' : 'fail';
        const matchedFile = uploadedFiles.find(f => f.name === r.name);
        const imageData = matchedFile ? (matchedFile.base64 ? `data:${matchedFile.mimeType};base64,${matchedFile.base64}` : matchedFile.preview) : null;
        
        return `
            <div class="design-result">
                <h3>${i + 1}. ${r.name}</h3>
                <div class="design-content">
                    ${imageData ? `<div class="design-image"><img src="${imageData}" alt="${r.name}"></div>` : ''}
                    <div class="design-info">
                        <p><strong>Status:</strong> <span class="${statusClass}">${status}</span></p>
                        <p><strong>Score:</strong> ${score}/100</p>
                        ${r.summary ? `<p><strong>Summary:</strong> ${r.summary}</p>` : ''}
                        ${r.violations?.length > 0 ? `
                            <p><strong>Issues Found:</strong></p>
                            <ul>${r.violations.slice(0, 5).map(v => `<li>${v.title || v}</li>`).join('')}</ul>
                        ` : '<p class="pass">No issues found</p>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Design Review Report - ${getBrandName(brandId)}</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
                h1 { color: #FF6600; border-bottom: 2px solid #FF6600; padding-bottom: 10px; }
                h2 { color: #333; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
                h3 { color: #444; margin-top: 20px; }
                .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .meta { color: #666; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
                .pass { color: #10B981; font-weight: bold; }
                .warning { color: #F59E0B; font-weight: bold; }
                .fail { color: #EF4444; font-weight: bold; }
                ul { padding-left: 20px; }
                .conversation-item { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
                .user-msg { color: #666; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
                .ai-msg { color: #333; line-height: 1.6; }
                .design-result { margin: 25px 0; padding: 20px; background: #fafafa; border-radius: 8px; border: 1px solid #eee; page-break-inside: avoid; }
                .design-content { display: flex; gap: 20px; margin-top: 15px; }
                .design-image { flex: 0 0 200px; }
                .design-image img { max-width: 200px; max-height: 200px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }
                .design-info { flex: 1; }
                @media print { body { margin: 0; } .design-result { break-inside: avoid; } }
            </style>
        </head>
        <body>
            <h1>Design Review Report</h1>
            <div class="header">
                <div class="meta">
                    <p><strong>Brand:</strong> ${getBrandName(brandId)}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Total Designs:</strong> ${batchResults.length}</p>
                </div>
            </div>
            
            <h2>Design Results</h2>
            ${designResultsHtml}
            
            <h2>AI Analysis & Discussion</h2>
            ${conversationHtml || '<p>No AI conversation recorded.</p>'}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                Generated by OAD Design Reviewer • ${new Date().toLocaleString()}
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
    showToast('PDF ready to print', 'success');
}

function exportToEmail() {
    if (batchResults.length === 0) {
        showToast('No results to export', 'warning');
        return;
    }
    
    const brandId = document.getElementById('brand-select').value;
    const brandName = getBrandName(brandId);
    const date = new Date().toLocaleDateString();
    const conversationText = getConversationText();
    
    const passed = batchResults.filter(r => (r.complianceScore || 0) >= 80).length;
    const needsReview = batchResults.filter(r => (r.complianceScore || 0) >= 70 && (r.complianceScore || 0) < 80).length;
    const failed = batchResults.filter(r => (r.complianceScore || 0) < 70).length;
    
    // Build per-design HTML rows with images
    const designRows = batchResults.map(r => {
        const score = r.complianceScore || 0;
        const statusLabel = score >= 80 ? 'Approved' : score >= 70 ? 'Needs Review' : 'Not Approved';
        const statusColor = score >= 80 ? '#10B981' : score >= 70 ? '#F59E0B' : '#EF4444';
        const violations = (r.violations || []).map(v => typeof v === 'string' ? v : v.description || '').filter(Boolean);
        const warnings = (r.warnings || []).map(w => typeof w === 'string' ? w : w.description || '').filter(Boolean);
        const imgSrc = r.preview || '';
        
        let issuesHtml = '';
        if (violations.length) {
            issuesHtml += violations.map(v => `<div style="color:#EF4444;font-size:13px;">• ${v}</div>`).join('');
        }
        if (warnings.length) {
            issuesHtml += warnings.map(w => `<div style="color:#F59E0B;font-size:13px;">• ${w}</div>`).join('');
        }
        if (!issuesHtml) {
            issuesHtml = '<div style="color:#10B981;font-size:13px;">No issues found</div>';
        }
        
        return `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px;vertical-align:top;width:120px;">
                    ${imgSrc ? `<img src="${imgSrc}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid #ddd;" />` : '<div style="width:100px;height:100px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;">No preview</div>'}
                </td>
                <td style="padding:12px;vertical-align:top;">
                    <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${r.name}</div>
                    <div style="margin-bottom:6px;">
                        <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;color:white;background:${statusColor};">${statusLabel}</span>
                        <span style="margin-left:8px;font-size:14px;font-weight:600;">${score}/100</span>
                    </div>
                    ${issuesHtml}
                </td>
            </tr>`;
    }).join('');
    
    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Design Review Report</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#333;">
    <div style="background:linear-gradient(135deg,#FF6600,#E55A00);padding:24px;border-radius:12px;color:white;margin-bottom:24px;">
        <h1 style="margin:0;font-size:22px;">Design Review Report</h1>
        <div style="opacity:0.9;margin-top:4px;">${brandName} — ${date}</div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#D1FAE5;padding:14px;border-radius:10px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#10B981;">${passed}</div>
            <div style="font-size:12px;color:#065F46;">Approved</div>
        </div>
        <div style="flex:1;background:#FEF3C7;padding:14px;border-radius:10px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#F59E0B;">${needsReview}</div>
            <div style="font-size:12px;color:#92400E;">Needs Review</div>
        </div>
        <div style="flex:1;background:#FEE2E2;padding:14px;border-radius:10px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#EF4444;">${failed}</div>
            <div style="font-size:12px;color:#991B1B;">Not Approved</div>
        </div>
    </div>

    <h2 style="font-size:16px;margin-bottom:12px;border-bottom:2px solid #FF6600;padding-bottom:6px;">Design Results</h2>
    <table style="width:100%;border-collapse:collapse;">
        ${designRows}
    </table>

    ${conversationText ? `
    <h2 style="font-size:16px;margin-top:24px;margin-bottom:12px;border-bottom:2px solid #FF6600;padding-bottom:6px;">AI Analysis</h2>
    <div style="background:#f9f9f9;padding:16px;border-radius:10px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${conversationText}</div>
    ` : ''}

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
        Generated by OAD Design Reviewer
    </div>
</body>
</html>`;

    // Open in a new window so user can copy or use browser email
    const emailWindow = window.open('', '_blank');
    emailWindow.document.write(emailHtml);
    emailWindow.document.close();
    
    // Add a copy/send toolbar at the top
    const toolbar = emailWindow.document.createElement('div');
    toolbar.style.cssText = 'position:sticky;top:0;background:#333;padding:10px 20px;display:flex;gap:10px;align-items:center;z-index:100;font-family:sans-serif;';
    toolbar.innerHTML = `
        <button onclick="document.querySelector('body > div:first-child').style.display='none'; window.print();" style="padding:8px 16px;background:#FF6600;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Print / Save PDF</button>
        <button id="copyBtn" style="padding:8px 16px;background:#3B82F6;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Copy to Clipboard</button>
        <button onclick="window.location.href='mailto:?subject=${encodeURIComponent(`Design Review Report - ${brandName} - ${date}`)}&body=${encodeURIComponent('Please see the attached design review report.')}'" style="padding:8px 16px;background:#10B981;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Open in Email Client</button>
        <span style="color:#aaa;font-size:13px;margin-left:auto;">Select all (Ctrl+A) → Copy → Paste into email to include images</span>
    `;
    emailWindow.document.body.insertBefore(toolbar, emailWindow.document.body.firstChild);
    
    // Copy button handler
    emailWindow.document.getElementById('copyBtn').addEventListener('click', () => {
        const range = emailWindow.document.createRange();
        range.selectNodeContents(emailWindow.document.body);
        // Exclude the toolbar from selection
        range.setStartAfter(toolbar);
        const sel = emailWindow.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        emailWindow.document.execCommand('copy');
        sel.removeAllRanges();
        emailWindow.document.getElementById('copyBtn').textContent = 'Copied!';
        setTimeout(() => emailWindow.document.getElementById('copyBtn').textContent = 'Copy to Clipboard', 2000);
    });
    
    showToast('Email report generated with images', 'success');
}

async function exportToPPT() {
    if (batchResults.length === 0) {
        showToast('No results to export', 'warning');
        return;
    }
    
    // Check if PptxGenJS is available
    if (typeof PptxGenJS === 'undefined') {
        // Load from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
        script.onload = () => createPPT();
        document.head.appendChild(script);
        return;
    }
    createPPT();
}

function createPPT() {
    const pptx = new PptxGenJS();
    const brandId = document.getElementById('brand-select').value;
    
    pptx.title = `Design Review Report - ${getBrandName(brandId)}`;
    pptx.author = 'OAD Design Reviewer';
    
    // Title slide
    let slide = pptx.addSlide();
    slide.addText('Design Review Report', { x: 0.5, y: 2, w: '90%', h: 1, fontSize: 36, bold: true, color: 'FF6600' });
    slide.addText(`Brand: ${getBrandName(brandId)}`, { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: '666666' });
    slide.addText(`Date: ${new Date().toLocaleDateString()}`, { x: 0.5, y: 3.7, w: '90%', fontSize: 14, color: '999999' });
    slide.addText(`${batchResults.length} Designs Reviewed`, { x: 0.5, y: 4.2, w: '90%', fontSize: 14, color: '999999' });
    
    // Summary slide
    slide = pptx.addSlide();
    slide.addText('Results Summary', { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '333333' });
    
    const passed = batchResults.filter(r => (r.complianceScore || 0) >= 80).length;
    const warnings = batchResults.filter(r => (r.complianceScore || 0) >= 70 && (r.complianceScore || 0) < 80).length;
    const failed = batchResults.filter(r => (r.complianceScore || 0) < 70).length;
    
    const tableData = [
        [{ text: 'Status', options: { bold: true, fill: 'f5f5f5' } }, { text: 'Count', options: { bold: true, fill: 'f5f5f5' } }],
        ['✅ Approved', String(passed)],
        ['⚠️ Needs Review', String(warnings)],
        ['❌ Not Approved', String(failed)]
    ];
    
    slide.addTable(tableData, { x: 0.5, y: 1.2, w: 4, fontSize: 14, border: { pt: 1, color: 'cccccc' } });
    
    // Individual results slides with images (up to 10)
    batchResults.slice(0, 10).forEach((result, i) => {
        slide = pptx.addSlide();
        const score = result.complianceScore || 0;
        const status = score >= 80 ? 'Approved' : score >= 70 ? 'Needs Review' : 'Not Approved';
        const statusColor = score >= 80 ? '10B981' : score >= 70 ? 'F59E0B' : 'EF4444';
        
        slide.addText(result.name, { x: 0.5, y: 0.3, w: '90%', fontSize: 18, bold: true, color: '333333' });
        slide.addText(`${status} • Score: ${score}/100`, { x: 0.5, y: 0.7, w: '90%', fontSize: 12, color: statusColor });
        
        // Try to add image
        const matchedFile = uploadedFiles.find(f => f.name === result.name);
        if (matchedFile) {
            const imageData = matchedFile.base64 ? `data:${matchedFile.mimeType};base64,${matchedFile.base64}` : matchedFile.preview;
            if (imageData) {
                try {
                    slide.addImage({ 
                        data: imageData, 
                        x: 0.5, 
                        y: 1.1, 
                        w: 3, 
                        h: 3,
                        sizing: { type: 'contain', w: 3, h: 3 }
                    });
                } catch (e) {
                    console.warn('Could not add image to PPT:', e);
                }
            }
        }
        
        // Add text content on the right
        const textX = 4;
        const textW = 5.5;
        
        if (result.summary) {
            slide.addText(result.summary, { x: textX, y: 1.1, w: textW, fontSize: 11, color: '666666' });
        }
        
        // Add violations if any
        if (result.violations?.length > 0) {
            slide.addText('Issues:', { x: textX, y: 2.5, fontSize: 12, bold: true, color: 'EF4444' });
            const violations = result.violations.slice(0, 4).map(v => `• ${v.title || v}`).join('\n');
            slide.addText(violations, { x: textX, y: 2.9, w: textW, fontSize: 10, color: '666666' });
        } else {
            slide.addText('✓ No issues found', { x: textX, y: 2.5, fontSize: 12, color: '10B981' });
        }
    });
    
    // AI Analysis slide
    slide = pptx.addSlide();
    slide.addText('AI Analysis Summary', { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '333333' });
    
    // Use conversation text for PPT
    const conversationText = getConversationText();
    const aiSummary = conversationText.length > 1500 ? conversationText.substring(0, 1500) + '...' : conversationText;
    slide.addText(aiSummary || 'No AI conversation recorded.', { x: 0.5, y: 1.2, w: 9, h: 4, fontSize: 11, color: '666666', valign: 'top' });
    
    pptx.writeFile({ fileName: `design-review-report-${Date.now()}.pptx` });
    showToast('PowerPoint exported successfully', 'success');
}

function startNewBatch() {
    // Reset state
    uploadedFiles = [];
    batchResults = [];
    isProcessing = false;
    currentFileIndex = 0;
    chatHistory = [];
    conversationForExport = [];
    
    // Reset UI
    elements.resultsSection.classList.add('hidden');
    elements.uploadSection.classList.remove('hidden');
    elements.fileUpload.value = '';
    updateQueueUI();
    
    if (elements.batchResults) {
        elements.batchResults.innerHTML = '';
    }
    
    // Clear chat messages
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
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
    console.log('Mock results loaded:', mockResults);
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
    
    // Setup sidebar toggle
    setupSidebarToggle();
}

function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const main = document.querySelector('.main');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            if (main) {
                main.classList.toggle('sidebar-collapsed');
            }
        });
    }
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


// For debugging - expose to console
window.brandReviewApp = {
    loadMockResults,
    CONFIG,
    brandRulesData: () => brandRulesData
};
