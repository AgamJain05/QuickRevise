/**
 * AI Integration Service
 * 
 * Handles communication with AI providers (Google Gemini) for:
 * - Content summarization
 * - Card generation
 * - ELI5 simplification
 * - Quiz question generation
 * 
 * Note: For production, use the server API (/api/process/text) instead
 * of client-side AI calls to protect API keys.
 */

import type { TextChunk } from './chunker'

// Content limits (matches server)
export const CONTENT_LIMITS = {
  maxChars: 30000,
  maxCharsFormatted: '30,000',
  approximatePages: 15,
  approximateWords: 5000,
}

// Types
export interface GeneratedCard {
  id: string
  headline: string
  detailParagraph: string
  bulletPoints: string[]
  emoji: string
  tags: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  ghostWords: string[]
  eli5Version?: string
  quizQuestion?: {
    question: string
    correctAnswer: boolean
    explanation: string
  }
}

export interface AIConfig {
  provider: 'gemini' | 'demo'
  apiKey?: string
  model?: string
}

interface AIResponse {
  cards: GeneratedCard[]
  deckTitle: string
  deckDescription: string
}

// Default configuration uses demo mode (no API key required)
let currentConfig: AIConfig = {
  provider: 'demo',
}

/**
 * Configure the AI service
 */
export function configureAI(config: AIConfig): void {
  currentConfig = config
}

/**
 * Generate cards from text chunks
 */
export async function generateCards(
  chunks: TextChunk[],
  subject?: string
): Promise<AIResponse> {
  if (currentConfig.provider === 'demo') {
    return generateDemoCards(chunks, subject)
  }
  
  if (currentConfig.provider === 'gemini') {
    return generateGeminiCards(chunks, subject)
  }
  
  throw new Error(`Unknown AI provider: ${currentConfig.provider}`)
}

/**
 * Generate ELI5 (Explain Like I'm 5) version of content
 */
export async function generateELI5(content: string): Promise<string> {
  if (currentConfig.provider === 'demo') {
    return generateDemoELI5(content)
  }
  
  const prompt = `Explain this concept as if you're talking to a 12-year-old. Use simple words, everyday analogies, and relatable examples. Keep the core meaning accurate but make it easy to understand:

${content}

Simplified explanation:`
  
  return callGemini(prompt)
}

/**
 * Generate a quiz question from card content
 */
export async function generateQuizQuestion(card: GeneratedCard): Promise<{
  question: string
  correctAnswer: boolean
  explanation: string
}> {
  if (currentConfig.provider === 'demo') {
    return generateDemoQuizQuestion(card)
  }
  
  const prompt = `Based on this learning content, create a True/False question:

Headline: ${card.headline}
Content: ${card.detailParagraph}
Key points: ${card.bulletPoints.join(', ')}

Generate a question that tests understanding (not just memorization).
Format your response as JSON only: { "question": "...", "correctAnswer": true/false, "explanation": "..." }`

  const response = await callGemini(prompt)
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Failed to parse quiz response:', e)
  }
  
  return generateDemoQuizQuestion(card)
}

// ============================================
// Demo Mode Implementation (No API Required)
// ============================================

/**
 * Generate demo cards without API calls
 */
async function generateDemoCards(chunks: TextChunk[], subject?: string): Promise<AIResponse> {
  // Simulate processing delay
  await delay(500)
  
  const cards: GeneratedCard[] = chunks.map((chunk, index) => {
    // Extract a headline from the first sentence or keywords
    const headline = generateHeadline(chunk)
    
    // Create detail paragraph
    const detailParagraph = chunk.sentences.slice(0, 2).join(' ')
    
    // Extract bullet points
    const bulletPoints = extractBulletPoints(chunk)
    
    // Select emoji based on content type
    const emoji = getEmojiForType(chunk.type)
    
    // Generate ghost words (important terms to hide)
    const ghostWords = chunk.keywords.slice(0, 2)
    
    return {
      id: `card-${index + 1}`,
      headline,
      detailParagraph,
      bulletPoints,
      emoji,
      tags: chunk.keywords.slice(0, 3),
      difficulty: estimateCardDifficulty(chunk),
      ghostWords,
    }
  })
  
  return {
    cards,
    deckTitle: subject || 'Study Deck',
    deckDescription: `${cards.length} cards generated from your content`,
  }
}

