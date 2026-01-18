/**
 * IndexedDB Storage for Decks and Cards
 * 
 * Handles persistent storage of user-generated decks and study progress.
 */

import type { GeneratedCard } from './aiService'

// Database configuration
const DB_NAME = 'microscroll_db'
const DB_VERSION = 1

// Store names
const STORES = {
  DECKS: 'decks',
  CARDS: 'cards',
  PROGRESS: 'progress',
  SETTINGS: 'settings',
} as const

// Types
export interface Deck {
  id: string
  title: string
  description: string
  tags: string[]
  cardCount: number
  createdAt: Date
  updatedAt: Date
  sourceType: 'text' | 'pdf' | 'docx' | 'url' | 'pptx'
  sourceName?: string
  colorTheme: string
  coverImage?: string
}

export interface StoredCard extends GeneratedCard {
  deckId: string
  order: number
  createdAt: Date
}

export interface CardProgress {
  cardId: string
  deckId: string
  lastReviewed?: Date
  reviewCount: number
  correctCount: number
  masteryLevel: number // 0-100
  nextReviewDate?: Date
  ghostWordsRevealed: string[]
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  aiProvider: 'demo' | 'openai' | 'claude'
  apiKey?: string
  dailyGoal: number
  soundEnabled: boolean
}

// Database instance
let db: IDBDatabase | null = null

/**
 * Initialize the database
 */
export async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    
    request.onsuccess = () => {
      db = request.result
      resolve()
    }
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      
      // Create decks store
      if (!database.objectStoreNames.contains(STORES.DECKS)) {
        const decksStore = database.createObjectStore(STORES.DECKS, { keyPath: 'id' })
        decksStore.createIndex('createdAt', 'createdAt', { unique: false })
        decksStore.createIndex('title', 'title', { unique: false })
      }
      
      // Create cards store
      if (!database.objectStoreNames.contains(STORES.CARDS)) {
        const cardsStore = database.createObjectStore(STORES.CARDS, { keyPath: 'id' })
        cardsStore.createIndex('deckId', 'deckId', { unique: false })
        cardsStore.createIndex('order', ['deckId', 'order'], { unique: false })
      }
      
      // Create progress store
      if (!database.objectStoreNames.contains(STORES.PROGRESS)) {
        const progressStore = database.createObjectStore(STORES.PROGRESS, { keyPath: 'cardId' })
        progressStore.createIndex('deckId', 'deckId', { unique: false })
        progressStore.createIndex('nextReviewDate', 'nextReviewDate', { unique: false })
      }
      
      // Create settings store
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
      }
    }
  })
}

/**
 * Ensure database is initialized
 */
async function ensureDB(): Promise<IDBDatabase> {
  if (!db) {
    await initDB()
  }
  return db!
}

// ============================================
// Deck Operations
// ============================================

/**
 * Save a new deck with its cards
 */
export async function saveDeck(
  deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount'>,
  cards: GeneratedCard[]
): Promise<string> {
  const database = await ensureDB()
  const deckId = generateId()
  const now = new Date()
  
  const fullDeck: Deck = {
    ...deck,
    id: deckId,
    cardCount: cards.length,
    createdAt: now,
    updatedAt: now,
  }
  
  const storedCards: StoredCard[] = cards.map((card, index) => ({
    ...card,
    id: `${deckId}-${card.id}`,
    deckId,
    order: index,
    createdAt: now,
  }))
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.DECKS, STORES.CARDS], 'readwrite')
    
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve(deckId)
    
    // Save deck
    transaction.objectStore(STORES.DECKS).add(fullDeck)
    
    // Save cards
    const cardsStore = transaction.objectStore(STORES.CARDS)
    for (const card of storedCards) {
      cardsStore.add(card)
    }
  })
}

/**
 * Get all decks
 */
export async function getAllDecks(): Promise<Deck[]> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.DECKS, 'readonly')
    const store = transaction.objectStore(STORES.DECKS)
    const index = store.index('createdAt')
    const request = index.getAll()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      // Sort by most recent first
      const decks = request.result.reverse()
      resolve(decks)
    }
  })
}

