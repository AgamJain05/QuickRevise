/**
 * Enhanced Ghost Words - POS Tagging & Term Detection
 * 
 * PRD F5a: Automatically identify key terms for cloze deletion
 * 
 * Features:
 * - Rule-based POS tagging (no external NLP libraries)
 * - Technical term detection
 * - Capitalized term identification
 * - Importance scoring
 * - Context-aware selection
 */

export interface GhostWordCandidate {
  word: string
  position: number
  importance: number
  type: 'noun' | 'verb' | 'adjective' | 'technical' | 'proper' | 'number'
  context: string
}

export interface GhostWordResult {
  words: string[]
  candidates: GhostWordCandidate[]
}

/**
 * Extract ghost words from text
 * Returns 1-2 most important terms per content block
 */
export function extractGhostWords(text: string, maxWords: number = 2): GhostWordResult {
  const candidates = identifyCandidates(text)
  const ranked = rankCandidates(candidates, text)
  const selected = selectBestWords(ranked, maxWords)
  
  return {
    words: selected.map(c => c.word),
    candidates: ranked,
  }
}

/**
 * Identify candidate words using rule-based patterns
 */
function identifyCandidates(text: string): GhostWordCandidate[] {
  const candidates: GhostWordCandidate[] = []
  const words = tokenize(text)
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const cleanWord = word.replace(/[^a-zA-Z0-9-]/g, '')
    
    if (cleanWord.length < 3) continue
    if (isStopWord(cleanWord.toLowerCase())) continue
    
    const type = classifyWord(cleanWord, words, i)
    if (!type) continue
    
    const importance = calculateImportance(cleanWord, type, words, i)
    const context = getContext(words, i, 3)
    
    candidates.push({
      word: cleanWord,
      position: i,
      importance,
      type,
      context,
    })
  }
  
  return candidates
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0)
}

/**
 * Classify word type using rule-based patterns
 */
function classifyWord(
  word: string, 
  context: string[], 
  position: number
): GhostWordCandidate['type'] | null {
  // Proper nouns (capitalized, not at sentence start)
  if (isProperNoun(word, context, position)) {
    return 'proper'
  }
  
  // Technical terms (camelCase, contains numbers, has special patterns)
  if (isTechnicalTerm(word)) {
    return 'technical'
  }
  
  // Numbers with units
  if (isNumberWithUnit(word)) {
    return 'number'
  }
  
  // Verb patterns
  if (isLikelyVerb(word, context, position)) {
    return 'verb'
  }
  
  // Adjective patterns
  if (isLikelyAdjective(word, context, position)) {
    return 'adjective'
  }
  
  // Noun patterns (default for content words)
  if (isLikelyNoun(word, context, position)) {
    return 'noun'
  }
  
  return null
}

/**
 * Check if word is a proper noun
 */
function isProperNoun(word: string, context: string[], position: number): boolean {
  // Must start with capital letter
  if (!/^[A-Z]/.test(word)) return false
  
  // Not at the start of a sentence
  if (position === 0) return false
  
  const prevWord = context[position - 1]
  if (prevWord && /[.!?]$/.test(prevWord)) return false
  
  // All caps is often an acronym
  if (word === word.toUpperCase() && word.length <= 5) return true
  
  // Capitalized in middle of sentence
  return true
}

/**
 * Check if word is a technical term
 */
function isTechnicalTerm(word: string): boolean {
  // camelCase or PascalCase
  if (/[a-z][A-Z]/.test(word)) return true
  
  // Contains numbers mixed with letters
  if (/[a-zA-Z]\d|\d[a-zA-Z]/.test(word)) return true
  
  // Common technical suffixes
  const techSuffixes = [
    'tion', 'sion', 'ment', 'ness', 'ity', 'ology', 'osis', 'itis',
    'ism', 'ist', 'ase', 'ide', 'ate', 'ine', 'oid', 'oma'
  ]
  for (const suffix of techSuffixes) {
    if (word.toLowerCase().endsWith(suffix) && word.length > suffix.length + 2) {
      return true
    }
  }
  
  // Common technical prefixes
  const techPrefixes = [
    'bio', 'geo', 'hydro', 'thermo', 'electro', 'neuro', 'cardio',
    'photo', 'auto', 'micro', 'macro', 'poly', 'mono', 'multi'
  ]
  for (const prefix of techPrefixes) {
    if (word.toLowerCase().startsWith(prefix) && word.length > prefix.length + 2) {
      return true
    }
  }
  
  return false
}

