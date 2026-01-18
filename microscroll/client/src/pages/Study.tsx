import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getDeck, getCardsForDeck, updateCardProgress, getCardProgress, type Deck, type StoredCard } from '../lib/storage'
import StudyFeed from '../components/StudyFeed'

export default function Study() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<StoredCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  // Check if this is a newly created deck
  const isNewDeck = location.state?.isNew

  useEffect(() => {
    if (!deckId) {
      navigate('/')
      return
    }

    loadDeck(deckId)
  }, [deckId])

  // Show celebration for new deck
  useEffect(() => {
    if (isNewDeck && cards.length > 0) {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isNewDeck, cards.length])

  const loadDeck = async (id: string) => {
    try {
      setLoading(true)
      
      const [deckData, cardsData] = await Promise.all([
        getDeck(id),
        getCardsForDeck(id),
      ])

      if (!deckData) {
        setError('Deck not found')
        return
      }

      setDeck(deckData)
      setCards(cardsData)
    } catch (err) {
      setError('Failed to load deck')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBookmark = async (cardId: string) => {
    // TODO: Implement bookmark functionality
    console.log('Bookmark:', cardId)
  }

  const handleMastered = async (cardId: string) => {
    if (!deckId) return
    
    try {
      const progress = await getCardProgress(cardId, deckId)
      await updateCardProgress(progress, true)
    } catch (err) {
      console.error('Failed to update progress:', err)
    }
  }

  const handleReviewLater = async (cardId: string) => {
    if (!deckId) return
    
    try {
      const progress = await getCardProgress(cardId, deckId)
      await updateCardProgress(progress, false)
    } catch (err) {
      console.error('Failed to update progress:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background-light">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[32px] animate-spin-slow">
              progress_activity
            </span>
          </div>
          <p className="text-slate-500">Loading deck...</p>
        </div>
      </div>
    )
  }

  if (error || !deck) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background-light">
        <div className="text-center px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-[32px]">error</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Oops!</h2>
          <p className="text-slate-500 mb-6">{error || 'Deck not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh w-full mx-auto max-w-md bg-slate-900">
      {/* Header overlay */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3 pb-8 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          <span className="material-symbols-outlined text-white">close</span>
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-white/80 text-sm font-medium">{deck.title}</span>
        </div>
        
        <button className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors">
          <span className="material-symbols-outlined text-white">more_vert</span>
        </button>
      </header>

      {/* Study Feed */}
      <StudyFeed
        cards={cards}
        onBookmark={handleBookmark}
        onMastered={handleMastered}
        onReviewLater={handleReviewLater}
      />

      {/* New deck celebration */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="text-center px-8 animate-fade-in-up">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-white mb-2">Deck Created!</h2>
            <p className="text-white/70 text-lg mb-4">
              {cards.length} cards ready to study
            </p>
            <p className="text-white/50 text-sm">
              Swipe up to start learning
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