/**
 * Get a single deck by ID
 */
export async function getDeck(deckId: string): Promise<Deck | null> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.DECKS, 'readonly')
    const request = transaction.objectStore(STORES.DECKS).get(deckId)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * Delete a deck and its cards
 */
export async function deleteDeck(deckId: string): Promise<void> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.DECKS, STORES.CARDS, STORES.PROGRESS],
      'readwrite'
    )
    
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()
    
    // Delete deck
    transaction.objectStore(STORES.DECKS).delete(deckId)
    
    // Delete cards for this deck
    const cardsStore = transaction.objectStore(STORES.CARDS)
    const cardsIndex = cardsStore.index('deckId')
    const cardsRequest = cardsIndex.openCursor(IDBKeyRange.only(deckId))
    
    cardsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    
    // Delete progress for this deck
    const progressStore = transaction.objectStore(STORES.PROGRESS)
    const progressIndex = progressStore.index('deckId')
    const progressRequest = progressIndex.openCursor(IDBKeyRange.only(deckId))
    
    progressRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
  })
}

// ============================================
// Card Operations
// ============================================

/**
 * Get all cards for a deck
 */
export async function getCardsForDeck(deckId: string): Promise<StoredCard[]> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CARDS, 'readonly')
    const store = transaction.objectStore(STORES.CARDS)
    const index = store.index('deckId')
    const request = index.getAll(IDBKeyRange.only(deckId))
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      // Sort by order
      const cards = request.result.sort((a, b) => a.order - b.order)
      resolve(cards)
    }
  })
}

/**
 * Update a card
 */
export async function updateCard(card: StoredCard): Promise<void> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CARDS, 'readwrite')
    const request = transaction.objectStore(STORES.CARDS).put(card)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ============================================
// Progress Operations
// ============================================

/**
 * Get or create progress for a card
 */
export async function getCardProgress(cardId: string, deckId: string): Promise<CardProgress> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.PROGRESS, 'readonly')
    const request = transaction.objectStore(STORES.PROGRESS).get(cardId)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result)
      } else {
        // Return default progress
        resolve({
          cardId,
          deckId,
          reviewCount: 0,
          correctCount: 0,
          masteryLevel: 0,
          ghostWordsRevealed: [],
        })
      }
    }
  })
}

/**
 * Update card progress after review
 */
export async function updateCardProgress(
  progress: CardProgress,
  wasCorrect: boolean
): Promise<void> {
  const database = await ensureDB()
  
  // Update progress values
  progress.reviewCount += 1
  progress.lastReviewed = new Date()
  
  if (wasCorrect) {
    progress.correctCount += 1
    // Increase mastery (diminishing returns)
    progress.masteryLevel = Math.min(100, progress.masteryLevel + (100 - progress.masteryLevel) * 0.2)
  } else {
    // Decrease mastery on wrong answer
    progress.masteryLevel = Math.max(0, progress.masteryLevel - 10)
  }
  
  // Calculate next review date using SM-2 like algorithm
  const daysUntilReview = calculateNextReviewDays(progress.masteryLevel)
  progress.nextReviewDate = new Date(Date.now() + daysUntilReview * 24 * 60 * 60 * 1000)
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.PROGRESS, 'readwrite')
    const request = transaction.objectStore(STORES.PROGRESS).put(progress)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get cards due for review
 */
export async function getCardsForReview(limit: number = 20): Promise<CardProgress[]> {
  const database = await ensureDB()
  const now = new Date()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.PROGRESS, 'readonly')
    const store = transaction.objectStore(STORES.PROGRESS)
    const index = store.index('nextReviewDate')
    const range = IDBKeyRange.upperBound(now)
    const request = index.getAll(range, limit)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Calculate days until next review based on mastery
 */
function calculateNextReviewDays(masteryLevel: number): number {
  // SM-2 inspired intervals
  if (masteryLevel < 20) return 1
  if (masteryLevel < 40) return 2
  if (masteryLevel < 60) return 4
  if (masteryLevel < 80) return 7
  if (masteryLevel < 90) return 14
  return 30
}