/**
 * Check if word is a number with unit
 */
function isNumberWithUnit(word: string): boolean {
  return /^\d+[a-zA-Z]+$/.test(word) || /^[a-zA-Z]+\d+$/.test(word)
}

/**
 * Check if word is likely a verb
 */
function isLikelyVerb(word: string, context: string[], position: number): boolean {
  const lower = word.toLowerCase()
  
  // Common verb endings
  const verbEndings = ['ing', 'ed', 'es', 'ify', 'ize', 'ate']
  for (const ending of verbEndings) {
    if (lower.endsWith(ending) && lower.length > ending.length + 2) {
      // Check context - verbs often follow subjects
      const prevWord = context[position - 1]?.toLowerCase()
      if (prevWord && ['it', 'they', 'we', 'you', 'he', 'she', 'that', 'which', 'who'].includes(prevWord)) {
        return true
      }
      // -ing words are often verbs or gerunds
      if (lower.endsWith('ing')) return true
    }
  }
  
  // After "to" is infinitive
  const prevWord = context[position - 1]?.toLowerCase()
  if (prevWord === 'to') return true
  
  return false
}

/**
 * Check if word is likely an adjective
 */
function isLikelyAdjective(word: string, context: string[], position: number): boolean {
  const lower = word.toLowerCase()
  
  // Common adjective endings
  const adjEndings = ['ful', 'less', 'able', 'ible', 'ous', 'ive', 'al', 'ical', 'ary', 'ory']
  for (const ending of adjEndings) {
    if (lower.endsWith(ending) && lower.length > ending.length + 2) {
      return true
    }
  }
  
  // Before nouns
  const nextWord = context[position + 1]
  if (nextWord && isLikelyNoun(nextWord, context, position + 1)) {
    return true
  }
  
  // After "very", "more", "most", "quite"
  const prevWord = context[position - 1]?.toLowerCase()
  if (prevWord && ['very', 'more', 'most', 'quite', 'rather', 'extremely'].includes(prevWord)) {
    return true
  }
  
  return false
}

/**
 * Check if word is likely a noun
 */
function isLikelyNoun(word: string, context: string[], position: number): boolean {
  const lower = word.toLowerCase()
  
  // Common noun endings
  const nounEndings = ['tion', 'sion', 'ment', 'ness', 'ity', 'ance', 'ence', 'er', 'or', 'ist', 'ism']
  for (const ending of nounEndings) {
    if (lower.endsWith(ending) && lower.length > ending.length + 2) {
      return true
    }
  }
  
  // After articles or determiners
  const prevWord = context[position - 1]?.toLowerCase()
  if (prevWord && ['a', 'an', 'the', 'this', 'that', 'these', 'those', 'each', 'every'].includes(prevWord)) {
    return true
  }
  
  // After adjectives (simplified check)
  if (prevWord && isLikelyAdjective(prevWord, context, position - 1)) {
    return true
  }
  
  // Capitalized word not at sentence start
  if (/^[A-Z]/.test(word) && position > 0) {
    return true
  }
  
  // Default: content words are often nouns
  return !isStopWord(lower) && lower.length >= 4
}

/**
 * Calculate importance score for a candidate
 */
function calculateImportance(
  word: string, 
  type: GhostWordCandidate['type'],
  context: string[],
  position: number
): number {
  let score = 0
  
  // Base score by type
  const typeScores: Record<GhostWordCandidate['type'], number> = {
    technical: 10,
    proper: 8,
    noun: 6,
    verb: 4,
    adjective: 3,
    number: 7,
  }
  score += typeScores[type]
  
  // Longer words are often more important
  score += Math.min(word.length - 3, 5)
  
  // Capitalized words get bonus
  if (/^[A-Z]/.test(word)) score += 2
  
  // Words in definitions get bonus
  const prevWords = context.slice(Math.max(0, position - 5), position).join(' ').toLowerCase()
  if (prevWords.includes('is defined as') || prevWords.includes('refers to') || prevWords.includes('means')) {
    score += 5
  }
  
  // Key position (near beginning of sentence)
  if (position < 10) score += 2
  
  // Rare word bonus (not in common words list)
  if (!isCommonWord(word.toLowerCase())) score += 3
  
  return score
}

/**
 * Rank candidates by importance
 */
