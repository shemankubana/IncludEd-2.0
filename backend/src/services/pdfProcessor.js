import fs from 'fs';
import pdf from 'pdf-parse';
import axios from 'axios';

export async function processPDF(filePath) {
  try {
    // Read PDF
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    
    const originalContent = pdfData.text;
    const wordCount = originalContent.split(/\s+/).length;
    
    // Send to AI service for adaptation
    const adaptedContent = await adaptTextForAccessibility(originalContent);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    return {
      originalContent,
      adaptedContent,
      wordCount
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error('Failed to process PDF');
  }
}

async function adaptTextForAccessibility(text) {
  try {
    const response = await axios.post(
      process.env.AI_SERVICE_URL + '/adapt-text',
      { text },
      { timeout: 30000 }
    );
    return response.data.adaptedText;
  } catch (error) {
    console.error('Text adaptation error:', error);
    // Fallback: return original if AI service fails
    return text;
  }
}