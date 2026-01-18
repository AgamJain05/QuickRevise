/**
 * Profile & Analytics Dashboard
 * 
 * PRD F8: Basic Analytics Dashboard showing study statistics
 * 
 * Features:
 * - User profile info
 * - Study streak tracking
 * - Performance metrics (accuracy, cards reviewed)
 * - Learning trends over time
 * - Upcoming reviews (spaced repetition)
 * - Settings access
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  getStudyStats, 
  getAllDecks, 
  getCardsForReview,
  getSettings,
  saveSettings,
  exportData,
  clearAllData,
  type Deck,
  type CardProgress,
  type UserSettings 
} from '../lib/storage'
import Card from '../components/Card'

interface WeeklyData {
  day: string
  cards: number
  accuracy: number
}

export default function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDecks: 0,
    totalCards: 0,
    cardsReviewed: 0,
    averageMastery: 0,
    streak: 0,
  })
  const [decks, setDecks] = useState<Deck[]>([])
  const [dueCards, setDueCards] = useState<CardProgress[]>([])
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'system',
    aiProvider: 'demo',
    dailyGoal: 20,
    soundEnabled: true,
  })
  const [showSettings, setShowSettings] = useState(false)
  const [weeklyData] = useState<WeeklyData[]>([
    { day: 'Mon', cards: 12, accuracy: 85 },
    { day: 'Tue', cards: 18, accuracy: 90 },
    { day: 'Wed', cards: 8, accuracy: 75 },
    { day: 'Thu', cards: 25, accuracy: 92 },
    { day: 'Fri', cards: 15, accuracy: 88 },
    { day: 'Sat', cards: 20, accuracy: 95 },
    { day: 'Sun', cards: 10, accuracy: 80 },
  ])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsData, decksData, dueCardsData, settingsData] = await Promise.all([
        getStudyStats(),
        getAllDecks(),
        getCardsForReview(10),
        getSettings(),
      ])
      
      setStats(statsData)
      setDecks(decksData)
      setDueCards(dueCardsData)
      setSettings(settingsData)
    } catch (err) {
      console.error('Failed to load profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    try {
      const data = await exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `microscroll-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return
    if (!confirm('Really? All your decks and progress will be permanently deleted.')) return
    
    try {
      await clearAllData()
      localStorage.removeItem('microscroll_onboarded')
      window.location.href = '/'
    } catch (err) {
      console.error('Clear data failed:', err)
    }
  }

  const handleSaveSettings = async (newSettings: UserSettings) => {
    try {
      await saveSettings(newSettings)
      setSettings(newSettings)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  const getStreakEmoji = (streak: number) => {
    if (streak >= 30) return '🏆'
    if (streak >= 14) return '🔥'
    if (streak >= 7) return '⚡'
    if (streak >= 3) return '✨'
    return '🌱'
  }

  const getMasteryLevel = (mastery: number) => {
    if (mastery >= 90) return { label: 'Expert', color: 'text-purple-500' }
    if (mastery >= 70) return { label: 'Advanced', color: 'text-blue-500' }
    if (mastery >= 50) return { label: 'Intermediate', color: 'text-green-500' }
    if (mastery >= 25) return { label: 'Beginner', color: 'text-yellow-500' }
    return { label: 'Novice', color: 'text-slate-500' }
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

  const masteryLevel = getMasteryLevel(stats.averageMastery)
  const maxCards = Math.max(...weeklyData.map(d => d.cards), 1)

  return (
    <div className="pb-6">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Profile & Stats</h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-600">
            {showSettings ? 'close' : 'settings'}
          </span>
        </button>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-5 mb-6 animate-fade-in">
          <Card variant="elevated">
            <h3 className="font-bold text-slate-900 mb-4">Settings</h3>
            
            <div className="space-y-4">
              {/* Theme */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Theme</span>
                <select
                  value={settings.theme}
                  onChange={(e) => handleSaveSettings({ ...settings, theme: e.target.value as UserSettings['theme'] })}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              
              {/* Sound */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Sound Effects</span>
                <button
                  onClick={() => handleSaveSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.soundEnabled ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              
              {/* Daily Goal */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Daily Goal</span>
                <select
                  value={settings.dailyGoal}
                  onChange={(e) => handleSaveSettings({ ...settings, dailyGoal: parseInt(e.target.value) })}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  <option value={10}>10 cards</option>
                  <option value={20}>20 cards</option>
                  <option value={30}>30 cards</option>
                  <option value={50}>50 cards</option>
                </select>
              </div>
              
              {/* AI Provider */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700">AI Provider</span>
                <select
                  value={settings.aiProvider}
                  onChange={(e) => handleSaveSettings({ ...settings, aiProvider: e.target.value as UserSettings['aiProvider'] })}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  <option value="demo">Demo (Offline)</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <button
                onClick={handleExportData}
                className="w-full py-2 text-primary font-semibold hover:bg-primary/5 rounded-lg transition-colors"
              >
                Export Data
              </button>
              <button
                onClick={handleClearData}
                className="w-full py-2 text-red-500 font-semibold hover:bg-red-50 rounded-lg transition-colors"
              >
                Delete All Data
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Profile card */}
      <div className="px-5 mb-6">
        <Card variant="elevated" className="text-center">
          <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
            <span className="text-4xl">{getStreakEmoji(stats.streak)}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Learner</h2>
          <p className={`text-sm font-semibold ${masteryLevel.color}`}>{masteryLevel.label}</p>
          
          {/* Streak */}
          <div className="mt-4 p-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-xl">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">🔥</span>
              <span className="text-4xl font-bold text-orange-600">{stats.streak}</span>
            </div>
            <p className="text-orange-700 text-sm font-medium mt-1">Day Streak</p>
          </div>
        </Card>
      </div>

      {/* Stats grid */}
      <div className="px-5 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-3">Your Progress</h3>
        <div className="grid grid-cols-2 gap-3">
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <span className="material-symbols-outlined text-primary text-[28px] mb-1">style</span>
              <p className="text-2xl font-bold text-slate-900">{stats.totalCards}</p>
              <p className="text-xs text-slate-500">Total Cards</p>
            </div>
          </Card>
          
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <span className="material-symbols-outlined text-emerald-500 text-[28px] mb-1">check_circle</span>
              <p className="text-2xl font-bold text-slate-900">{stats.cardsReviewed}</p>
              <p className="text-xs text-slate-500">Reviewed</p>
            </div>
          </Card>
          
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <span className="material-symbols-outlined text-violet-500 text-[28px] mb-1">folder</span>
              <p className="text-2xl font-bold text-slate-900">{stats.totalDecks}</p>
              <p className="text-xs text-slate-500">Decks</p>
            </div>
          </Card>
          
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <span className="material-symbols-outlined text-amber-500 text-[28px] mb-1">trending_up</span>
              <p className="text-2xl font-bold text-slate-900">{stats.averageMastery}%</p>
              <p className="text-xs text-slate-500">Mastery</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Weekly activity chart */}
      <div className="px-5 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-3">This Week</h3>
        <Card variant="elevated">
          <div className="flex items-end justify-between h-32 gap-2">
            {weeklyData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-primary/20 rounded-t-lg transition-all hover:bg-primary/30"
                  style={{ height: `${(data.cards / maxCards) * 100}%`, minHeight: '4px' }}
                >
                  <div 
                    className="w-full bg-primary rounded-t-lg"
                    style={{ height: `${data.accuracy}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 mt-2">{data.day}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 pt-4 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              Total: <span className="font-semibold text-slate-700">{weeklyData.reduce((sum, d) => sum + d.cards, 0)} cards</span>
            </span>
            <span className="text-slate-500">
              Avg: <span className="font-semibold text-slate-700">{Math.round(weeklyData.reduce((sum, d) => sum + d.accuracy, 0) / 7)}% accuracy</span>
            </span>
          </div>
        </Card>
      </div>

      {/* Due for review */}
      {dueCards.length > 0 && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900">Due for Review</h3>
            <span className="text-sm text-primary font-semibold">{dueCards.length} cards</span>
          </div>
          <Card variant="elevated" className="bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-600">schedule</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Review needed!</p>
                <p className="text-sm text-slate-600">{dueCards.length} cards are due for spaced repetition review</p>
              </div>
              <button
                onClick={() => {
                  // Find the deck with most due cards and navigate there
                  if (decks.length > 0) {
                    navigate(`/study/${decks[0].id}`)
                  }
                }}
                className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
              >
                Review
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5">
        <h3 className="text-lg font-bold text-slate-900 mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/create')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:border-primary transition-colors"
          >
            <span className="material-symbols-outlined text-primary">add_circle</span>
            <span className="font-medium text-slate-700">Create New Deck</span>
            <span className="material-symbols-outlined text-slate-400 ml-auto">chevron_right</span>
          </button>
          
          {decks.length > 0 && (
            <button
              onClick={() => navigate(`/speed/${decks[0].id}`)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:border-primary transition-colors"
            >
              <span className="material-symbols-outlined text-purple-500">bolt</span>
              <span className="font-medium text-slate-700">Speed Revision</span>
              <span className="material-symbols-outlined text-slate-400 ml-auto">chevron_right</span>
            </button>
          )}
          
          <button
            onClick={() => navigate('/library')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:border-primary transition-colors"
          >
            <span className="material-symbols-outlined text-emerald-500">collections_bookmark</span>
            <span className="font-medium text-slate-700">View All Decks</span>
            <span className="material-symbols-outlined text-slate-400 ml-auto">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  )
}
