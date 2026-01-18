/**
 * File Processing Pipeline
 * 
 * Coordinates the entire flow from file upload to card generation:
 * 1. File reading/text extraction
 * 2. Text chunking
 * 3. AI card generation
 * 4. Storage
 */

import { extractTextFromPDF, isPDF } from './pdfParser'
import { extractTextFromDOCX, isDOCX, extractTextFromPPTX, isPPTX } from './docxParser'
import { chunkText, type TextChunk } from './chunker'
import { generateCards, type GeneratedCard } from './aiService'
import { saveDeck, type Deck } from './storage'

// Processing status updates
export type ProcessingStep = 'reading' | 'chunking' | 'summarizing' | 'designing' | 'saving' | 'complete' | 'error'

export interface ProcessingStatus {
  step: ProcessingStep
  progress: number // 0-100
  message: string
  error?: string
}

export interface ProcessingResult {
  success: boolean
  deckId?: string
  deck?: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount'>
  cards?: GeneratedCard[]
  error?: string
}

type StatusCallback = (status: ProcessingStatus) => void

/**
 * Process content and generate cards
 */
export async function processContent(
  content: {
    text?: string
    file?: File
    url?: string
  },
  onStatus?: StatusCallback
): Promise<ProcessingResult> {
  const updateStatus = (step: ProcessingStep, progress: number, message: string) => {
    onStatus?.({ step, progress, message })
  }

  try {
    // Step 1: Extract text
    updateStatus('reading', 10, 'Extracting text content...')
    
    let text = ''
    let sourceType: Deck['sourceType'] = 'text'
    let sourceName: string | undefined
    
    if (content.file) {
      const result = await extractTextFromFile(content.file)
      text = result.text
      sourceType = result.type
      sourceName = content.file.name
    } else if (content.url) {
      text = await extractTextFromURL(content.url)
      sourceType = 'url'
      sourceName = content.url
    } else if (content.text) {
      text = content.text
      sourceType = 'text'
    }
    
    if (!text || text.trim().length < 100) {
      throw new Error('Not enough content to generate cards. Please add more text.')
    }
    
    updateStatus('reading', 25, 'Text extraction complete')
    
    // Step 2: Chunk text
    updateStatus('chunking', 30, 'Breaking down complex topics...')
    
    const chunks = chunkText(text, {
      minWords: 100,
      maxWords: 250,
    })
    
    if (chunks.length === 0) {
      throw new Error('Could not identify meaningful sections in the content.')
    }
    
    updateStatus('chunking', 50, `Found ${chunks.length} topics`)
    
    // Step 3: Generate cards with AI
    updateStatus('summarizing', 55, 'Creating key points...')
    
    // Detect subject from content
    const subject = detectSubject(chunks)
    
    const aiResult = await generateCards(chunks, subject)
    
    updateStatus('summarizing', 75, 'Cards generated')
    
    // Step 4: Design cards (assign colors, validate)
    updateStatus('designing', 80, 'Styling your content...')
    
    const enhancedCards = enhanceCards(aiResult.cards, chunks)
    const colorTheme = selectColorTheme(subject)
    
    updateStatus('designing', 90, 'Almost done...')
    
    // Step 5: Save to storage
    updateStatus('saving', 95, 'Saving your deck...')
    
    const deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount'> = {
      title: aiResult.deckTitle,
      description: aiResult.deckDescription,
      tags: extractDeckTags(chunks),
      sourceType,
      sourceName,
      colorTheme,
    }
    
    const deckId = await saveDeck(deck, enhancedCards)
    
    updateStatus('complete', 100, 'Deck created successfully!')
    
    return {
      success: true,
      deckId,
      deck,
      cards: enhancedCards,
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    onStatus?.({ step: 'error', progress: 0, message, error: message })
    
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Extract text from a file based on its type
 */
async function extractTextFromFile(file: File): Promise<{ text: string; type: Deck['sourceType'] }> {
  if (isPDF(file)) {
    const result = await extractTextFromPDF(file)
    return { text: result.text, type: 'pdf' }
  }
  
  if (isDOCX(file)) {
    const result = await extractTextFromDOCX(file)
    return { text: result.text, type: 'docx' }
  }
  
  if (isPPTX(file)) {
    const text = await extractTextFromPPTX(file)
    return { text, type: 'pptx' }
  }
  
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    const text = await file.text()
    return { text, type: 'text' }
  }
  
  throw new Error(`Unsupported file type: ${file.type || file.name}`)
}

/**
 * Extract text from a URL (basic implementation)
 */
async function extractTextFromURL(url: string): Promise<string> {
  // Note: This requires a proxy/backend due to CORS
  // For MVP, we'll show a message to paste content instead
  
  try {
    // Try using a CORS proxy for simple pages
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const response = await fetch(proxyUrl)
    
    if (!response.ok) {
      throw new Error('Failed to fetch URL')
    }
    
    const html = await response.text()
    
    // Basic HTML to text conversion
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // Remove script and style elements
    doc.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove())
    
    // Get main content
    const main = doc.querySelector('main, article, .content, #content') || doc.body
    const text = main.textContent || ''
    
    return text.replace(/\s+/g, ' ').trim()
  } catch {
    throw new Error('Could not fetch content from URL. Please paste the text directly instead.')
  }
}

