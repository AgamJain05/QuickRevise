/**
 * Semantic Chunking Service
 * 
 * Breaks content into micro-learning chunks optimized for scrollable cards.
 * Target: 80-100 words per chunk (50-150 word range)
 * Goal: TikTok-style learning - quick, digestible, engaging
 */

export interface SemanticChunk {
  id: number;
  content: string;
  wordCount: number;
  type: 'intro' | 'concept' | 'example' | 'definition' | 'list' | 'summary' | 'transition';
  keywords: string[];
  sentenceCount: number;
  isListContent: boolean;
  prevContext?: string;
}

// Chunking configuration
const CHUNK_CONFIG = {
  minWords: 50,
  maxWords: 150,
  targetWords: 90, // Ideal: 80-100
  summaryInterval: 6, // Insert summary every N cards
};

/**
 * Main chunking function - creates micro-learning chunks
 */
export function createSemanticChunks(text: string): SemanticChunk[] {
  // Step 1: Clean and preprocess text
  const cleanedText = preprocessText(text);
  
  // Step 2: Split into sentences
  const sentences = splitIntoSentences(cleanedText);
  
  // Step 3: Identify semantic boundaries
  const boundaries = detectSemanticBoundaries(sentences);
  
  // Step 4: Create initial chunks
  const rawChunks = createRawChunks(sentences, boundaries);
  
  // Step 5: Balance chunk sizes
  const balancedChunks = balanceChunks(rawChunks);
  
  // Step 6: Classify chunk types
  const classifiedChunks = classifyChunks(balancedChunks);
  
  // Step 7: Add context and finalize
  return finalizeChunks(classifiedChunks);
}

/**
 * Preprocess text - clean headers, footers, page numbers
 */
function preprocessText(text: string): string {
  return text
    // Remove page numbers (various formats)
    .replace(/\b(Page|Pg\.?)\s*\d+\s*(of\s*\d+)?/gi, '')
    .replace(/^\s*\d+\s*$/gm, '')
    // Remove common headers/footers
    .replace(/^(chapter|section)\s*\d+[\.:]/gim, '')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    // Remove URLs (keep content simple)
    .replace(/https?:\/\/[^\s]+/g, '')
    // Clean up
    .trim();
}

/**
 * Split text into sentences with smart handling
 */
function splitIntoSentences(text: string): string[] {
  // Handle common abbreviations
  const processed = text
    .replace(/Mr\./g, 'Mr')
    .replace(/Mrs\./g, 'Mrs')
    .replace(/Ms\./g, 'Ms')
    .replace(/Dr\./g, 'Dr')
    .replace(/Prof\./g, 'Prof')
    .replace(/vs\./g, 'vs')
    .replace(/etc\./g, 'etc')
    .replace(/i\.e\./g, 'ie')
    .replace(/e\.g\./g, 'eg')
    .replace(/\d+\.\d+/g, (match) => match.replace('.', '•')); // Preserve decimals

  // Split on sentence boundaries
  const sentences = processed
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.replace(/•/g, '.').trim())
    .filter(s => s.length > 10);

  return sentences;
}

/**
 * Detect semantic boundaries between sentences
 */
function detectSemanticBoundaries(sentences: string[]): Set<number> {
  const boundaries = new Set<number>();
  
  // Topic shift indicators
  const shiftIndicators = [
    /^(however|but|although|nevertheless|on the other hand)/i,
    /^(first|second|third|finally|next|then|after|before)/i,
    /^(for example|for instance|such as|specifically)/i,
    /^(in summary|to summarize|in conclusion|therefore)/i,
    /^(another|additionally|furthermore|moreover)/i,
    /^(the \w+ is|a \w+ is|an \w+ is)/i, // Definitions
  ];

  // Detect list items
  const listPattern = /^[\d•\-\*]\s*|^\([a-z\d]\)/i;

  for (let i = 1; i < sentences.length; i++) {
    const current = sentences[i];
    const prev = sentences[i - 1];

    // Check for topic shift indicators
    if (shiftIndicators.some(pattern => pattern.test(current))) {
      boundaries.add(i);
      continue;
    }

    // Check for list transitions
    const prevIsList = listPattern.test(prev);
    const currIsList = listPattern.test(current);
    if (prevIsList !== currIsList) {
      boundaries.add(i);
      continue;
    }

    // Check for significant keyword shift
    const prevKeywords = extractKeywords(prev);
    const currKeywords = extractKeywords(current);
    const overlap = prevKeywords.filter(k => currKeywords.includes(k)).length;
    if (overlap === 0 && prevKeywords.length > 0 && currKeywords.length > 0) {
      boundaries.add(i);
    }
  }

  return boundaries;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 4 && !stopWords.has(word))
    .slice(0, 5);
}

/**
 * Create raw chunks based on semantic boundaries
 */
