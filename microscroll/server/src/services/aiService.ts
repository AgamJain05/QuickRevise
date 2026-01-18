import { config } from '../config/index.js';
import { createSemanticChunks, SemanticChunk, estimateCardCount } from './chunkerService.js';

// ===========================================
// AI Card Generation Service (Google Gemini)
// Micro-Learning Cards: TikTok-style scrollable
// ===========================================

// Gemini limits
export const GEMINI_LIMITS = {
  maxInputChars: 30000,
  maxOutputTokens: 8000,
  model: 'gemini-1.5-flash',
};

// Card configuration
export const CARD_CONFIG = {
  targetWords: 80,      // Ideal words per card
  minWords: 50,         // Minimum words
  maxWords: 150,        // Maximum words
  bulletsMax: 3,        // Max bullet points
  bulletMaxWords: 15,   // Max words per bullet
  headlineMaxWords: 8,  // Max headline words
};

export interface GeneratedCard {
  headline: string;
  detailParagraph: string;
  bulletPoints: string[];
  emoji: string;
  difficulty: 'easy' | 'medium' | 'hard';
  ghostWords: string[];
  eli5Version?: string;
  quizQuestion?: string;
  quizAnswer?: boolean;
  cardType: 'intro' | 'concept' | 'example' | 'definition' | 'list' | 'summary' | 'transition';
  transitionHint?: string;
  order: number;
}

// Optimized prompt for MICRO-LEARNING cards
const MICRO_CARD_PROMPT = `You are creating MICRO-LEARNING flashcards for a TikTok-style scrollable study app.

## CRITICAL RULES:

### Card Size (STRICT):
- Total card content: 50-150 words (target: 80-100)
- Headline: 5-8 words maximum
- Detail paragraph: 1-2 SHORT sentences (30-50 words)
- Bullet points: 2-3 points, each 10-15 words MAX

### Card Philosophy:
- ONE micro-concept per card (not a full topic!)
- Quick to read (5-10 seconds per card)
- Scrollable, bite-sized, TikTok-style
- Each card = 1 swipe of learning

### Content Guidelines:
- Be ULTRA CONCISE. Every word must earn its place.
- Use simple, clear language
- No filler words or redundancy
- Each card should be independently understandable

### Card Types:
- "intro": Opening card that sets context
- "concept": Core idea explanation
- "definition": Key term definition
- "example": Practical example or application
- "list": Enumerated points
- "summary": Recap of recent cards
- "transition": Bridge between topics

### Transitions:
- Add transitionHint to connect cards: "Building on this...", "Next up...", "Related to this..."
- Create narrative flow between cards

## RESPONSE FORMAT (JSON only):
{
  "cards": [
    {
      "headline": "Short Catchy Title",
      "detailParagraph": "One to two sentences explaining the micro-concept clearly and concisely.",
      "bulletPoints": ["Point 1 (max 15 words)", "Point 2", "Point 3"],
      "emoji": "📚",
      "difficulty": "medium",
      "ghostWords": ["term1", "term2"],
      "eli5Version": "Simple one-liner explanation.",
      "quizQuestion": "True/false statement about content.",
      "quizAnswer": true,
      "cardType": "concept",
      "transitionHint": "Next, we'll explore..."
    }
  ]
}`;

/**
 * Generate micro-learning cards from content
 */
export async function generateCardsFromContent(
  content: string,
  title?: string
): Promise<GeneratedCard[]> {
  // Trim content to Gemini limits
  const trimmedContent = content.slice(0, GEMINI_LIMITS.maxInputChars);
  
  // Create semantic chunks for better card generation
  const chunks = createSemanticChunks(trimmedContent);
  const expectedCards = estimateCardCount(trimmedContent);
  
  console.log(`📊 Content analysis: ${trimmedContent.split(/\s+/).length} words → expecting ${expectedCards} cards`);
  
  if (config.ai.geminiKey) {
    return generateWithGemini(chunks, title, expectedCards);
  }
  
  return generateDemoCards(chunks, title);
}

/**
 * Generate cards using Google Gemini API
 */