/**
 * Detect subject/topic from chunks
 */
function detectSubject(chunks: TextChunk[]): string {
  // Collect all keywords
  const allKeywords: Record<string, number> = {}
  
  for (const chunk of chunks) {
    for (const keyword of chunk.keywords) {
      allKeywords[keyword] = (allKeywords[keyword] || 0) + 1
    }
  }
  
  // Get top keywords
  const topKeywords = Object.entries(allKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1))
  
  return topKeywords.join(' & ') || 'Study Notes'
}

/**
 * Extract tags for the deck
 */
function extractDeckTags(chunks: TextChunk[]): string[] {
  const tagCounts: Record<string, number> = {}
  
  for (const chunk of chunks) {
    for (const keyword of chunk.keywords) {
      tagCounts[keyword] = (tagCounts[keyword] || 0) + 1
    }
  }
  
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag)
}

/**
 * Enhance cards with additional styling/metadata
 */
function enhanceCards(cards: GeneratedCard[], chunks: TextChunk[]): GeneratedCard[] {
  return cards.map((card, index) => {
    const chunk = chunks[index]
    
    // Ensure we have ghost words
    if (!card.ghostWords || card.ghostWords.length === 0) {
      card.ghostWords = chunk?.keywords.slice(0, 2) || []
    }
    
    // Ensure we have tags
    if (!card.tags || card.tags.length === 0) {
      card.tags = chunk?.keywords.slice(0, 3) || []
    }
    
    // Ensure bullet points are properly formatted
    card.bulletPoints = card.bulletPoints.map(bp => {
      // Capitalize first letter
      if (bp.length > 0) {
        return bp.charAt(0).toUpperCase() + bp.slice(1)
      }
      return bp
    }).filter(bp => bp.length > 0)
    
    return card
  })
}

/**
 * Select a color theme based on subject
 */
function selectColorTheme(subject: string): string {
  const lower = subject.toLowerCase()
  
  // Subject-based color themes
  const themes: Record<string, string> = {
    // Sciences
    biology: 'emerald',
    chemistry: 'purple',
    physics: 'blue',
    math: 'orange',
    science: 'teal',
    
    // Humanities
    history: 'amber',
    literature: 'rose',
    philosophy: 'violet',
    psychology: 'pink',
    
    // Business
    economics: 'green',
    business: 'slate',
    finance: 'emerald',
    marketing: 'fuchsia',
    
    // Tech
    programming: 'cyan',
    computer: 'indigo',
    technology: 'blue',
    
    // Languages
    english: 'red',
    spanish: 'yellow',
    french: 'blue',
    language: 'violet',
    
    // Default
    default: 'blue',
  }
  
  for (const [keyword, theme] of Object.entries(themes)) {
    if (lower.includes(keyword)) {
      return theme
    }
  }
  
  // Random theme from a curated list
  const defaultThemes = ['blue', 'emerald', 'violet', 'amber', 'rose', 'teal']
  return defaultThemes[Math.floor(Math.random() * defaultThemes.length)]
}

/**
 * Validate content before processing
 */
export function validateContent(content: {
  text?: string
  file?: File
  url?: string
}): { valid: boolean; error?: string } {
  if (!content.text && !content.file && !content.url) {
    return { valid: false, error: 'Please provide some content' }
  }
  
  if (content.text && content.text.length < 100) {
    return { valid: false, error: 'Please add more content (at least 100 characters)' }
  }
  
  if (content.text && content.text.length > 50000) {
    return { valid: false, error: 'Content is too long (max 50,000 characters)' }
  }
  
  if (content.file) {
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (content.file.size > maxSize) {
      return { valid: false, error: 'File is too large (max 10MB)' }
    }
    
    const validTypes = ['.pdf', '.docx', '.txt', '.pptx']
    const ext = '.' + content.file.name.split('.').pop()?.toLowerCase()
    if (!validTypes.includes(ext)) {
      return { valid: false, error: 'Unsupported file type' }
    }
  }
  
  if (content.url) {
    try {
      new URL(content.url)
    } catch {
      return { valid: false, error: 'Invalid URL format' }
    }
  }
  
  return { valid: true }
}
