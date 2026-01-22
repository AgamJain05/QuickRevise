import fs from 'fs/promises';

/**
 * PDF Parser with fallback
 * 
 * pdf-parse has a known issue where it tries to load test/data/05-versions-space.pdf
 * during import. This wrapper handles that gracefully.
 */

interface PDFData {
  text: string;
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
}

/**
 * Parse PDF and extract text
 */
export async function parsePDF(dataBuffer: Buffer): Promise<PDFData> {
  console.log('📘 [pdfParser.parsePDF] Starting PDF parsing');
  console.log('📘 [pdfParser.parsePDF] Buffer size:', dataBuffer.length, 'bytes');
  
  try {
    // Dynamic import to avoid test file issue at module load
    console.log('📘 [pdfParser.parsePDF] Importing pdf-parse...');
    const pdfParse = await import('pdf-parse');
    console.log('📘 [pdfParser.parsePDF] pdf-parse imported successfully');
    
    // pdf-parse default export
    const parser = pdfParse.default || pdfParse;
    console.log('📘 [pdfParser.parsePDF] Parser type:', typeof parser);
    
    // Call the parser with options to skip problematic features
    console.log('📘 [pdfParser.parsePDF] Calling parser...');
    const data = await (parser as (buffer: Buffer, options?: { max?: number }) => Promise<{ text: string; numpages: number; numrender: number; info: Record<string, unknown> }>)(dataBuffer, {
      // Limit pages to prevent timeout on large PDFs
      max: 50,
    });
    
    console.log('📘 [pdfParser.parsePDF] Parser returned successfully');
    console.log('📘 [pdfParser.parsePDF] Pages:', data.numpages);
    console.log('📘 [pdfParser.parsePDF] Text length:', data.text?.length || 0);
    
    return {
      text: data.text || '',
      numpages: data.numpages || 0,
      numrender: data.numrender || 0,
      info: data.info || {},
    };
  } catch (error) {
    console.error('📘 [pdfParser.parsePDF] pdf-parse error:', error);
    console.error('📘 [pdfParser.parsePDF] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // If pdf-parse fails, try basic extraction
    console.log('📘 [pdfParser.parsePDF] Trying fallback extraction...');
    const fallbackText = extractTextFallback(dataBuffer);
    console.log('📘 [pdfParser.parsePDF] Fallback extracted:', fallbackText.length, 'chars');
    
    return {
      text: fallbackText,
      numpages: 0,
      numrender: 0,
      info: {},
    };
  }
}

/**
 * Fallback text extraction from PDF binary
 * Extracts visible ASCII text strings from PDF
 */
function extractTextFallback(dataBuffer: Buffer): string {
  const content = dataBuffer.toString('binary');
  const textChunks: string[] = [];
  
  // Pattern 1: Text in parentheses (PDF literal strings)
  const parenRegex = /\(([^)\\]|\\.){1,500}\)/g;
  let match;
  
  while ((match = parenRegex.exec(content)) !== null) {
    let text = match[0].slice(1, -1); // Remove parentheses
    
    // Unescape PDF escape sequences
    text = text
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    
    // Filter out binary/control characters
    const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
    
    if (cleaned.length > 3 && /[a-zA-Z]{2,}/.test(cleaned)) {
      textChunks.push(cleaned);
    }
  }
  
  // Pattern 2: Hex strings (PDF hex strings)
  const hexRegex = /<([0-9A-Fa-f\s]+)>/g;
  
  while ((match = hexRegex.exec(content)) !== null) {
    const hex = match[1].replace(/\s/g, '');
    if (hex.length % 2 === 0 && hex.length >= 4) {
      let text = '';
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode <= 126) {
          text += String.fromCharCode(charCode);
        }
      }
      if (text.length > 3 && /[a-zA-Z]{2,}/.test(text)) {
        textChunks.push(text);
      }
    }
  }
  
  // Combine and clean up
  const result = textChunks
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return result;
}

/**
 * Extract text from PDF file
 */
export async function extractPDFText(filePath: string): Promise<string> {
  console.log('📘 [pdfParser.extractPDFText] Starting');
  console.log('📘 [pdfParser.extractPDFText] File path:', filePath);
  
  try {
    console.log('📘 [pdfParser.extractPDFText] Reading file...');
    const dataBuffer = await fs.readFile(filePath);
    console.log('📘 [pdfParser.extractPDFText] File read successfully, size:', dataBuffer.length, 'bytes');
    
    console.log('📘 [pdfParser.extractPDFText] Calling parsePDF...');
    const data = await parsePDF(dataBuffer);
    
    console.log(`📄 [pdfParser.extractPDFText] PDF parsed: ${data.numpages} pages, ${data.text.length} chars extracted`);
    console.log(`📄 [pdfParser.extractPDFText] Text preview: "${data.text.slice(0, 100)}..."`);
    
    return data.text;
  } catch (error) {
    console.error('📘 [pdfParser.extractPDFText] ERROR:', error);
    console.error('📘 [pdfParser.extractPDFText] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
}
