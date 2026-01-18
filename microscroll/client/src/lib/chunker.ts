/**
 * Text Chunking Algorithm
 * 
 * Breaks content into semantic chunks (150-300 words each)
 * Preserves paragraph boundaries and keeps related content together.
 */

export interface TextChunk {
  id: string
  content: string
  wordCount: number
  sentences: string[]
  keywords: string[]
  type: 'definition' | 'example' | 'process' | 'comparison' | 'concept' | 'general'
  headingContext?: string
}

interface ChunkerOptions {
  minWords?: number
  maxWords?: number
  overlapSentences?: number
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  minWords: 150,
  maxWords: 300,
  overlapSentences: 1, // Overlap sentences between chunks for context
}

/**
 * Main chunking function
 * Breaks text into semantically coherent chunks
 */
export function chunkText(text: string, options: ChunkerOptions = {}): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Step 1: Split into sentences
  const sentences = splitIntoSentences(text)
  
  // Step 2: Detect section headers
  const sections = detectSections(sentences)
  
  // Step 3: Create chunks respecting sentence boundaries
  const chunks = createChunks(sections, opts)
  
  // Step 4: Analyze each chunk
  return chunks.map((chunk, index) => analyzeChunk(chunk, index))
}

/**
 * Split text into sentences using regex patterns
 * Handles common abbreviations and edge cases
 */
function splitIntoSentences(text: string): string[] {
  // Common abbreviations that shouldn't end sentences
  const abbreviations = [
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
    'vs', 'etc', 'e.g', 'i.e', 'al', 'Fig', 'fig',
    'Vol', 'vol', 'No', 'no', 'pp', 'ed', 'eds'
  ]
  
  // Protect abbreviations by replacing periods temporarily
  let processed = text
  abbreviations.forEach(abbr => {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi')
    processed = processed.replace(regex, `${abbr}<<<DOT>>>`)
  })
  
  // Also protect decimal numbers
  processed = processed.replace(/(\d)\.(\d)/g, '$1<<<DOT>>>$2')
  
  // Split on sentence-ending punctuation
  const sentenceRegex = /[.!?]+[\s]+(?=[A-Z])|[.!?]+$/g
  const parts = processed.split(sentenceRegex)
  
  // Restore periods and clean up
  return parts
    .map(s => s.replace(/<<<DOT>>>/g, '.').trim())
    .filter(s => s.length > 0)
}

/**
 * Detect section headers and organize sentences into sections
 */
interface Section {
  heading?: string
  sentences: string[]
}

function detectSections(sentences: string[]): Section[] {
  const sections: Section[] = []
  let currentSection: Section = { sentences: [] }
  
  for (const sentence of sentences) {
    // Detect if sentence looks like a header
    if (isLikelyHeader(sentence)) {
      // Save current section if it has content
      if (currentSection.sentences.length > 0) {
        sections.push(currentSection)
      }
      // Start new section with this heading
      currentSection = {
        heading: sentence,
        sentences: [],
      }
    } else {
      currentSection.sentences.push(sentence)
    }
  }
  
  // Don't forget the last section
  if (currentSection.sentences.length > 0) {
    sections.push(currentSection)
  }
  
  return sections
}

/**
 * Check if a sentence looks like a section header
 */
function isLikelyHeader(sentence: string): boolean {
  // Short sentences that start with a capital letter and don't end with typical punctuation
  if (sentence.length < 100 && sentence.length > 3) {
    // Ends without period, or is all caps, or has number prefix
    const noEndPunctuation = !/[.!?]$/.test(sentence)
    const isAllCaps = sentence === sentence.toUpperCase() && sentence.length > 3
    const hasNumberPrefix = /^\d+[\.\)]\s/.test(sentence)
    const startsWithRomanNumeral = /^[IVX]+[\.\)]\s/.test(sentence)
    
    if (isAllCaps || hasNumberPrefix || startsWithRomanNumeral || noEndPunctuation) {
      return true
    }
  }
  
  return false
}

/**
 * Create chunks from sections respecting word limits
 */