/**
 * Generate a headline from chunk content
 */
function generateHeadline(chunk: TextChunk): string {
  // Try to extract a meaningful headline from the content
  const firstSentence = chunk.sentences[0] || ''
  
  // If it looks like a definition, extract the term being defined
  const definitionMatch = firstSentence.match(/^(.+?)\s+(?:is|are|refers to|means)/i)
  if (definitionMatch) {
    return definitionMatch[1].trim()
  }
  
  // Use keywords to form a headline
  if (chunk.keywords.length >= 2) {
    return chunk.keywords.slice(0, 3).map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' & ')
  }
  
  // Fallback: truncate first sentence
  const words = firstSentence.split(' ').slice(0, 6)
  return words.join(' ') + (words.length < firstSentence.split(' ').length ? '...' : '')
}

/**
 * Extract bullet points from chunk
 */
function extractBulletPoints(chunk: TextChunk): string[] {
  const points: string[] = []
  
  for (const sentence of chunk.sentences) {
    // Skip very short sentences
    if (sentence.split(' ').length < 5) continue
    
    // Limit to 5 bullet points
    if (points.length >= 5) break
    
    // Truncate long sentences
    const words = sentence.split(' ')
    if (words.length > 20) {
      points.push(words.slice(0, 18).join(' ') + '...')
    } else {
      points.push(sentence)
    }
  }
  
  // Ensure at least 3 bullet points
  while (points.length < 3 && chunk.keywords.length > points.length) {
    points.push(`Key concept: ${chunk.keywords[points.length]}`)
  }
  
  return points.slice(0, 5)
}

/**
 * Get emoji for content type
 */
function getEmojiForType(type: TextChunk['type']): string {
  const emojis: Record<TextChunk['type'], string> = {
    definition: '📖',
    example: '💡',
    process: '🔄',
    comparison: '⚖️',
    concept: '🧠',
    general: '📝',
  }
  return emojis[type]
}

/**
 * Estimate card difficulty
 */
function estimateCardDifficulty(chunk: TextChunk): 'easy' | 'medium' | 'hard' {
  const avgSentenceLength = chunk.wordCount / chunk.sentences.length
  if (avgSentenceLength > 25) return 'hard'
  if (avgSentenceLength > 15) return 'medium'
  return 'easy'
}

/**
 * Generate demo ELI5 version
 */
async function generateDemoELI5(content: string): Promise<string> {
  await delay(300)
  
  // Simple transformations for demo
  let simplified = content
    // Replace complex words with simpler alternatives
    .replace(/\butilize\b/gi, 'use')
    .replace(/\bfacilitate\b/gi, 'help')
    .replace(/\bimplement\b/gi, 'do')
    .replace(/\bdemonstrate\b/gi, 'show')
    .replace(/\bsubsequently\b/gi, 'then')
    .replace(/\bfurthermore\b/gi, 'also')
    .replace(/\bconsequently\b/gi, 'so')
    .replace(/\bnevertheless\b/gi, 'but')
    .replace(/\bapproximate(ly)?\b/gi, 'about')
    .replace(/\bsufficient\b/gi, 'enough')
  
  // Add a friendly intro
  return `Think of it like this: ${simplified}`
}

/**
 * Generate demo quiz question
 */
