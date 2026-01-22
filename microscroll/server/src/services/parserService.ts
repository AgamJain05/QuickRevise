import fs from 'fs/promises';
import { extractPDFText } from '../lib/pdfParser.js';

// ===========================================
// Text Extraction from Various File Types
// ===========================================

// Extract text from PDF
export async function extractFromPDF(filePath: string): Promise<string> {
  console.log('📑 [ParserService.extractFromPDF] Starting PDF extraction');
  console.log('📑 [ParserService.extractFromPDF] File path:', filePath);
  
  try {
    console.log('📑 [ParserService.extractFromPDF] Calling extractPDFText...');
    const text = await extractPDFText(filePath);
    console.log('📑 [ParserService.extractFromPDF] extractPDFText returned:', text?.length || 0, 'chars');
    
    if (!text || text.trim().length < 10) {
      console.error('📑 [ParserService.extractFromPDF] Not enough text extracted:', text?.trim().length || 0, 'chars');
      throw new Error('Could not extract text from PDF. The file may be scanned or image-based.');
    }
    
    console.log('📑 [ParserService.extractFromPDF] Success! Text preview:', text.slice(0, 100));
    return text;
  } catch (error) {
    console.error('📑 [ParserService.extractFromPDF] PDF parsing error:', error);
    console.error('📑 [ParserService.extractFromPDF] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw new Error(
      error instanceof Error 
        ? `Failed to parse PDF: ${error.message}` 
        : 'Failed to parse PDF file'
    );
  }
}

// Extract text from DOCX
export async function extractFromDOCX(filePath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

// Extract text from PPTX
export async function extractFromPPTX(filePath: string): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const data = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(data);

    const texts: string[] = [];

    // PPTX stores slides in ppt/slides/slideN.xml
    const slideFiles = Object.keys(zip.files)
      .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
        return numA - numB;
      });

    for (const slideFile of slideFiles) {
      const content = await zip.files[slideFile].async('string');
      // Extract text between <a:t> tags
      const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const slideTexts = textMatches
        .map((match) => match.replace(/<\/?a:t>/g, ''))
        .filter((text) => text.trim());
      
      if (slideTexts.length > 0) {
        texts.push(slideTexts.join(' '));
      }
    }

    return texts.join('\n\n');
  } catch (error) {
    console.error('PPTX parsing error:', error);
    throw new Error('Failed to parse PPTX file');
  }
}

// Extract text from TXT
export async function extractFromTXT(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return content;
}

// Main extraction function
export async function extractText(
  filePath: string,
  fileType: 'pdf' | 'docx' | 'pptx' | 'txt'
): Promise<string> {
  console.log('📄 [ParserService.extractText] Starting extraction');
  console.log('📄 [ParserService.extractText] File path:', filePath);
  console.log('📄 [ParserService.extractText] File type:', fileType);
  
  let result: string;
  
  switch (fileType) {
    case 'pdf':
      console.log('📄 [ParserService.extractText] Calling extractFromPDF...');
      result = await extractFromPDF(filePath);
      break;
    case 'docx':
      console.log('📄 [ParserService.extractText] Calling extractFromDOCX...');
      result = await extractFromDOCX(filePath);
      break;
    case 'pptx':
      console.log('📄 [ParserService.extractText] Calling extractFromPPTX...');
      result = await extractFromPPTX(filePath);
      break;
    case 'txt':
      console.log('📄 [ParserService.extractText] Calling extractFromTXT...');
      result = await extractFromTXT(filePath);
      break;
    default:
      console.error('📄 [ParserService.extractText] Unsupported file type:', fileType);
      throw new Error(`Unsupported file type: ${fileType}`);
  }
  
  console.log('📄 [ParserService.extractText] Extraction complete, chars:', result?.length || 0);
  return result;
}

// ===========================================
// Text Chunking
// ===========================================

export interface ChunkOptions {
  minWords?: number;
  maxWords?: number;
  overlapSentences?: number;
}

const DEFAULT_CHUNK_OPTIONS: Required<ChunkOptions> = {
  minWords: 150,
  maxWords: 300,
  overlapSentences: 1,
};

// Split text into sentences
function splitIntoSentences(text: string): string[] {
  // Handle common abbreviations
  const cleaned = text
    .replace(/Mr\./g, 'Mr')
    .replace(/Mrs\./g, 'Mrs')
    .replace(/Dr\./g, 'Dr')
    .replace(/Prof\./g, 'Prof')
    .replace(/vs\./g, 'vs')
    .replace(/etc\./g, 'etc')
    .replace(/i\.e\./g, 'ie')
    .replace(/e\.g\./g, 'eg');

  // Split on sentence boundaries
  const sentences = cleaned.split(/(?<=[.!?])\s+/);

  return sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Count words in text
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// Chunk text into semantic sections
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const opts = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];

  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);

    // Check if adding this sentence would exceed max
    if (
      currentWordCount + sentenceWords > opts.maxWords &&
      currentWordCount >= opts.minWords
    ) {
      // Save current chunk
      chunks.push(currentChunk.join(' '));

      // Start new chunk with overlap
      const overlapStart = Math.max(
        0,
        currentChunk.length - opts.overlapSentences
      );
      currentChunk = currentChunk.slice(overlapStart);
      currentWordCount = currentChunk.reduce(
        (sum, s) => sum + countWords(s),
        0
      );
    }

    currentChunk.push(sentence);
    currentWordCount += sentenceWords;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}
