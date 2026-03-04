import fs from 'fs';
import pdf from 'pdf-parse';
import axios from 'axios';

export async function processPDF(filePath, options = {}) {
  try {
    const { simplifyText = true } = options;
    console.log(`📖 Reading PDF file... (Simplify: ${simplifyText})`);

    // Read PDF
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    let originalContent = pdfData.text;

    console.log(`📊 Extracted ${originalContent.length} characters from PDF`);

    // Remove metadata and formatting junk
    originalContent = cleanPDFText(originalContent);

    const wordCount = originalContent.split(/\s+/).filter(w => w.length > 0).length;
    console.log(`📝 Cleaned text: ${wordCount} words`);

    // Send to AI service for adaptation
    let adaptedContent = originalContent;

    if (!simplifyText) {
      console.log('⏭️  Skipping AI adaptation as requested');
    } else if (originalContent.length > 25000) {
      console.log('⚠️ Content is too large for synchronous AI adaptation. Bypassing adaptation step to avoid timeouts.');
    } else {
      try {
        console.log('🤖 Sending to AI service for adaptation...');
        const response = await axios.post(
          `${process.env.AI_SERVICE_URL || 'http://localhost:8082'}/adapt-text`,
          {
            text: originalContent,
            target_level: 'accessible'
          },
          {
            timeout: 20000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (response.data && response.data.adaptedText) {
          adaptedContent = response.data.adaptedText;
          console.log('✅ AI adaptation successful');
        }
      } catch (error) {
        console.log(`⚠️  AI adaptation error: ${error.message}`);
        adaptedContent = originalContent;
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
      console.log('🗑️  Temporary file deleted');
    } catch (e) {
      // Ignore cleanup errors
    }

    return {
      originalContent,
      adaptedContent,
      wordCount
    };

  } catch (error) {
    console.error('❌ PDF processing error:', error);

    // Clean up file on error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // Ignore
    }

    throw new Error(`Failed to process PDF: ${error.message}`);
  }
}

function cleanPDFText(text) {
  // Remove common PDF artifacts
  text = text.replace(/\f/g, '\n');           // Form feed → newline (preserves structure)
  text = text.replace(/Page \d+/gi, '');      // Page numbers
  text = text.replace(/FTLN \d+/g, '');       // Line numbers

  // Collapse horizontal whitespace (spaces/tabs) but PRESERVE newlines
  text = text.replace(/[^\S\n]+/g, ' ');      // Multiple spaces/tabs → single space
  text = text.replace(/\n{3,}/g, '\n\n');     // Max 2 consecutive newlines

  // Remove URLs and emails
  text = text.replace(/https?:\/\/[^\s]+/g, '');
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');

  // Remove common headers/footers
  text = text.replace(/Folger Shakespeare Library/gi, '');
  text = text.replace(/Get even more from the Folger/gi, '');

  // Remove Planet eBook branding lines
  text = text.replace(/^.*Free eBooks at Planet eBook\.com.*$/gmi, '');
  text = text.replace(/^.*Download free eBooks.*$/gmi, '');

  return text.trim();
}