async function generateDemoQuizQuestion(card: GeneratedCard): Promise<{
  question: string
  correctAnswer: boolean
  explanation: string
}> {
  await delay(200)
  
  // Create a simple True/False question from the headline
  const isTrue = Math.random() > 0.5
  
  if (isTrue) {
    return {
      question: `${card.headline} is described in this content.`,
      correctAnswer: true,
      explanation: card.detailParagraph,
    }
  } else {
    return {
      question: `${card.headline} is NOT a key concept covered here.`,
      correctAnswer: false,
      explanation: `Actually, ${card.headline} IS covered. ${card.bulletPoints[0]}`,
    }
  }
}

// ============================================
// Google Gemini API Implementation
// ============================================

/**
 * Call Google Gemini API
 */
async function callGemini(prompt: string): Promise<string> {
  if (!currentConfig.apiKey) {
    throw new Error('Gemini API key not configured')
  }
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${currentConfig.model || 'gemini-1.5-flash'}:generateContent?key=${currentConfig.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    }
  )
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

/**
 * Generate cards using Gemini
 */
async function generateGeminiCards(chunks: TextChunk[], subject?: string): Promise<AIResponse> {
  const prompt = buildCardGenerationPrompt(chunks, subject)
  const response = await callGemini(prompt)
  return parseCardResponse(response, chunks.length)
}

/**
 * Build the prompt for card generation - CONCISE cards
 */
function buildCardGenerationPrompt(chunks: TextChunk[], subject?: string): string {
  const chunksText = chunks.map((c, i) => `
Chunk ${i + 1}:
${c.content}
`).join('\n')
  
  return `You are creating CONCISE microlearning flashcards.

RULES FOR EACH CARD:
1. headline: Maximum 8 words. Clear, memorable title.
2. detailParagraph: EXACTLY 2-3 sentences (40-60 words MAX). Core concept only.
3. bulletPoints: 3 points maximum, each under 12 words.
4. emoji: One relevant emoji.
5. tags: 2-3 topic keywords.
6. difficulty: "easy", "medium", or "hard".
7. ghostWords: 2-3 key terms (single words only).

IMPORTANT:
- Be CONCISE. No fluff or filler words.
- Each card = ONE concept only.
- Use simple, clear language.

Subject: ${subject || 'General'}

Content:
${chunksText}

Respond in JSON format ONLY:
{
  "deckTitle": "Short Title",
  "deckDescription": "Brief description",
  "cards": [{ "headline": "...", "detailParagraph": "...", "bulletPoints": ["...", "...", "..."], "emoji": "...", "tags": [...], "difficulty": "...", "ghostWords": [...] }]
}`
}

/**
 * Parse AI response into structured cards
 */
function parseCardResponse(response: string, expectedCount: number): AIResponse {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        deckTitle: parsed.deckTitle || 'Study Deck',
        deckDescription: parsed.deckDescription || '',
        cards: parsed.cards.map((card: any, i: number) => ({
          id: `card-${i + 1}`,
          headline: card.headline || `Card ${i + 1}`,
          detailParagraph: card.detailParagraph || '',
          bulletPoints: card.bulletPoints || [],
          emoji: card.emoji || '📝',
          tags: card.tags || [],
          difficulty: card.difficulty || 'medium',
          ghostWords: card.ghostWords || [],
        })),
      }
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e)
  }
  
  // Fallback response
  return {
    deckTitle: 'Study Deck',
    deckDescription: 'Cards generated from your content',
    cards: Array(expectedCount).fill(null).map((_, i) => ({
      id: `card-${i + 1}`,
      headline: `Card ${i + 1}`,
      detailParagraph: 'Content processing incomplete',
      bulletPoints: ['Review original content'],
      emoji: '📝',
      tags: [],
      difficulty: 'medium' as const,
      ghostWords: [],
    })),
  }
}

// ============================================
// Utilities
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if AI service is configured with an API key
 */
export function isAIConfigured(): boolean {
  return currentConfig.provider === 'demo' || !!currentConfig.apiKey
}

/**
 * Get current AI provider
 */
export function getCurrentProvider(): AIConfig['provider'] {
  return currentConfig.provider
}