function rankCandidates(candidates: GhostWordCandidate[], text: string): GhostWordCandidate[] {
  // Calculate term frequency
  const freq: Record<string, number> = {}
  const lower = text.toLowerCase()
  
  for (const candidate of candidates) {
    const wordLower = candidate.word.toLowerCase()
    const regex = new RegExp(`\\b${wordLower}\\b`, 'gi')
    const matches = lower.match(regex)
    freq[wordLower] = matches ? matches.length : 0
  }
  
  // Adjust importance by frequency (moderate frequency is best)
  return candidates
    .map(c => {
      const f = freq[c.word.toLowerCase()] || 0
      // Moderate frequency (2-3) is ideal for ghost words
      const freqBonus = f === 1 ? 1 : f <= 3 ? 2 : f <= 5 ? 1 : 0
      return { ...c, importance: c.importance + freqBonus }
    })
    .sort((a, b) => b.importance - a.importance)
}

/**
 * Select best words avoiding duplicates and nearby selections
 */
function selectBestWords(
  candidates: GhostWordCandidate[], 
  maxWords: number
): GhostWordCandidate[] {
  const selected: GhostWordCandidate[] = []
  const usedWords = new Set<string>()
  const usedPositions = new Set<number>()
  
  for (const candidate of candidates) {
    if (selected.length >= maxWords) break
    
    const wordLower = candidate.word.toLowerCase()
    
    // Skip if word already selected
    if (usedWords.has(wordLower)) continue
    
    // Skip if too close to another selection
    let tooClose = false
    for (const pos of usedPositions) {
      if (Math.abs(pos - candidate.position) < 5) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue
    
    selected.push(candidate)
    usedWords.add(wordLower)
    usedPositions.add(candidate.position)
  }
  
  return selected
}

/**
 * Get context around a position
 */
function getContext(words: string[], position: number, radius: number): string {
  const start = Math.max(0, position - radius)
  const end = Math.min(words.length, position + radius + 1)
  return words.slice(start, end).join(' ')
}

/**
 * Check if word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    // Articles
    'a', 'an', 'the',
    // Pronouns
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
    'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    // Prepositions
    'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'to', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
    // Conjunctions
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    // Auxiliary verbs
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
    // Common words
    'the', 'of', 'and', 'to', 'in', 'is', 'it', 'that', 'was', 'for',
    'on', 'are', 'as', 'with', 'his', 'they', 'be', 'at', 'one', 'have',
    'this', 'from', 'or', 'had', 'by', 'not', 'but', 'some', 'what',
    'there', 'we', 'can', 'out', 'other', 'were', 'all', 'your', 'when',
    'use', 'how', 'each', 'she', 'which', 'their', 'if', 'will', 'way',
    'about', 'many', 'then', 'them', 'would', 'like', 'so', 'these',
    // Very common
    'also', 'just', 'only', 'more', 'very', 'much', 'such', 'than',
    'most', 'any', 'same', 'another', 'own', 'well', 'even', 'where',
    'here', 'why', 'now', 'new', 'used', 'called', 'made', 'find',
  ])
  
  return stopWords.has(word)
}

/**
 * Check if word is very common
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'time', 'year', 'people', 'way', 'day', 'man', 'thing', 'woman',
    'life', 'child', 'world', 'school', 'state', 'family', 'student',
    'group', 'country', 'problem', 'hand', 'part', 'place', 'case',
    'week', 'company', 'system', 'program', 'question', 'work', 'government',
    'number', 'night', 'point', 'home', 'water', 'room', 'mother', 'area',
    'money', 'story', 'fact', 'month', 'lot', 'right', 'study', 'book',
    'eye', 'job', 'word', 'business', 'issue', 'side', 'kind', 'head',
    'house', 'service', 'friend', 'father', 'power', 'hour', 'game',
    'line', 'end', 'member', 'law', 'car', 'city', 'community', 'name',
  ])
  
  return commonWords.has(word)
}

/**
 * Detect ghost words in a card's content
 */
export function detectGhostWordsForCard(
  headline: string,
  detailParagraph: string,
  bulletPoints: string[]
): string[] {
  // Combine all content with weights
  const allText = [
    headline,
    detailParagraph,
    ...bulletPoints
  ].join(' ')
  
  const result = extractGhostWords(allText, 2)
  
  // Filter to ensure ghost words appear in actual content
  return result.words.filter(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    return bulletPoints.some(bp => regex.test(bp)) || regex.test(detailParagraph)
  })
}