function createChunks(sections: Section[], opts: Required<ChunkerOptions>): string[][] {
  const chunks: string[][] = []
  let currentChunk: string[] = []
  let currentWordCount = 0
  
  for (const section of sections) {
    // If section has a heading, consider starting a new chunk
    if (section.heading && currentWordCount > opts.minWords) {
      chunks.push(currentChunk)
      currentChunk = []
      currentWordCount = 0
    }
    
    for (const sentence of section.sentences) {
      const sentenceWords = countWords(sentence)
      
      // Check if adding this sentence would exceed max
      if (currentWordCount + sentenceWords > opts.maxWords && currentWordCount >= opts.minWords) {
        // Save current chunk
        chunks.push(currentChunk)
        
        // Start new chunk with overlap
        const overlapStart = Math.max(0, currentChunk.length - opts.overlapSentences)
        currentChunk = currentChunk.slice(overlapStart)
        currentWordCount = currentChunk.reduce((sum, s) => sum + countWords(s), 0)
      }
      
      currentChunk.push(sentence)
      currentWordCount += sentenceWords
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

/**
 * Analyze a chunk to extract metadata
 */
function analyzeChunk(sentences: string[], index: number): TextChunk {
  const content = sentences.join(' ')
  const wordCount = countWords(content)
  const keywords = extractKeywords(content)
  const type = detectChunkType(content)
  
  return {
    id: `chunk-${index + 1}`,
    content,
    wordCount,
    sentences,
    keywords,
    type,
  }
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

/**
 * Extract keywords using TF-IDF-like scoring
 */
function extractKeywords(text: string, maxKeywords: number = 5): string[] {
  // Tokenize and normalize
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
  
  // Remove common stop words
  const stopWords = new Set([
    'the', 'this', 'that', 'these', 'those', 'with', 'from', 'have', 'has',
    'been', 'were', 'was', 'will', 'would', 'could', 'should', 'their',
    'there', 'they', 'them', 'then', 'than', 'what', 'when', 'where',
    'which', 'while', 'about', 'after', 'before', 'between', 'through',
    'during', 'under', 'again', 'further', 'once', 'here', 'very', 'just',
    'also', 'more', 'most', 'other', 'some', 'such', 'only', 'same', 'into',
    'each', 'does', 'doing', 'being', 'because', 'both', 'however', 'therefore'
  ])
  
  const filtered = words.filter(w => !stopWords.has(w))
  
  // Count frequency
  const freq: Record<string, number> = {}
  for (const word of filtered) {
    freq[word] = (freq[word] || 0) + 1
  }
  
  // Sort by frequency and return top keywords
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word)
}

/**
 * Detect the type of content in a chunk
 */
function detectChunkType(text: string): TextChunk['type'] {
  const lower = text.toLowerCase()
  
  // Definition patterns
  if (
    /\bis defined as\b/.test(lower) ||
    /\brefers to\b/.test(lower) ||
    /\bmeans that\b/.test(lower) ||
    /\bis the\b.*\bof\b/.test(lower)
  ) {
    return 'definition'
  }
  
  // Example patterns
  if (
    /\bfor example\b/.test(lower) ||
    /\bfor instance\b/.test(lower) ||
    /\bsuch as\b/.test(lower) ||
    /\be\.g\.\b/.test(lower) ||
    /\bconsider\b/.test(lower)
  ) {
    return 'example'
  }
  
  // Process patterns
  if (
    /\bstep \d+\b/.test(lower) ||
    /\bfirst\b.*\bthen\b/.test(lower) ||
    /\bprocess\b/.test(lower) ||
    /\bprocedure\b/.test(lower) ||
    /\bsequence\b/.test(lower)
  ) {
    return 'process'
  }
  
  // Comparison patterns
  if (
    /\bcompared to\b/.test(lower) ||
    /\bin contrast\b/.test(lower) ||
    /\bwhereas\b/.test(lower) ||
    /\bsimilar to\b/.test(lower) ||
    /\bdifference between\b/.test(lower) ||
    /\bon the other hand\b/.test(lower)
  ) {
    return 'comparison'
  }
  
  // Concept patterns
  if (
    /\bconcept\b/.test(lower) ||
    /\btheory\b/.test(lower) ||
    /\bprinciple\b/.test(lower) ||
    /\blaw\b/.test(lower) ||
    /\brule\b/.test(lower)
  ) {
    return 'concept'
  }
  
  return 'general'
}

/**
 * Get chunk type display label
 */
export function getChunkTypeLabel(type: TextChunk['type']): string {
  const labels: Record<TextChunk['type'], string> = {
    definition: '📖 Definition',
    example: '💡 Example',
    process: '🔄 Process',
    comparison: '⚖️ Comparison',
    concept: '🧠 Concept',
    general: '📝 General',
  }
  return labels[type]
}

/**
 * Estimate difficulty level based on content
 */
export function estimateDifficulty(chunk: TextChunk): 'easy' | 'medium' | 'hard' {
  const text = chunk.content.toLowerCase()
  
  // Count complex indicators
  let complexityScore = 0
  
  // Long sentences indicate higher complexity
  const avgSentenceLength = chunk.wordCount / chunk.sentences.length
  if (avgSentenceLength > 25) complexityScore += 2
  else if (avgSentenceLength > 18) complexityScore += 1
  
  // Technical terms (words with numbers or special patterns)
  const technicalTerms = chunk.content.match(/\b[A-Z][a-z]*[A-Z][a-z]*\b/g) || []
  complexityScore += Math.min(technicalTerms.length, 3)
  
  // Complex connectors
  const complexConnectors = [
    'furthermore', 'consequently', 'nevertheless', 'notwithstanding',
    'subsequently', 'aforementioned', 'henceforth', 'whereby'
  ]
  for (const connector of complexConnectors) {
    if (text.includes(connector)) complexityScore += 1
  }
  
  // Determine difficulty
  if (complexityScore >= 5) return 'hard'
  if (complexityScore >= 2) return 'medium'
  return 'easy'
}
