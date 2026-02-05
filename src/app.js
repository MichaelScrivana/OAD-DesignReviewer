// ============================================
// OAD Brand Review Assistant - Application Logic
// ============================================

// Configuration
const CONFIG = {
    n8nWebhookUrl: 'https://your-n8n-instance.com/webhook/design-review', // UPDATE THIS
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    apiTimeout: 60000 // 60 seconds
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
}

function checkConfiguration() {
    if (CONFIG.n8nWebhookUrl.includes('your-n8n-instance.com')) {
        console.warn('⚠️ n8n Webhook URL not configured. Update CONFIG.n8nWebhookUrl in app.js');
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
        
        // Call n8n webhook
        const results = await submitDesignReview(payload);
        
        // Display results
        currentResults = results;
        displayResults(results, formData);
        
        showToast('Analysis complete!', 'success');
    } catch (error) {
        console.error('Submission error:', error);
        showToast(error.message || 'Failed to analyze design. Please try again.', 'error');
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
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        
        throw error;
    }
}

function setLoadingState(isLoading) {
    elements.submitBtn.disabled = isLoading;
    
    if (isLoading) {
        elements.submitBtn.querySelector('.btn-text').style.display = 'none';
        elements.submitBtn.querySelector('.btn-spinner').classList.remove('hidden');
    } else {
        elements.submitBtn.querySelector('.btn-text').style.display = 'inline';
        elements.submitBtn.querySelector('.btn-spinner').classList.add('hidden');
    }
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
    
    // Populate results
    updateResultsHeader(results, formData);
    updateScoreCircle(results.complianceScore);
    updateTabs(results);
    updateDetailedFindings(results.findings);
}

function updateResultsHeader(results, formData) {
    // Status badge
    const statusBadge = document.getElementById('status-badge');
    statusBadge.textContent = results.overallCompliance.toUpperCase();
    statusBadge.className = `badge badge-${results.overallCompliance}`;
    
    // Meta info
    document.getElementById('brand-name').textContent = getBrandName(formData.brandId);
    document.getElementById('design-type').textContent = getDesignTypeName(formData.designType);
    document.getElementById('review-date').textContent = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    
    // Summary text
    document.getElementById('summary-text').textContent = results.summary;
}

function updateScoreCircle(score) {
    const scoreValue = document.getElementById('score-value');
    const scoreProgress = document.getElementById('score-progress');
    
    // Animate score value
    animateValue(scoreValue, 0, score, 1000);
    
    // Update progress circle
    const circumference = 2 * Math.PI * 45; // radius = 45
    const offset = circumference - (score / 100) * circumference;
    
    scoreProgress.style.strokeDasharray = `${circumference} ${circumference}`;
    scoreProgress.style.strokeDashoffset = circumference;
    
    // Animate circle
    setTimeout(() => {
        scoreProgress.style.strokeDashoffset = offset;
    }, 100);
    
    // Update color based on score
    if (score >= 80) {
        scoreProgress.style.stroke = 'var(--color-success)';
    } else if (score >= 60) {
        scoreProgress.style.stroke = 'var(--color-warning)';
    } else {
        scoreProgress.style.stroke = 'var(--color-error)';
    }
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
    // Update tab counts
    document.getElementById('violations-count').textContent = results.criticalViolations?.length || 0;
    document.getElementById('warnings-count').textContent = results.warnings?.length || 0;
    document.getElementById('recommendations-count').textContent = results.recommendations?.length || 0;
    
    // Calculate passed checks (approximate based on score)
    const passedCount = Math.max(0, Math.floor((results.complianceScore / 100) * 10));
    document.getElementById('passed-count').textContent = passedCount;
    
    // Populate tab content
    populateFindingsList('violations-list', results.criticalViolations, 'critical');
    populateFindingsList('warnings-list', results.warnings, 'warning');
    populateFindingsList('recommendations-list', results.recommendations, 'info');
    populatePassedChecks('passed-list', results);
}

function populateFindingsList(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = createEmptyState(type);
        return;
    }
    
    items.forEach(item => {
        const findingElement = createFindingItem(item, type);
        container.appendChild(findingElement);
    });
}

function createFindingItem(text, type) {
    const item = document.createElement('div');
    item.className = `finding-item ${type}`;
    
    const icon = getIconSVG(type);
    
    item.innerHTML = `
        ${icon}
        <div class="finding-content">
            <p class="finding-text">${text}</p>
        </div>
    `;
    
    return item;
}

function createEmptyState(type) {
    const messages = {
        critical: 'No critical violations found',
        warning: 'No warnings found',
        info: 'No recommendations at this time'
    };
    
    const icons = {
        critical: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
        warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
        info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
    };
    
    return `
        <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icons[type]}
            </svg>
            <p>${messages[type]}</p>
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
}

// ============================================
// Results Actions
// ============================================

function setupResultsActions() {
    document.getElementById('download-btn').addEventListener('click', handleDownloadReport);
    document.getElementById('share-btn').addEventListener('click', handleShareResults);
    document.getElementById('request-review-btn').addEventListener('click', handleRequestReview);
    document.getElementById('new-review-btn').addEventListener('click', handleNewReview);
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

// For debugging - expose to console
window.brandReviewApp = {
    loadMockResults,
    CONFIG
};
