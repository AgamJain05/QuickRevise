/**
 * Instagram-Style Vertical Snap Scrolling Feed
 * 
 * Displays study cards in a full-screen, swipeable format
 * with snap scrolling and gesture support.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { StoredCard } from '../lib/storage'

interface StudyFeedProps {
  cards: StoredCard[]
  onCardChange?: (index: number) => void
  onBookmark?: (cardId: string) => void
  onMastered?: (cardId: string) => void
  onReviewLater?: (cardId: string) => void
  initialIndex?: number
}

export default function StudyFeed({
  cards,
  onCardChange,
  onBookmark,
  onMastered,
  onReviewLater,
  initialIndex = 0,
}: StudyFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [revealedGhostWords, setRevealedGhostWords] = useState<Set<string>>(new Set())
  const [isELI5Mode, setIsELI5Mode] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const touchStartX = useRef(0)
  const isScrolling = useRef(false)

  const currentCard = cards[currentIndex]

  // Notify parent of card changes
  useEffect(() => {
    onCardChange?.(currentIndex)
  }, [currentIndex, onCardChange])

  // Handle scroll snap
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrolling.current) return
    
    const container = containerRef.current
    const scrollTop = container.scrollTop
    const cardHeight = container.clientHeight
    const newIndex = Math.round(scrollTop / cardHeight)
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < cards.length) {
      setCurrentIndex(newIndex)
    }
  }, [currentIndex, cards.length])

  // Scroll to specific card
  const scrollToCard = useCallback((index: number) => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const cardHeight = container.clientHeight
    
    isScrolling.current = true
    container.scrollTo({
      top: index * cardHeight,
      behavior: 'smooth',
    })
    
    setTimeout(() => {
      isScrolling.current = false
      setCurrentIndex(index)
    }, 400)
  }, [])

  // Handle touch start for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
    setSwipeDirection(null)
  }

  // Handle touch move for horizontal swipe detection
  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = e.touches[0].clientY - touchStartY.current
    
    // Detect horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left')
    }
  }

  // Handle touch end for swipe actions
  const handleTouchEnd = () => {
    if (swipeDirection === 'right' && currentCard) {
      // Swipe right = Mastered
      onMastered?.(currentCard.id)
      showFeedback('Marked as Mastered! 🎉')
    } else if (swipeDirection === 'left' && currentCard) {
      // Swipe left = Review Later
      onReviewLater?.(currentCard.id)
      showFeedback('Added to Review Later 📝')
    }
    setSwipeDirection(null)
  }

  // Show feedback toast
  const [feedback, setFeedback] = useState<string | null>(null)
  const showFeedback = (message: string) => {
    setFeedback(message)
    setTimeout(() => setFeedback(null), 2000)
  }

  // Toggle ghost word reveal
  const revealGhostWord = (word: string) => {
    setRevealedGhostWords(prev => new Set([...prev, word]))
  }

  // Navigate to next/previous card
  const goToNext = () => {
    if (currentIndex < cards.length - 1) {
      scrollToCard(currentIndex + 1)
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      scrollToCard(currentIndex - 1)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        goToNext()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        onMastered?.(currentCard?.id || '')
        showFeedback('Marked as Mastered! 🎉')
      } else if (e.key === 'ArrowLeft') {
        onReviewLater?.(currentCard?.id || '')
        showFeedback('Added to Review Later 📝')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, currentCard])

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">No cards to display</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3">
        {cards.map((_, index) => (
          <div
            key={index}
            className={`flex-1 h-1 rounded-full transition-all duration-300 ${
              index < currentIndex
                ? 'bg-primary'
                : index === currentIndex
                ? 'bg-primary'
                : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Swipe indicator overlays */}
      {swipeDirection === 'right' && (
        <div className="absolute inset-0 z-30 bg-green-500/20 flex items-center justify-center pointer-events-none">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full font-bold text-lg">
            ✓ Mastered
          </div>
        </div>
      )}
      {swipeDirection === 'left' && (
        <div className="absolute inset-0 z-30 bg-amber-500/20 flex items-center justify-center pointer-events-none">
          <div className="bg-amber-500 text-white px-6 py-3 rounded-full font-bold text-lg">
            📝 Review Later
          </div>
        </div>
      )}

      {/* Main scrolling container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory hide-scrollbar"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {cards.map((card, index) => (
          <div
            key={card.id}
            className="h-full w-full snap-start snap-always flex-shrink-0"
          >
            <StudyCard
              card={card}
              isActive={index === currentIndex}
              isELI5Mode={isELI5Mode}
              revealedGhostWords={revealedGhostWords}
              onRevealGhostWord={revealGhostWord}
              onToggleELI5={() => setIsELI5Mode(!isELI5Mode)}
              onBookmark={() => onBookmark?.(card.id)}
            />
          </div>
        ))}
      </div>

      {/* Bottom actions bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/50 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => onBookmark?.(currentCard?.id || '')}
            className="p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <span className="material-symbols-outlined text-white">bookmark</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              className={`px-4 py-2 rounded-full font-semibold transition-all ${
                !isELI5Mode
                  ? 'bg-white text-slate-900'
                  : 'bg-white/20 text-white backdrop-blur-sm'
              }`}
              onClick={() => setIsELI5Mode(false)}
            >
              Pro
            </button>
            <button
              className={`px-4 py-2 rounded-full font-semibold transition-all flex items-center gap-1 ${
                isELI5Mode
                  ? 'bg-white text-slate-900'
                  : 'bg-white/20 text-white backdrop-blur-sm'
              }`}
              onClick={() => setIsELI5Mode(true)}
            >
              ELI5 <span className="text-lg">🌱</span>
            </button>
          </div>
          
          <button
            onClick={goToNext}
            className="p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <span className="material-symbols-outlined text-white">expand_more</span>
          </button>
        </div>
        
        {/* Card counter */}
        <div className="text-center text-white/70 text-sm">
          {currentIndex + 1} of {cards.length}
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-slate-900/90 text-white px-6 py-3 rounded-full font-semibold backdrop-blur-sm">
            {feedback}
          </div>
        </div>
      )}
    </div>
  )
}

