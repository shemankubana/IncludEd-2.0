import fs from 'fs';
import pdf from 'pdf-parse';
import axios from 'axios';

export async function processPDF(filePath) {
  try {
    console.log('📖 Reading PDF file...');

    // Read PDF
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    let originalContent = pdfData.text;

    console.log(`📊 Extracted ${originalContent.length} characters from PDF`);

    // Removed the 5000 character hard limit to allow full book processing
    if (originalContent.length > 5000) {
      console.log(`⚠️  PDF is large (${originalContent.length} chars). Proceeding with full content.`);
    }

    // Remove metadata and formatting junk
    originalContent = cleanPDFText(originalContent);

    const wordCount = originalContent.split(/\s+/).filter(w => w.length > 0).length;
    console.log(`📝 Cleaned text: ${wordCount} words`);

    // Send to AI service for adaptation
    let adaptedContent = originalContent;

    if (originalContent.length > 15000) {
      console.log('⚠️ Content is too large for synchronous AI adaptation. Bypassing adaptation step to avoid timeouts.');
    } else {
      try {
        console.log('🤖 Sending to AI service for adaptation...');
        console.log(`🔗 AI Service URL: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);

        const response = await axios.post(
          `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/adapt-text`,  // Fixed URL
          {
            text: originalContent,
            target_level: 'accessible'
          },
          {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (response.data && response.data.adaptedText) {
          adaptedContent = response.data.adaptedText;
          console.log('✅ AI adaptation successful');
        } else {
          console.log('⚠️  AI returned invalid response, using original');
        }

      } catch (error) {
        if (error.response) {
          console.log(`⚠️  AI service error ${error.response.status}: ${error.response.statusText}`);
          console.log(`Response data:`, error.response.data);
        } else if (error.request) {
          console.log(`⚠️  AI service not reachable (is it running on port 8000?)`);
        } else {
          console.log(`⚠️  AI adaptation error: ${error.message}`);
        }
        // Use original if AI fails
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
  text = text.replace(/\f/g, ' ');  // Form feed
  text = text.replace(/Page \d+/gi, '');  // Page numbers
  text = text.replace(/FTLN \d+/g, '');  // Line numbers
  text = text.replace(/\s+/g, ' ');  // Multiple spaces

  // Remove URLs
  text = text.replace(/https?:\/\/[^\s]+/g, '');

  // Remove email addresses
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');

  // Remove common headers/footers
  text = text.replace(/Folger Shakespeare Library/gi, '');
  text = text.replace(/Get even more from the Folger/gi, '');

  return text.trim();
}