async function generateWithGemini(
  chunks: SemanticChunk[],
  title?: string,
  expectedCards?: number
): Promise<GeneratedCard[]> {
  if (!config.ai.geminiKey) {
    throw new Error('Gemini API key not configured');
  }

  // Build content from chunks
  const chunkedContent = chunks
    .filter(c => c.type !== 'summary' || !c.content.startsWith('[GENERATE'))
    .map((chunk, i) => {
      const typeHint = chunk.type !== 'concept' ? ` [${chunk.type.toUpperCase()}]` : '';
      return `[Chunk ${i + 1}${typeHint}]\n${chunk.content}`;
    })
    .join('\n\n');

  const prompt = `${MICRO_CARD_PROMPT}

## Content to Process:
Topic: ${title || 'Study Material'}
Expected cards: ${expectedCards || 'auto-determine based on content'}

---
${chunkedContent}
---

Generate micro-learning cards. Remember: MORE cards with LESS content each. Target 80-100 words per card.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_LIMITS.model}:generateContent?key=${config.ai.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: GEMINI_LIMITS.maxOutputTokens,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.cards && Array.isArray(parsed.cards)) {
        return parsed.cards.map((card: any, index: number) => ({
          headline: truncateWords(card.headline || 'Untitled', CARD_CONFIG.headlineMaxWords),
          detailParagraph: truncateWords(card.detailParagraph || '', 60),
          bulletPoints: (card.bulletPoints || [])
            .slice(0, CARD_CONFIG.bulletsMax)
            .map((b: string) => truncateWords(b, CARD_CONFIG.bulletMaxWords)),
          emoji: card.emoji || '📝',
          difficulty: card.difficulty || 'medium',
          ghostWords: (card.ghostWords || []).slice(0, 3),
          eli5Version: card.eli5Version || null,
          quizQuestion: card.quizQuestion || null,
          quizAnswer: typeof card.quizAnswer === 'boolean' ? card.quizAnswer : null,
          cardType: card.cardType || 'concept',
          transitionHint: card.transitionHint || null,
          order: index,
        }));
      }
    }
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', responseText);
  }

  // Fallback to demo if parsing fails
  return generateDemoCards(chunks);
}

/**
 * Demo mode - generate micro-cards without AI
 */
function generateDemoCards(chunks: SemanticChunk[], title?: string): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  
  // Add intro card
  if (title) {
    cards.push({
      headline: truncateWords(title, CARD_CONFIG.headlineMaxWords),
      detailParagraph: `Let's explore ${title}. Swipe through these cards to learn the key concepts.`,
      bulletPoints: ['Scroll to navigate', 'Tap for details', 'Track your progress'],
      emoji: '🎯',
      difficulty: 'easy',
      ghostWords: [],
      eli5Version: `We're going to learn about ${title}!`,
      cardType: 'intro',
      transitionHint: "Let's get started!",
      order: 0,
    });
  }

  // Generate cards from chunks
  for (const chunk of chunks) {
    // Skip summary placeholders
    if (chunk.content.startsWith('[GENERATE')) {
      // Generate actual summary card
      const recentCards = cards.slice(-5);
      const summaryContent = recentCards.map(c => c.headline).join(', ');
      
      cards.push({
        headline: '📋 Quick Recap',
        detailParagraph: `So far we've covered: ${summaryContent}.`,
        bulletPoints: recentCards.slice(0, 3).map(c => c.headline),
        emoji: '🔄',
        difficulty: 'easy',
        ghostWords: [],
        cardType: 'summary',
        transitionHint: 'Ready for more? Keep scrolling!',
        order: cards.length,
      });
      continue;
    }

    // Extract headline from first sentence
    const sentences = chunk.content.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const firstSentence = sentences[0]?.trim() || 'Key Point';
    const headline = truncateWords(firstSentence, CARD_CONFIG.headlineMaxWords);
    
    // Create concise detail (1-2 sentences, max 60 words)
    const detail = truncateWords(sentences.slice(0, 2).join('. '), 60);
    
    // Extract bullet points (short, punchy)
    const bulletPoints = sentences
      .slice(1, 4)
      .map(s => truncateWords(s.trim(), CARD_CONFIG.bulletMaxWords))
      .filter(s => s.length > 0)
      .slice(0, CARD_CONFIG.bulletsMax);

    // Ensure minimum bullets
    while (bulletPoints.length < 2 && chunk.keywords.length > bulletPoints.length) {
      bulletPoints.push(`Key: ${chunk.keywords[bulletPoints.length]}`);
    }

    // Determine emoji by type
    const emojiMap: Record<string, string> = {
      intro: '👋',
      concept: '💡',
      definition: '📖',
      example: '🔍',
      list: '📋',
      summary: '🔄',
      transition: '➡️',
    };

    // Add transition hints
    const transitions = [
      'Building on this...',
      'Next up...',
      'Related concept...',
      'Keep scrolling...',
      'More to explore...',
      "Here's another key point...",
    ];

    cards.push({
      headline,
      detailParagraph: detail,
      bulletPoints,
      emoji: emojiMap[chunk.type] || '📝',
      difficulty: chunk.wordCount > 100 ? 'hard' : chunk.wordCount > 60 ? 'medium' : 'easy',
      ghostWords: chunk.keywords.slice(0, 3),
      eli5Version: `Simply put: ${truncateWords(firstSentence, 10)}.`,
      quizQuestion: `This covers ${chunk.keywords[0] || 'this topic'}.`,
      quizAnswer: true,
      cardType: chunk.type,
      transitionHint: transitions[cards.length % transitions.length],
      order: cards.length,
    });
  }

  return cards;
}

/**
 * Truncate text to max words
 */
function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Get available provider
 */
export function getAvailableProvider(): 'gemini' | 'demo' {
  if (config.ai.geminiKey) return 'gemini';
  return 'demo';
}

/**
 * Legacy function for backward compatibility
 */
export async function generateCards(
  chunks: string[],
  _provider: 'gemini' | 'demo' = 'demo'
): Promise<GeneratedCard[]> {
  const content = chunks.join('\n\n');
  return generateCardsFromContent(content);
}
