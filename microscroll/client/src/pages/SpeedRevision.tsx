/**
 * Speed Revision Mode - "Tinder for Truth"
 * 
 * PRD F6: Rapid-fire True/False questions for quick knowledge testing
 * 
 * Features:
 * - Single-statement cards from deck content
 * - Swipe right (True) / left (False)
 * - 10-second timer per card
 * - Immediate feedback (correct/incorrect)
 * - Score tracking & streak counter
 * - Sound/haptic feedback
 * - Summary screen with stats
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDeck, getCardsForDeck, updateCardProgress, getCardProgress, type StoredCard } from '../lib/storage'
import { api } from '../lib/api'

interface QuizStatement {
  id: string
  statement: string
  isTrue: boolean
  explanation: string
  cardId: string
  difficulty: 'easy' | 'medium' | 'hard'
}

interface GameStats {
  correct: number
  incorrect: number
  streak: number
  maxStreak: number
  timeBonus: number
  totalTime: number
}

interface CardResult {
  cardId: string
  correct: boolean
  timeSpent: number
}

type GamePhase = 'intro' | 'playing' | 'feedback' | 'summary'

const TIMER_DURATION = 10 // seconds
const STREAK_BONUS_THRESHOLD = 3

export default function SpeedRevision() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  
  // Game state
  const [phase, setPhase] = useState<GamePhase>('intro')
  const [statements, setStatements] = useState<QuizStatement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [stats, setStats] = useState<GameStats>({
    correct: 0,
    incorrect: 0,
    streak: 0,
    maxStreak: 0,
    timeBonus: 0,
    totalTime: 0,
  })
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  
  // UI state
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [feedbackResult, setFeedbackResult] = useState<'correct' | 'incorrect' | 'timeout' | null>(null)
  const [deckTitle, setDeckTitle] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Track card results for API submission
  const [cardResults, setCardResults] = useState<CardResult[]>([])
  const [resultsSaved, setResultsSaved] = useState(false)
  
  // Touch handling
  const touchStartX = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  // Load deck and generate statements
  useEffect(() => {
    if (!deckId) {
      navigate('/library')
      return
    }
    loadDeckAndGenerateStatements(deckId)
  }, [deckId])

  const loadDeckAndGenerateStatements = async (id: string) => {
    try {
      const [deck, cards] = await Promise.all([
        getDeck(id),
        getCardsForDeck(id),
      ])
      
      if (!deck || cards.length === 0) {
        navigate('/library')
        return
      }
      
      setDeckTitle(deck.title)
      const generatedStatements = generateStatementsFromCards(cards)
      setStatements(generatedStatements)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load deck:', err)
      navigate('/library')
    }
  }

  // Generate True/False statements from cards
  const generateStatementsFromCards = (cards: StoredCard[]): QuizStatement[] => {
    const statements: QuizStatement[] = []
    
    cards.forEach(card => {
      // Generate 1-2 statements per card
      
      // Statement from headline (True)
      statements.push({
        id: `${card.id}-headline`,
        statement: `${card.headline} is a key concept covered in this topic.`,
        isTrue: true,
        explanation: card.detailParagraph,
        cardId: card.id,
        difficulty: card.difficulty,
      })
      
      // Statement from bullet points (True)
      if (card.bulletPoints.length > 0) {
        const bullet = card.bulletPoints[0]
        statements.push({
          id: `${card.id}-bullet`,
          statement: bullet.endsWith('.') ? bullet : bullet + '.',
          isTrue: true,
          explanation: `This is correct. ${card.detailParagraph}`,
          cardId: card.id,
          difficulty: card.difficulty,
        })
      }
      
      // Generate a false statement (negate or modify)
      if (card.bulletPoints.length > 1) {
        const falseBullet = generateFalseStatement(card.bulletPoints[1])
        statements.push({
          id: `${card.id}-false`,
          statement: falseBullet,
          isTrue: false,
          explanation: `This is incorrect. The correct information is: ${card.bulletPoints[1]}`,
          cardId: card.id,
          difficulty: card.difficulty,
        })
      }
    })
    
    // Shuffle statements
    return shuffleArray(statements).slice(0, Math.min(20, statements.length))
  }

  // Generate a false statement by modifying the original
  const generateFalseStatement = (original: string): string => {
    const negations = [
      { pattern: /\bis\b/gi, replace: 'is not' },
      { pattern: /\bare\b/gi, replace: 'are not' },
      { pattern: /\bcan\b/gi, replace: 'cannot' },
      { pattern: /\bwill\b/gi, replace: 'will not' },
      { pattern: /\balways\b/gi, replace: 'never' },
      { pattern: /\bnever\b/gi, replace: 'always' },
      { pattern: /\bincreases?\b/gi, replace: 'decreases' },
      { pattern: /\bdecreases?\b/gi, replace: 'increases' },
    ]
    
    for (const { pattern, replace } of negations) {
      if (pattern.test(original)) {
        return original.replace(pattern, replace)
      }
    }
    
    // Default: add "not" after first verb-like word
    return original.replace(/^(.+?)\s+(is|are|was|were|has|have|can|will|does|do)\s+/i, 
      '$1 $2 not ')
  }

  // Shuffle array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Start game
  const startGame = () => {
    setPhase('playing')
    setCurrentIndex(0)
    setStats({
      correct: 0,
      incorrect: 0,
      streak: 0,
      maxStreak: 0,
      timeBonus: 0,
      totalTime: 0,
    })
    setCardResults([])
    setResultsSaved(false)
    startTimer()
  }

  // Timer logic
  const startTimer = useCallback(() => {
    setTimeLeft(TIMER_DURATION)
    startTimeRef.current = Date.now()
    
    if (timerRef.current) clearInterval(timerRef.current)
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // Handle timeout
  const handleTimeout = () => {
    stopTimer()
    setFeedbackResult('timeout')
    setStats(prev => ({
      ...prev,
      incorrect: prev.incorrect + 1,
      streak: 0,
    }))
    setPhase('feedback')
    playSound('timeout')
  }

  // Handle answer
  const handleAnswer = async (userAnswer: boolean) => {
    if (phase !== 'playing') return
    
    stopTimer()
    const timeUsed = (Date.now() - startTimeRef.current) / 1000
    const currentStatement = statements[currentIndex]
    const isCorrect = userAnswer === currentStatement.isTrue
    
    // Update stats
    setStats(prev => {
      const newStreak = isCorrect ? prev.streak + 1 : 0
      const timeBonus = isCorrect && timeUsed < 5 ? Math.floor((5 - timeUsed) * 2) : 0
      
      return {
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
        streak: newStreak,
        maxStreak: Math.max(prev.maxStreak, newStreak),
        timeBonus: prev.timeBonus + timeBonus,
        totalTime: prev.totalTime + timeUsed,
      }
    })
    
    // Track result for API submission
    setCardResults(prev => [...prev, {
      cardId: currentStatement.cardId,
      correct: isCorrect,
      timeSpent: Math.round(timeUsed * 1000), // ms
    }])
    
    // Update local card progress
    try {
      const progress = await getCardProgress(currentStatement.cardId, deckId!)
      await updateCardProgress(progress, isCorrect)
    } catch (err) {
      console.error('Failed to update progress:', err)
    }
    
    // Show feedback
    setFeedbackResult(isCorrect ? 'correct' : 'incorrect')
    setPhase('feedback')
    playSound(isCorrect ? 'correct' : 'incorrect')
    triggerHaptic(isCorrect ? 'success' : 'error')
  }

  // Play sound
  const playSound = (type: 'correct' | 'incorrect' | 'timeout' | 'complete') => {
    // Using Web Audio API for sounds
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      switch (type) {
        case 'correct':
          oscillator.frequency.value = 880 // A5
          oscillator.type = 'sine'
          gainNode.gain.value = 0.3
          break
        case 'incorrect':
          oscillator.frequency.value = 220 // A3
          oscillator.type = 'sawtooth'
          gainNode.gain.value = 0.2
          break
        case 'timeout':
          oscillator.frequency.value = 330 // E4
          oscillator.type = 'square'
          gainNode.gain.value = 0.2
          break
        case 'complete':
          oscillator.frequency.value = 523 // C5
          oscillator.type = 'sine'
          gainNode.gain.value = 0.3
          break
      }
      
      oscillator.start()
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch {
      // Audio not available
    }
  }

  // Trigger haptic feedback
  const triggerHaptic = (type: 'success' | 'error' | 'light') => {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'success':
          navigator.vibrate([50, 30, 50])
          break
        case 'error':
          navigator.vibrate([100, 50, 100])
          break
        case 'light':
          navigator.vibrate(30)
          break
      }
    }
  }

  // Continue to next question or summary
  const continueGame = () => {
    if (currentIndex >= statements.length - 1) {
      setPhase('summary')
      playSound('complete')
    } else {
      setCurrentIndex(prev => prev + 1)
      setFeedbackResult(null)
      setSwipeDirection(null)
      setPhase('playing')
      startTimer()
    }
  }

  // Save results to backend when game completes
  useEffect(() => {
    if (phase === 'summary' && !resultsSaved && deckId && api.auth.isAuthenticated()) {
      const saveResults = async () => {
        try {
          await api.study.saveSpeedResults({
            deckId,
            cardsPlayed: statements.length,
            correctAnswers: stats.correct,
            totalTime: Math.round(stats.totalTime),
            maxStreak: stats.maxStreak,
            cardResults,
          })
          setResultsSaved(true)
          console.log('Speed revision results saved to backend')
        } catch (err) {
          console.error('Failed to save speed results:', err)
        }
      }
      saveResults()
    }
  }, [phase, resultsSaved, deckId, stats, cardResults, statements.length])

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (phase !== 'playing') return
    
    const deltaX = e.touches[0].clientX - touchStartX.current
    if (Math.abs(deltaX) > 50) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left')
    } else {
      setSwipeDirection(null)
    }
  }

  const handleTouchEnd = () => {
    if (phase !== 'playing' || !swipeDirection) return
    handleAnswer(swipeDirection === 'right')
  }

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === 'playing') {
        if (e.key === 'ArrowRight' || e.key === 't' || e.key === 'T') {
          handleAnswer(true)
        } else if (e.key === 'ArrowLeft' || e.key === 'f' || e.key === 'F') {
          handleAnswer(false)
        }
      } else if (phase === 'feedback') {
        if (e.key === ' ' || e.key === 'Enter') {
          continueGame()
        }
      } else if (phase === 'intro') {
        if (e.key === ' ' || e.key === 'Enter') {
          startGame()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, swipeDirection])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer()
  }, [])

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-900 flex items-center justify-center">
        <span className="material-symbols-outlined text-white text-[32px] animate-spin-slow">
          progress_activity
        </span>
      </div>
    )
  }

  const currentStatement = statements[currentIndex]
  const progress = ((currentIndex + 1) / statements.length) * 100

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 text-white">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
          <span className="text-lg">🔥</span>
          <span className="font-bold">{stats.streak}</span>
        </div>
        
        <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      {/* Progress bar */}
      {phase !== 'intro' && phase !== 'summary' && (
        <div className="px-4">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-white/60 text-sm">
            <span>{currentIndex + 1} / {statements.length}</span>
            <span>{stats.correct} correct</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        {/* Intro Screen */}
        {phase === 'intro' && (
          <div className="text-center text-white animate-fade-in">
            <div className="text-6xl mb-6">⚡</div>
            <h1 className="text-3xl font-bold mb-2">Speed Revision</h1>
            <p className="text-white/70 mb-2">{deckTitle}</p>
            <p className="text-white/50 text-sm mb-8">
              {statements.length} questions • 10 seconds each
            </p>
            
            <div className="bg-white/10 rounded-2xl p-6 mb-8 text-left max-w-sm mx-auto">
              <h3 className="font-semibold mb-4">How to play:</h3>
              <div className="space-y-3 text-sm text-white/80">
                <div className="flex items-center gap-3">
                  <span className="text-green-400">→</span>
                  <span>Swipe right or press T for TRUE</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-400">←</span>
                  <span>Swipe left or press F for FALSE</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400">⏱</span>
                  <span>Answer fast for bonus points!</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={startGame}
              className="px-8 py-4 bg-primary text-white font-bold text-lg rounded-2xl shadow-glow hover:bg-primary-dark transition-all btn-press"
            >
              Start Game
            </button>
          </div>
        )}

        {/* Playing Screen */}
        {phase === 'playing' && currentStatement && (
          <div className="w-full max-w-md">
            {/* Timer */}
            <div className="flex justify-center mb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold ${
                timeLeft <= 3 ? 'bg-red-500 animate-pulse' : 'bg-white/20'
              } text-white`}>
                {timeLeft}
              </div>
            </div>

            {/* Statement Card */}
            <div
              ref={cardRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`relative bg-white rounded-3xl p-8 shadow-2xl transition-transform duration-200 ${
                swipeDirection === 'right' ? 'rotate-3 translate-x-4' :
                swipeDirection === 'left' ? '-rotate-3 -translate-x-4' : ''
              }`}
            >
              {/* Swipe indicators */}
              {swipeDirection === 'right' && (
                <div className="absolute top-4 right-4 px-4 py-2 bg-green-500 text-white font-bold rounded-full">
                  TRUE
                </div>
              )}
              {swipeDirection === 'left' && (
                <div className="absolute top-4 left-4 px-4 py-2 bg-red-500 text-white font-bold rounded-full">
                  FALSE
                </div>
              )}

              {/* Difficulty badge */}
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 ${
                currentStatement.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                currentStatement.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {currentStatement.difficulty.toUpperCase()}
              </div>

              {/* Statement */}
              <p className="text-xl font-medium text-slate-800 leading-relaxed">
                {currentStatement.statement}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-8 mt-8">
              <button
                onClick={() => handleAnswer(false)}
                className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors btn-press"
              >
                <span className="material-symbols-outlined text-[32px]">close</span>
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors btn-press"
              >
                <span className="material-symbols-outlined text-[32px]">check</span>
              </button>
            </div>
            
            <p className="text-center text-white/50 text-sm mt-4">
              Swipe left for False, right for True
            </p>
          </div>
        )}

        {/* Feedback Screen */}
        {phase === 'feedback' && currentStatement && (
          <div className="w-full max-w-md text-center animate-fade-in">
            <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
              feedbackResult === 'correct' ? 'bg-green-500' :
              feedbackResult === 'incorrect' ? 'bg-red-500' :
              'bg-yellow-500'
            }`}>
              <span className="material-symbols-outlined text-white text-[48px]">
                {feedbackResult === 'correct' ? 'check' :
                 feedbackResult === 'incorrect' ? 'close' :
                 'timer_off'}
              </span>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">
              {feedbackResult === 'correct' ? 'Correct! 🎉' :
               feedbackResult === 'incorrect' ? 'Incorrect 😅' :
               'Time\'s up! ⏰'}
            </h2>
            
            {stats.streak >= STREAK_BONUS_THRESHOLD && feedbackResult === 'correct' && (
              <div className="text-yellow-400 font-semibold mb-4">
                🔥 {stats.streak} streak bonus!
              </div>
            )}
            
            <div className="bg-white/10 rounded-2xl p-6 mb-6 text-left">
              <p className="text-white/60 text-sm mb-2">The statement was:</p>
              <p className="text-white font-medium mb-4">{currentStatement.statement}</p>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                currentStatement.isTrue ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {currentStatement.isTrue ? 'TRUE' : 'FALSE'}
              </div>
              <p className="text-white/70 text-sm mt-4">{currentStatement.explanation}</p>
            </div>
            
            <button
              onClick={continueGame}
              className="px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark transition-all btn-press"
            >
              {currentIndex >= statements.length - 1 ? 'See Results' : 'Next Question'}
            </button>
          </div>
        )}

        {/* Summary Screen */}
        {phase === 'summary' && (
          <div className="w-full max-w-md text-center animate-fade-in">
            <div className="text-6xl mb-4">
              {stats.correct / statements.length >= 0.8 ? '🏆' :
               stats.correct / statements.length >= 0.6 ? '⭐' :
               stats.correct / statements.length >= 0.4 ? '👍' : '💪'}
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2">Game Complete!</h2>
            <p className="text-white/70 mb-8">{deckTitle}</p>
            
            {/* Score */}
            <div className="bg-white/10 rounded-2xl p-6 mb-6">
              <div className="text-5xl font-bold text-white mb-2">
                {Math.round((stats.correct / statements.length) * 100)}%
              </div>
              <p className="text-white/60">Accuracy</p>
            </div>
            
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-400">{stats.correct}</div>
                <div className="text-white/60 text-sm">Correct</div>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-400">{stats.incorrect}</div>
                <div className="text-white/60 text-sm">Incorrect</div>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-yellow-400">{stats.maxStreak}</div>
                <div className="text-white/60 text-sm">Max Streak</div>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-400">+{stats.timeBonus}</div>
                <div className="text-white/60 text-sm">Time Bonus</div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setPhase('intro')
                  setCurrentIndex(0)
                }}
                className="w-full px-6 py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark transition-all btn-press"
              >
                Play Again
              </button>
              <button
                onClick={() => navigate(`/study/${deckId}`)}
                className="w-full px-6 py-4 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-all"
              >
                Study Cards
              </button>
              <button
                onClick={() => navigate('/library')}
                className="text-white/60 hover:text-white transition-colors"
              >
                Back to Library
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