// ============================================
// Settings Operations
// ============================================

/**
 * Get user settings
 */
export async function getSettings(): Promise<UserSettings> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SETTINGS, 'readonly')
    const request = transaction.objectStore(STORES.SETTINGS).get('user_settings')
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.value)
      } else {
        // Return defaults
        resolve({
          theme: 'system',
          aiProvider: 'demo',
          dailyGoal: 20,
          soundEnabled: true,
        })
      }
    }
  })
}

/**
 * Save user settings
 */
export async function saveSettings(settings: UserSettings): Promise<void> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SETTINGS, 'readwrite')
    const request = transaction.objectStore(STORES.SETTINGS).put({
      key: 'user_settings',
      value: settings,
    })
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ============================================
// Statistics
// ============================================

/**
 * Get study statistics
 */
export async function getStudyStats(): Promise<{
  totalDecks: number
  totalCards: number
  cardsReviewed: number
  averageMastery: number
  streak: number
}> {
  const database = await ensureDB()
  
  const decks = await getAllDecks()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.PROGRESS, 'readonly')
    const request = transaction.objectStore(STORES.PROGRESS).getAll()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const progressRecords: CardProgress[] = request.result
      
      const cardsReviewed = progressRecords.filter(p => p.reviewCount > 0).length
      const totalMastery = progressRecords.reduce((sum, p) => sum + p.masteryLevel, 0)
      const averageMastery = progressRecords.length > 0 
        ? Math.round(totalMastery / progressRecords.length)
        : 0
      
      // Calculate streak (days in a row with reviews)
      const streak = calculateStreak(progressRecords)
      
      resolve({
        totalDecks: decks.length,
        totalCards: decks.reduce((sum, d) => sum + d.cardCount, 0),
        cardsReviewed,
        averageMastery,
        streak,
      })
    }
  })
}

/**
 * Calculate current study streak
 */
function calculateStreak(progressRecords: CardProgress[]): number {
  if (progressRecords.length === 0) return 0
  
  // Get unique review dates
  const reviewDates = new Set<string>()
  for (const p of progressRecords) {
    if (p.lastReviewed) {
      reviewDates.add(new Date(p.lastReviewed).toDateString())
    }
  }
  
  // Count consecutive days from today
  let streak = 0
  const today = new Date()
  
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    
    if (reviewDates.has(checkDate.toDateString())) {
      streak++
    } else if (i > 0) {
      // Allow missing today (streak continues if yesterday was reviewed)
      break
    }
  }
  
  return streak
}

// ============================================
// Utilities
// ============================================

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Export all data (for backup)
 */
export async function exportData(): Promise<{
  decks: Deck[]
  cards: StoredCard[]
  progress: CardProgress[]
  settings: UserSettings
}> {
  const database = await ensureDB()
  
  const decks = await getAllDecks()
  const settings = await getSettings()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CARDS, STORES.PROGRESS], 'readonly')
    
    let cards: StoredCard[] = []
    let progress: CardProgress[] = []
    
    const cardsRequest = transaction.objectStore(STORES.CARDS).getAll()
    cardsRequest.onsuccess = () => { cards = cardsRequest.result }
    
    const progressRequest = transaction.objectStore(STORES.PROGRESS).getAll()
    progressRequest.onsuccess = () => { progress = progressRequest.result }
    
    transaction.oncomplete = () => resolve({ decks, cards, progress, settings })
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Clear all data
 */
export async function clearAllData(): Promise<void> {
  const database = await ensureDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.DECKS, STORES.CARDS, STORES.PROGRESS, STORES.SETTINGS],
      'readwrite'
    )
    
    transaction.objectStore(STORES.DECKS).clear()
    transaction.objectStore(STORES.CARDS).clear()
    transaction.objectStore(STORES.PROGRESS).clear()
    transaction.objectStore(STORES.SETTINGS).clear()
    
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
