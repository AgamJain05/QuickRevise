import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllDecks, deleteDeck, getStudyStats, type Deck } from '../lib/storage'
import Card from '../components/Card'

export default function Library() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDecks: 0,
    totalCards: 0,
    cardsReviewed: 0,
    averageMastery: 0,
    streak: 0,
  })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [decksData, statsData] = await Promise.all([
        getAllDecks(),
        getStudyStats(),
      ])
      setDecks(decksData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load library:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDeck = async (deckId: string) => {
    if (deletingId) return
    
    if (!confirm('Are you sure you want to delete this deck?')) return
    
    try {
      setDeletingId(deckId)
      await deleteDeck(deckId)
      setDecks(prev => prev.filter(d => d.id !== deckId))
      setStats(prev => ({
        ...prev,
        totalDecks: prev.totalDecks - 1,
      }))
    } catch (err) {
      console.error('Failed to delete deck:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    })
  }

  const getColorClass = (theme: string) => {
    const colors: Record<string, string> = {
      blue: 'from-blue-500 to-indigo-600',
      emerald: 'from-emerald-500 to-teal-600',
      violet: 'from-violet-500 to-purple-600',
      amber: 'from-amber-500 to-orange-600',
      rose: 'from-rose-500 to-pink-600',
      teal: 'from-teal-500 to-cyan-600',
      purple: 'from-purple-500 to-fuchsia-600',
      orange: 'from-orange-500 to-red-600',
      cyan: 'from-cyan-500 to-blue-600',
      indigo: 'from-indigo-500 to-blue-600',
      green: 'from-green-500 to-emerald-600',
      pink: 'from-pink-500 to-rose-600',
      slate: 'from-slate-500 to-gray-600',
      red: 'from-red-500 to-rose-600',
      yellow: 'from-yellow-500 to-amber-600',
      fuchsia: 'from-fuchsia-500 to-pink-600',
    }
    return colors[theme] || colors.blue
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-[32px] animate-spin-slow">
            progress_activity
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Library</h1>
        <p className="text-slate-500 mt-1">Your study decks and progress</p>
      </header>

      {/* Stats cards */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <Card variant="elevated" padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">local_fire_department</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.streak}</p>
                <p className="text-xs text-slate-500">Day Streak</p>
              </div>
            </div>
          </Card>
          
          <Card variant="elevated" padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-600">trending_up</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.averageMastery}%</p>
                <p className="text-xs text-slate-500">Mastery</p>
              </div>
            </div>
          </Card>
          
          <Card variant="elevated" padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-violet-600">style</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalCards}</p>
                <p className="text-xs text-slate-500">Total Cards</p>
              </div>
            </div>
          </Card>
          
          <Card variant="elevated" padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-600">check_circle</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.cardsReviewed}</p>
                <p className="text-xs text-slate-500">Reviewed</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Decks section */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Your Decks</h2>
          <span className="text-sm text-slate-500">{stats.totalDecks} decks</span>
        </div>

        {decks.length === 0 ? (
          <Card variant="outlined" className="text-center py-10">
            <span className="material-symbols-outlined text-slate-300 text-[48px] mb-3">
              folder_open
            </span>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No decks yet</h3>
            <p className="text-slate-500 text-sm mb-4">
              Create your first deck to start studying
            </p>
            <button
              onClick={() => navigate('/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Create Deck
            </button>
          </Card>
        ) : (
          <div className="space-y-3">
            {decks.map(deck => (
              <Card
                key={deck.id}
                variant="elevated"
                padding="none"
                className="overflow-hidden"
              >
                <button
                  onClick={() => navigate(`/study/${deck.id}`)}
                  className="w-full text-left"
                >
                  {/* Color header */}
                  <div className={`h-2 bg-gradient-to-r ${getColorClass(deck.colorTheme)}`} />
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">
                          {deck.title}
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {deck.cardCount} cards • {formatDate(deck.createdAt)}
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/speed/${deck.id}`)
                          }}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-purple-500"
                          title="Speed Quiz"
                        >
                          <span className="material-symbols-outlined text-[20px]">bolt</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/edit/${deck.id}`)
                          }}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-primary"
                          title="Edit Deck"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteDeck(deck.id)
                          }}
                          disabled={deletingId === deck.id}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-red-500"
                          title="Delete Deck"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {deletingId === deck.id ? 'progress_activity' : 'delete'}
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Tags */}
                    {deck.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {deck.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Source info */}
                    {deck.sourceName && (
                      <div className="flex items-center gap-1 mt-3 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-[14px]">
                          {deck.sourceType === 'pdf' ? 'picture_as_pdf' :
                           deck.sourceType === 'docx' ? 'description' :
                           deck.sourceType === 'url' ? 'link' :
                           deck.sourceType === 'pptx' ? 'slideshow' :
                           'text_snippet'}
                        </span>
                        <span className="truncate">{deck.sourceName}</span>
                      </div>
                    )}
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
