# User Guide

## Welcome to OAD Brand Review Assistant! 🎨

This guide will help you use the AI-powered brand compliance checker to ensure your designs meet One A Day (OAD) brand standards.

---

## Getting Started

### What You'll Need

- ✅ A design file (PNG, JPG, or SVG format)
- ✅ Maximum file size: 10MB
- ✅ Your email address
- ✅ Internet connection

### Supported Design Types

- **Social Media Posts** (Instagram, Facebook, Twitter, LinkedIn)
- **Digital Banner Ads** (Leaderboard, skyscraper, rectangles)
- **Email Marketing** (Newsletters, promotional emails)
- **Print Advertisements** (Magazines, brochures, posters)
- **Product Packaging** (Labels, boxes, bottles)
- **Website Assets** (Hero images, product tiles)
- **Presentation Slides** (PowerPoint, Keynote)

---

## Step-by-Step Instructions

### Step 1: Navigate to the Web App

Open your browser and go to:
```
https://your-deployed-url.com
```

You'll see the **OAD Brand Review Assistant** homepage with an upload form.

### Step 2: Select Your Brand

1. Click the **"Brand"** dropdown
2. Select **"One A Day"** (or other supported brand)

**Available Brands**:
- One A Day (OAD)
- Claritin
- Aleve
- Bayer Aspirin
- Citracal

### Step 3: Choose Design Type

1. Click the **"Design Type"** dropdown
2. Select the category that matches your design

**Examples**:
- Creating an Instagram post? → Select **"Social Media Post"**
- Designing a banner ad? → Select **"Digital Banner Ad"**
- Working on email template? → Select **"Email Marketing"**

### Step 4: Upload Your Design

#### Option A: Drag and Drop

1. Drag your image file from your computer
2. Drop it into the **upload zone** (the dashed box)

#### Option B: Click to Upload

1. Click anywhere in the **upload zone**
2. Browse and select your file
3. Click **"Open"**

**Accepted Formats**:
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- SVG (`.svg`)

**File Size Limit**: 10MB

### Step 5: Enter Your Email

1. Type your email address in the **"Your Email"** field
2. Example: `designer@bayer.com`

This helps the brand team contact you if they have questions.

### Step 6: Add Notes (Optional)

If you want to provide context about your design:
1. Click in the **"Notes"** text area
2. Type any relevant information

**Examples**:
- "This is the final version for Q1 campaign"
- "Updated based on feedback from last review"
- "Using new logo variation - please verify"

### Step 7: Submit for Review

1. Click the **"Analyze Design"** button
2. Wait 10-30 seconds while AI analyzes your design
3. Progress indicator will show "Analyzing..."

**What Happens Next**:
- Your image is sent to the AI analysis engine
- Brand guidelines are fetched automatically
- AI checks logo, colors, typography, and accessibility
- Compliance report is generated

---

## Understanding Your Results

### Overall Status Badge

At the top of your results, you'll see one of three status badges:

| Badge | Meaning | Action Required |
|-------|---------|-----------------|
| **PASS** 🟢 | Design meets brand guidelines | Proceed with design |
| **NEEDS REVIEW** 🟡 | Minor issues detected | Review warnings, may proceed |
| **FAIL** 🔴 | Critical violations found | Fix violations before approval |

### Compliance Score

A score from **0-100** indicating overall compliance:

- **85-100**: Excellent - meets all standards
- **70-84**: Good - minor improvements needed
- **60-69**: Fair - several issues to address
- **0-59**: Poor - significant work required

### Report Sections

#### 1. Critical Violations Tab ⚠️

Issues that **must be fixed** before brand approval.

**Examples**:
- Logo clearspace insufficient (10px detected, 20px required)
- Unapproved color #0000FF detected
- Logo is stretched or distorted

**What to Do**:
- Address all critical violations
- Re-submit design after fixes

#### 2. Warnings Tab ⚠️

Issues that **should be reviewed** but may not block approval.

**Examples**:
- Font may not be Helvetica Neue - please verify
- Text size is small (12px) - consider increasing to 14px
- Contrast ratio is 4.3:1 - slightly below recommended 4.5:1

**What to Do**:
- Review each warning
- Make changes if feasible
- Document reasons if warnings can't be addressed

#### 3. Passed Checks Tab ✅

Design elements that meet brand guidelines.