// Individual Study Card Component
interface StudyCardProps {
  card: StoredCard
  isActive: boolean
  isELI5Mode: boolean
  revealedGhostWords: Set<string>
  onRevealGhostWord: (word: string) => void
  onToggleELI5: () => void
  onBookmark: () => void
}

function StudyCard({
  card,
  isActive: _isActive,
  isELI5Mode,
  revealedGhostWords,
  onRevealGhostWord,
}: StudyCardProps) {
  // Get gradient based on difficulty
  const gradients = {
    easy: 'from-emerald-600 to-teal-700',
    medium: 'from-blue-600 to-indigo-700',
    hard: 'from-purple-600 to-pink-700',
  }
  const gradient = gradients[card.difficulty] || gradients.medium

  // Render text with ghost words
  const renderWithGhostWords = (text: string) => {
    if (!card.ghostWords || card.ghostWords.length === 0) {
      return text
    }

    let result = text
    card.ghostWords.forEach(word => {
      if (!revealedGhostWords.has(word)) {
        // Create a pattern to match the word (case insensitive)
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        result = result.replace(regex, `|||GHOST:${word}|||`)
      }
    })

    // Split and render
    const parts = result.split('|||')
    return parts.map((part, i) => {
      if (part.startsWith('GHOST:')) {
        const word = part.replace('GHOST:', '')
        return (
          <button
            key={i}
            onClick={() => onRevealGhostWord(word)}
            className="inline-flex items-center justify-center px-3 py-0.5 mx-0.5 rounded-lg bg-white/30 hover:bg-white/40 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px] text-white/70">touch_app</span>
          </button>
        )
      }
      return part
    })
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Card image/gradient background */}
      <div className={`flex-1 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-black/10 rounded-full" />
        
        {/* Content */}
        <div className="relative z-10 h-full flex flex-col p-6 pt-16">
          {/* Subject badge */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider">
              <span>{card.emoji}</span>
              {card.tags?.[0] || 'Study'}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl font-bold text-white mb-2 italic">
            {card.headline}
          </h2>

          {/* Difficulty badge */}
          <div className="flex items-center gap-2 mb-6">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              card.difficulty === 'easy' ? 'bg-green-400/30 text-green-100' :
              card.difficulty === 'hard' ? 'bg-red-400/30 text-red-100' :
              'bg-yellow-400/30 text-yellow-100'
            }`}>
              {card.difficulty.charAt(0).toUpperCase() + card.difficulty.slice(1)}
            </span>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {/* Detail paragraph */}
            <p className="text-white/90 text-lg leading-relaxed mb-6">
              {isELI5Mode && card.eli5Version
                ? card.eli5Version
                : renderWithGhostWords(card.detailParagraph)
              }
            </p>

            {/* Bullet points */}
            <ul className="space-y-3">
              {(card.bulletPoints || []).map((bullet, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-white/60 flex-shrink-0" />
                  <span className="text-white/80 leading-relaxed">
                    {renderWithGhostWords(bullet)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/20">
              {card.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 rounded-full bg-white/10 text-white/70 text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
