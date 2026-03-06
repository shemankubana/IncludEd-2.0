import fs from 'fs';
import pdf from 'pdf-parse';

export async function processPDF(filePath, options = {}) {
  try {
    console.log(`📖 Reading PDF file...`);

    // Read PDF
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    let originalContent = pdfData.text;

    console.log(`📊 Extracted ${originalContent.length} characters from PDF`);

    // Remove metadata and formatting junk
    originalContent = cleanPDFText(originalContent);

    const wordCount = originalContent.split(/\s+/).filter(w => w.length > 0).length;
    console.log(`📝 Cleaned text: ${wordCount} words`);

    // Per-section simplification happens in the background ML step (literature.js)
    // after the content is split into sections. Storing raw content here.
    const adaptedContent = originalContent;

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