**Examples**:
- Logo is present in the design
- Primary brand color (#FF6600) is used correctly
- Contrast ratio meets WCAG AA standards

**Why This Matters**:
- Confirms what you're doing right
- Provides positive reinforcement
- Helps identify best practices

#### 4. Recommendations Tab 💡

Actionable suggestions to improve your design.

**Examples**:
- Increase logo clearspace to 20px minimum
- Replace #0000FF with approved brand color #3B82F6
- Consider using Helvetica Neue Bold for headings

**What to Do**:
- Review recommendations
- Implement where appropriate
- Use as learning opportunities

### Detailed Analysis Accordions

Click to expand any section for deeper insights:

#### Logo Usage 🖼️

- **Present**: Is the logo visible?
- **Width/Height**: Estimated dimensions
- **Clear Space**: Adequate whitespace around logo?
- **Issues**: Specific problems (stretching, rotation, effects)

#### Color Palette 🎨

- **Detected Colors**: All colors found in the design (with hex codes)
- **Color Swatches**: Visual preview with approval status (✅/❌)
- **Unapproved Colors**: Colors not in brand palette

**How to Fix**:
- Identify unapproved colors (marked with ❌)
- Replace with approved alternatives:
  - Primary: `#FF6600`
  - Secondary: `#333333`
  - Accent: `#F5F5F5`
  - Neutral: `#FFFFFF`, `#000000`

#### Typography 📝

- **Detected Fonts**: Fonts identified in the design
- **Font Approved**: Is the font in the approved list?
- **Issues**: Font-related violations

**Approved Fonts**:
- Helvetica Neue (all weights: 400, 500, 700)
- Helvetica (fallback)
- Arial (fallback)

#### Accessibility ♿

- **Contrast Ratio**: WCAG AA compliance (4.5:1 minimum)
- **Text Size**: Readability check (14px minimum for body text)
- **Issues**: Accessibility-related problems

**Why This Matters**:
- Ensures designs are readable for all users
- Meets legal accessibility requirements
- Improves user experience

---

## Taking Action on Your Results

### Option 1: Download Report

1. Click **"Download Report"** button
2. Saves as `brand-compliance-report-[timestamp].md`
3. Share with team or attach to review requests

**Use Cases**:
- Documentation for design reviews
- Archive for future reference
- Share with stakeholders

### Option 2: Share Results

1. Click **"Share Results"** button
2. On mobile: Opens native share sheet
3. On desktop: Copies URL to clipboard

**Share With**:
- Brand team
- Design colleagues
- Project managers

### Option 3: Request Human Review

If AI results are unclear or you need brand team approval:

1. Click **"Request Human Review"** button
2. Opens email client with pre-filled template
3. Add design file as attachment
4. Send to brand team

**Email Template Includes**:
- Compliance score
- Number of violations/warnings
- Your contact information

### Option 4: Start New Review

When you're ready to check another design:

1. Click **"Start New Review"** button
2. Form resets to initial state
3. Upload new design and repeat process

---

## Tips for Best Results

### Before Uploading

✅ **Export at correct dimensions**:
- Social media: Use platform-specific sizes (1080x1080px for Instagram)
- Banners: Match ad placement dimensions
- Print: Ensure 300 DPI resolution

✅ **Use web-friendly formats**:
- PNG for logos and graphics with transparency
- JPG for photos and complex images
- SVG for vector graphics (if supported)

✅ **Check file size**:
- Optimize images before upload (use tools like TinyPNG)
- Stay under 10MB limit

### Interpreting AI Results

⚠️ **AI is a helper, not a replacement**:
- Use AI results as a **first pass screening**
- Always get **human brand team approval** for final sign-off
- AI may miss nuanced brand guidelines

⚠️ **Common AI Limitations**:
- **Font Detection**: Not 100% accurate (verify manually)
- **Measurements**: Estimates only (use design tools for precision)
- **Context**: AI doesn't understand campaign context

### Fixing Common Issues

#### "Logo clearspace insufficient"

**Problem**: Logo has less than 20px of whitespace around it

**Solution**:
1. Open design in editing tool
2. Add margin/padding around logo
3. Ensure 20px minimum on all sides
4. Re-export and re-submit

#### "Unapproved color detected"

**Problem**: Using colors not in brand palette

**Solution**:
1. Identify the unapproved color (check color swatches in report)
2. Replace with closest approved color:
   - Need an orange? Use `#FF6600`
   - Need a dark gray? Use `#333333`
   - Need a light background? Use `#F5F5F5`
3. Re-export and re-submit

#### "Font may not be Helvetica Neue"

**Problem**: AI detects a font that looks different from Helvetica Neue

**Solution**:
1. Verify font in design tool (Illustrator, Figma, etc.)
2. If incorrect, change to Helvetica Neue
3. If already correct, note this in "Notes" field when re-submitting

#### "Text size below minimum"

**Problem**: Body text smaller than 14px

**Solution**:
1. Identify small text (usually disclaimers or captions)
2. Increase to 14px minimum (or 12px for legal text only)
3. Adjust layout if needed
4. Re-export and re-submit

#### "Contrast ratio fails WCAG AA"

**Problem**: Text color doesn't have enough contrast with background

**Solution**:
1. Use contrast checker tool (e.g., WebAIM Contrast Checker)
2. Adjust text color or background color to achieve 4.5:1 ratio
3. Example: White text on `#FF6600` background has 3.1:1 ratio (fail)
   - Solution: Use white text on `#E55A00` (darker orange)
4. Re-export and re-submit

---

## Frequently Asked Questions

### General Questions

**Q: How long does analysis take?**  
A: Typically 10-30 seconds, depending on image complexity and server load.

**Q: Is my design stored permanently?**  
A: No. Images are analyzed and then deleted. Only compliance reports are saved for audit purposes.

**Q: Can I upload multiple designs at once?**  
A: Not currently. Submit designs one at a time. (Batch processing planned for Phase 2)

**Q: What if I disagree with the AI's assessment?**  
A: Click "Request Human Review" to escalate to the brand team. Provide context in your notes.

### Technical Questions

**Q: Why is my upload failing?**  
A: Check that:
- File is under 10MB
- File format is PNG, JPG, or SVG
- You have a stable internet connection

**Q: Why am I getting a "timeout" error?**  
A: The analysis is taking too long (>60 seconds). Try:
- Uploading a smaller file size
- Simplifying your design
- Trying again later (server may be busy)

**Q: Can I use this on mobile?**  
A: Yes! The web app is fully responsive and works on smartphones and tablets.

### Brand Guidelines Questions

**Q: Where can I find the full brand guidelines?**  
A: Contact the brand team at brand-team@bayer.com or visit the brand portal.

**Q: What if my brand isn't listed?**  
A: Currently supports OAD, Claritin, Aleve, Bayer Aspirin, and Citracal. Contact the project team to add new brands.

**Q: Can I get a copy of the brand standards JSON?**  
A: Yes, it's available in the project repository at `azure/oad-design-standards.json`.

---

## Troubleshooting

### Issue: "Failed to analyze design. Please try again."

**Possible Causes**:
1. n8n workflow is down
2. OpenAI API is unavailable
3. Network connectivity issue

**Solutions**:
1. Wait 1-2 minutes and try again
2. Check project status page (if available)
3. Contact support if issue persists

### Issue: "Invalid request. Missing required fields."

**Possible Causes**:
1. File upload didn't complete
2. Form validation failed
3. Browser cache issue

**Solutions**:
1. Refresh the page
2. Re-upload your file
3. Ensure all required fields (*) are filled
4. Try a different browser

### Issue: Results show "Failed to parse AI analysis"

**Possible Causes**:
1. AI returned unexpected format
2. API timeout
3. Complex design exceeded token limit

**Solutions**:
1. Re-submit the design
2. Simplify the design (fewer elements)
3. Contact support with the design file

---

## Getting Help

### Support Channels

**Technical Issues**:
- GitHub Issues: https://github.com/MichaelScrivana/OAD-DesignReviewer/issues
- Email: michael.scrivana@bayer.com

**Brand Guidelines Questions**:
- Email: brand-team@bayer.com
- Brand Portal: https://bayer-brand-portal.com/oad

**Urgent Issues**:
- Contact your brand manager directly
- Use "Request Human Review" for immediate escalation

---

## Best Practices

### Do's ✅

- ✅ Run designs through AI review **before** brand team submission
- ✅ Address all **critical violations** before requesting human review
- ✅ Download reports for documentation and audit trail
- ✅ Use AI feedback as a learning tool to improve future designs
- ✅ Provide context in "Notes" field when design deviates intentionally

### Don'ts ❌

- ❌ Don't skip human brand team approval (AI is not final authority)
- ❌ Don't upload confidential or unreleased product information
- ❌ Don't ignore accessibility warnings (legal requirement)
- ❌ Don't assume AI is 100% accurate (verify critical measurements)
- ❌ Don't use this for non-Bayer brand designs

---

## Keyboard Shortcuts

- **Ctrl/Cmd + Click** on upload zone: Open file picker
- **Esc**: Close accordions
- **Tab**: Navigate form fields
- **Enter**: Submit form (when in last field)

---

## Accessibility Features

This web app is designed to be accessible:

- ✅ Screen reader compatible
- ✅ Keyboard navigable
- ✅ High contrast mode support
- ✅ Responsive text sizing

If you encounter accessibility issues, please report them.

---

**Happy designing! 🎨**

For more information, see:
- [Architecture Guide](architecture.md)
- [Admin Guide](admin-guide.md)
- [Project README](../README.md)

---

**Last Updated**: 2026-02-04  
**Version**: 1.0.0  
**Author**: Bayer Brand Team & DSO
