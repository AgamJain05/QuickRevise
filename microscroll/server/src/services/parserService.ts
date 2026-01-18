import fs from 'fs/promises';
import path from 'path';

// ===========================================
// Text Extraction from Various File Types
// ===========================================

// Extract text from PDF
export async function extractFromPDF(filePath: string): Promise<string> {
  // Note: In production, use pdf-parse or pdfjs-dist
  // For now, we'll use a simple approach with dynamic import
  try {
    const pdfParse = await import('pdf-parse');
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse.default(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
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
  switch (fileType) {
    case 'pdf':
      return extractFromPDF(filePath);
    case 'docx':
      return extractFromDOCX(filePath);
    case 'pptx':
      return extractFromPPTX(filePath);
    case 'txt':
      return extractFromTXT(filePath);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
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