function createRawChunks(sentences: string[], boundaries: Set<number>): string[][] {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    // Start new chunk at boundary
    if (boundaries.has(i) && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }

    currentChunk.push(sentences[i]);

    // Check word count
    const wordCount = currentChunk.join(' ').split(/\s+/).length;
    
    // If we've reached target, start new chunk
    if (wordCount >= CHUNK_CONFIG.targetWords && !boundaries.has(i + 1)) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
  }

  // Don't forget last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Balance chunk sizes - merge small, split large
 */
function balanceChunks(rawChunks: string[][]): string[][] {
  const balanced: string[][] = [];
  let pending: string[] = [];

  for (const chunk of rawChunks) {
    const combined = [...pending, ...chunk];
    const wordCount = combined.join(' ').split(/\s+/).length;

    if (wordCount < CHUNK_CONFIG.minWords) {
      // Too small, keep pending
      pending = combined;
    } else if (wordCount <= CHUNK_CONFIG.maxWords) {
      // Just right
      balanced.push(combined);
      pending = [];
    } else {
      // Too large, need to split
      if (pending.length > 0) {
        balanced.push(pending);
        pending = [];
      }
      
      // Split large chunk
      const splitChunks = splitLargeChunk(chunk);
      balanced.push(...splitChunks);
    }
  }

  // Handle remaining pending
  if (pending.length > 0) {
    if (balanced.length > 0) {
      // Merge with last chunk if possible
      const last = balanced[balanced.length - 1];
      const combined = [...last, ...pending];
      const wordCount = combined.join(' ').split(/\s+/).length;
      
      if (wordCount <= CHUNK_CONFIG.maxWords * 1.2) {
        balanced[balanced.length - 1] = combined;
      } else {
        balanced.push(pending);
      }
    } else {
      balanced.push(pending);
    }
  }

  return balanced;
}

/**
 * Split a large chunk into smaller pieces
 */
function splitLargeChunk(sentences: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    
    if (wordCount + sentenceWords > CHUNK_CONFIG.targetWords && current.length > 0) {
      chunks.push(current);
      current = [];
      wordCount = 0;
    }
    
    current.push(sentence);
    wordCount += sentenceWords;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Classify chunk types based on content
 */
function classifyChunks(chunks: string[][]): Array<{ sentences: string[]; type: SemanticChunk['type'] }> {
  return chunks.map((sentences, index) => {
    const text = sentences.join(' ').toLowerCase();
    
    let type: SemanticChunk['type'] = 'concept';
    
    // Intro detection (first chunk or intro keywords)
    if (index === 0 || /^(introduction|overview|this (chapter|section|document))/i.test(text)) {
      type = 'intro';
    }
    // Definition detection
    else if (/\b(is defined as|refers to|is a|means that|is the)\b/i.test(text)) {
      type = 'definition';
    }
    // Example detection
    else if (/\b(for example|for instance|such as|consider|imagine)\b/i.test(text)) {
      type = 'example';
    }
    // List detection
    else if (sentences.some(s => /^[\d•\-\*]/.test(s)) || sentences.length >= 3 && sentences.every(s => s.length < 100)) {
      type = 'list';
    }
    // Summary detection
    else if (/\b(in summary|to summarize|in conclusion|key takeaway|remember)\b/i.test(text)) {
      type = 'summary';
    }

    return { sentences, type };
  });
}

/**
 * Finalize chunks with metadata
 */
function finalizeChunks(classified: Array<{ sentences: string[]; type: SemanticChunk['type'] }>): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  
  for (let i = 0; i < classified.length; i++) {
    const { sentences, type } = classified[i];
    const content = sentences.join(' ');
    const wordCount = content.split(/\s+/).length;
    
    // Insert summary card every N cards
    if (i > 0 && i % CHUNK_CONFIG.summaryInterval === 0 && type !== 'summary') {
      // Add a placeholder for summary card (AI will generate)
      chunks.push({
        id: chunks.length,
        content: `[GENERATE_SUMMARY_OF_LAST_${CHUNK_CONFIG.summaryInterval}_CARDS]`,
        wordCount: 0,
        type: 'summary',
        keywords: [],
        sentenceCount: 0,
        isListContent: false,
      });
    }
    
    chunks.push({
      id: chunks.length,
      content,
      wordCount,
      type,
      keywords: extractKeywords(content),
      sentenceCount: sentences.length,
      isListContent: sentences.some(s => /^[\d•\-\*]/.test(s)),
      prevContext: i > 0 ? classified[i - 1].sentences[0] : undefined,
    });
  }

  return chunks;
}

/**
 * Estimate expected card count for content
 */
export function estimateCardCount(text: string): number {
  const wordCount = text.split(/\s+/).length;
  return Math.max(5, Math.ceil(wordCount / CHUNK_CONFIG.targetWords));
}
