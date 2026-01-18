/**
 * Deck Editor - F7: Deck Management
 * 
 * Features:
 * - Edit deck title and description
 * - View all cards in a deck
 * - Edit individual card content
 * - Reorder cards (drag and drop)
 * - Delete cards
 * - Add new cards manually
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  getDeck, 
  getCardsForDeck, 
  updateCard,
  type Deck, 
  type StoredCard 
} from '../lib/storage'
import Card from '../components/Card'

export default function DeckEditor() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<StoredCard[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    headline: '',
    detailParagraph: '',
    bulletPoints: ['', '', ''],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!deckId) {
      navigate('/library')
      return
    }
    loadDeck(deckId)
  }, [deckId])

  const loadDeck = async (id: string) => {
    try {
      const [deckData, cardsData] = await Promise.all([
        getDeck(id),
        getCardsForDeck(id),
      ])
      
      if (!deckData) {
        navigate('/library')
        return
      }
      
      setDeck(deckData)
      setCards(cardsData)
    } catch (err) {
      console.error('Failed to load deck:', err)
      navigate('/library')
    } finally {
      setLoading(false)
    }
  }

  const startEditingCard = (card: StoredCard) => {
    setEditingCardId(card.id)
    setEditForm({
      headline: card.headline,
      detailParagraph: card.detailParagraph,
      bulletPoints: [...card.bulletPoints, '', '', ''].slice(0, 5),
    })
  }

  const cancelEditing = () => {
    setEditingCardId(null)
    setEditForm({
      headline: '',
      detailParagraph: '',
      bulletPoints: ['', '', ''],
    })
  }

  const saveCard = async () => {
    if (!editingCardId) return
    
    const card = cards.find(c => c.id === editingCardId)
    if (!card) return
    
    setSaving(true)
    
    try {
      const updatedCard: StoredCard = {
        ...card,
        headline: editForm.headline,
        detailParagraph: editForm.detailParagraph,
        bulletPoints: editForm.bulletPoints.filter(bp => bp.trim().length > 0),
      }
      
      await updateCard(updatedCard)
      
      setCards(prev => prev.map(c => c.id === editingCardId ? updatedCard : c))
      cancelEditing()
    } catch (err) {
      console.error('Failed to save card:', err)
    } finally {
      setSaving(false)
    }
  }

  const updateBulletPoint = (index: number, value: string) => {
    setEditForm(prev => ({
      ...prev,
      bulletPoints: prev.bulletPoints.map((bp, i) => i === index ? value : bp),
    }))
  }

  const moveCard = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= cards.length) return
    
    const newCards = [...cards]
    const [moved] = newCards.splice(fromIndex, 1)
    newCards.splice(toIndex, 0, moved)
    
    // Update order in cards
    setCards(newCards.map((card, index) => ({
      ...card,
      order: index,
    })))
    
    // Save order to storage (in background)
    newCards.forEach(async (card, index) => {
      if (card.order !== index) {
        await updateCard({ ...card, order: index })
      }
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-700'
      case 'hard': return 'bg-red-100 text-red-700'
      default: return 'bg-yellow-100 text-yellow-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background-light flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-[32px] animate-spin-slow">
          progress_activity
        </span>
      </div>
    )
  }

  if (!deck) {
    return null
  }

  return (
    <div className="min-h-dvh bg-background-light">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background-light/90 backdrop-blur-md border-b border-slate-200/50">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-900">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-slate-900">Edit Deck</h1>
        <button
          onClick={() => navigate(`/study/${deckId}`)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-primary">play_arrow</span>
        </button>
      </header>

      <main className="pb-8">
        {/* Deck info */}
        <div className="px-5 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-slate-900">{deck.title}</h2>
          <p className="text-slate-500 mt-1">{deck.description || `${cards.length} cards`}</p>
          
          {/* Quick actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => navigate(`/study/${deckId}`)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">play_arrow</span>
              Study
            </button>
            <button
              onClick={() => navigate(`/speed/${deckId}`)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">bolt</span>
              Speed Quiz
            </button>
          </div>
        </div>

        {/* Cards list */}
        <div className="px-5">
          <h3 className="text-lg font-bold text-slate-900 mb-3">
            Cards ({cards.length})
          </h3>
          
          <div className="space-y-3">
            {cards.map((card, index) => (
              <div key={card.id}>
                {editingCardId === card.id ? (
                  // Edit mode
                  <Card variant="elevated" className="border-2 border-primary">
                    <div className="space-y-4">
                      {/* Headline */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          Headline
                        </label>
                        <input
                          type="text"
                          value={editForm.headline}
                          onChange={(e) => setEditForm(prev => ({ ...prev, headline: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none"
                          placeholder="Card headline..."
                        />
                      </div>
                      
                      {/* Detail paragraph */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          Detail
                        </label>
                        <textarea
                          value={editForm.detailParagraph}
                          onChange={(e) => setEditForm(prev => ({ ...prev, detailParagraph: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none resize-none"
                          rows={3}
                          placeholder="Main explanation..."
                        />
                      </div>
                      
                      {/* Bullet points */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          Key Points
                        </label>
                        <div className="space-y-2">
                          {editForm.bulletPoints.map((bp, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {i + 1}
                              </span>
                              <input
                                type="text"
                                value={bp}
                                onChange={(e) => updateBulletPoint(i, e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none text-sm"
                                placeholder={`Point ${i + 1}...`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={cancelEditing}
                          className="flex-1 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveCard}
                          disabled={saving}
                          className="flex-1 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  // View mode
                  <Card variant="elevated" padding="none" className="overflow-hidden">
                    <div className="flex">
                      {/* Reorder buttons */}
                      <div className="flex flex-col bg-slate-50 border-r border-slate-100">
                        <button
                          onClick={() => moveCard(index, index - 1)}
                          disabled={index === 0}
                          className="p-2 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-slate-400 text-[18px]">expand_less</span>
                        </button>
                        <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400">
                          {index + 1}
                        </div>
                        <button
                          onClick={() => moveCard(index, index + 1)}
                          disabled={index === cards.length - 1}
                          className="p-2 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-slate-400 text-[18px]">expand_more</span>
                        </button>
                      </div>
                      
                      {/* Card content */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{card.emoji}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getDifficultyColor(card.difficulty)}`}>
                                {card.difficulty}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 truncate">{card.headline}</h4>
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{card.detailParagraph}</p>
                            
                            {/* Bullet preview */}
                            {card.bulletPoints.length > 0 && (
                              <div className="mt-2 text-xs text-slate-400">
                                {card.bulletPoints.length} key points
                              </div>
                            )}
                          </div>
                          
                          {/* Edit button */}
                          <button
                            onClick={() => startEditingCard(card)}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-slate-400">edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            ))}
          </div>
          
          {cards.length === 0 && (
            <Card variant="outlined" className="text-center py-8">
              <span className="material-symbols-outlined text-slate-300 text-[48px] mb-2">
                style
              </span>
              <p className="text-slate-500">No cards in this deck</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
