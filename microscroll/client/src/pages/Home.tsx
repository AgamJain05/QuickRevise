import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getAllDecks, getStudyStats } from '../lib/storage'
import Card from '../components/Card'

interface DeckDisplay {
  id: string
  title: string
  emoji: string
  colorTheme: string
  cardCount: number
}

export default function Home() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState<DeckDisplay[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalDecks: 0,
    totalCards: 0,
    cardsReviewed: 0,
    averageMastery: 0,
    streak: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      if (api.auth.isAuthenticated()) {
        // Load from backend
        setIsOnline(true)
        const [decksResult, analyticsResult, userResult] = await Promise.all([
          api.decks.list({ limit: 5, sortBy: 'updatedAt', sortOrder: 'desc' }),
          api.analytics.get(),
          api.auth.me(),
        ])
        
        // Set user name (use first name only)
        if (userResult?.name) {
          const firstName = userResult.name.split(' ')[0]
          setUserName(firstName)
        }
        
        setDecks(decksResult.items.map(d => ({
          id: d.id,
          title: d.title,
          emoji: d.emoji,
          colorTheme: d.colorTheme,
          cardCount: d.totalCards,
        })))
        
        setStats({
          totalDecks: analyticsResult.totalDecks,
          totalCards: analyticsResult.totalCards,
          cardsReviewed: analyticsResult.totalReviewed,
          averageMastery: analyticsResult.masteryPercent,
          streak: analyticsResult.streak,
        })
      } else {
        // Load from local storage
        setIsOnline(false)
        const [decksData, statsData] = await Promise.all([
          getAllDecks(),
          getStudyStats(),
        ])
        
        setDecks(decksData.slice(0, 5).map(d => ({
          id: d.id,
          title: d.title,
          emoji: '📚',
          colorTheme: d.colorTheme,
          cardCount: d.cardCount,
        })))
        
        setStats(statsData)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      // Fallback to local
      try {
        const [decksData, statsData] = await Promise.all([
          getAllDecks(),
          getStudyStats(),
        ])
        setDecks(decksData.slice(0, 5).map(d => ({
          id: d.id,
          title: d.title,
          emoji: '📚',
          colorTheme: d.colorTheme,
          cardCount: d.cardCount,
        })))
        setStats(statsData)
      } catch {
        // Ignore
      }
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
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
      green: 'from-green-500 to-emerald-600',
      pink: 'from-pink-500 to-rose-600',
    }
    return colors[theme] || colors.blue
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined text-primary text-[32px] animate-spin-slow">
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">
              {getGreeting()}{userName ? `, ${userName}` : ''} 👋
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Ready to learn?</h1>
          </div>
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg">
              <span className="material-symbols-outlined text-amber-600 text-[16px]">cloud_off</span>
              <span className="text-xs text-amber-700">Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* Quick stats */}
      {stats.totalCards > 0 && (
        <div className="px-5 mb-6">
          <Card variant="elevated" className="bg-gradient-to-br from-primary to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Current Streak</p>
                <p className="text-3xl font-bold mt-1">
                  {stats.streak} {stats.streak === 1 ? 'day' : 'days'} 🔥
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-sm">Mastery</p>
                <p className="text-3xl font-bold mt-1">{stats.averageMastery}%</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between text-sm">
              <span>{stats.totalCards} cards</span>
              <span>{stats.cardsReviewed} reviewed</span>
              <span>{stats.totalDecks} decks</span>
            </div>
          </Card>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card
            variant="elevated"
            className="cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => navigate('/create')}
          >
            <div className="flex flex-col items-center text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-primary text-[28px]">add_circle</span>
              </div>
              <h3 className="font-semibold text-slate-900">Create Deck</h3>
              <p className="text-xs text-slate-500 mt-1">From notes or PDF</p>
            </div>
          </Card>
          
          <Card
            variant="elevated"
            className={`cursor-pointer transition-transform ${decks.length > 0 ? 'hover:scale-[1.02]' : 'opacity-50'}`}
            onClick={() => decks.length > 0 && navigate(`/study/${decks[0].id}`)}
          >
            <div className="flex flex-col items-center text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-emerald-600 text-[28px]">play_arrow</span>
              </div>
              <h3 className="font-semibold text-slate-900">Quick Study</h3>
              <p className="text-xs text-slate-500 mt-1">
                {decks.length > 0 ? 'Continue learning' : 'Create a deck first'}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent decks */}
      {decks.length > 0 && (
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Recent Decks</h2>
            <button
              onClick={() => navigate('/library')}
              className="text-primary text-sm font-semibold"
            >
              See All
            </button>
          </div>
          
          <div className="space-y-3">
            {decks.map(deck => (
              <Card
                key={deck.id}
                variant="elevated"
                padding="none"
                className="overflow-hidden cursor-pointer hover:scale-[1.01] transition-transform"
                onClick={() => navigate(`/study/${deck.id}`)}
              >
                <div className={`h-1.5 bg-gradient-to-r ${getColorClass(deck.colorTheme)}`} />
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getColorClass(deck.colorTheme)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-xl">
                      {deck.emoji || deck.title.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{deck.title}</h3>
                    <p className="text-sm text-slate-500">{deck.cardCount} cards</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {decks.length === 0 && (
        <div className="px-5">
          <Card variant="outlined" className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[32px]">school</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Start Your Journey</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              Transform your study materials into engaging flashcards with AI
            </p>
            <button
              onClick={() => navigate('/create')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              Create Your First Deck
            </button>
          </Card>
        </div>
      )}

      {/* Tips section */}
      <div className="px-5 mt-6">
        <Card className="bg-amber-50 border-amber-100">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="font-semibold text-slate-900">Pro Tip</h4>
              <p className="text-sm text-slate-600 mt-1">
                Swipe right on cards you've mastered, left for ones to review later. 
                The app uses spaced repetition to help you remember!
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
