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
import { api, UserAnalytics, UserSettings as ApiUserSettings, DueCard } from '../lib/api'
import Card from '../components/Card'

// Fallback to local storage for offline mode
import { 
  getStudyStats, 
  getAllDecks, 
  getCardsForReview,
  getSettings as getLocalSettings,
  saveSettings as saveLocalSettings,
  exportData as exportLocalData,
  clearAllData,
  type Deck,
} from '../lib/storage'

interface WeeklyData {
  day: string
  cards: number
}

export default function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(api.auth.isAuthenticated())
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  // Stats from API or local
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [localStats, setLocalStats] = useState({
    totalDecks: 0,
    totalCards: 0,
    cardsReviewed: 0,
    averageMastery: 0,
    streak: 0,
  })
  
  const [decks, setDecks] = useState<Deck[]>([])
  const [dueCards, setDueCards] = useState<DueCard[]>([])
  const [dueCount, setDueCount] = useState(0)
  
  const [settings, setSettings] = useState<ApiUserSettings>({
    theme: 'system',
    dailyGoal: 20,
    soundEnabled: true,
    hapticsEnabled: true,
    autoPlayEnabled: false,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
  })
  
  const [showSettings, setShowSettings] = useState(false)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      if (api.auth.isAuthenticated()) {
        // Load from API
        setIsOnline(true)
        const [analyticsData, settingsData, dueCardsData, decksResult] = await Promise.all([
          api.analytics.get(),
          api.settings.get(),
          api.study.getDueCards({ limit: 10 }),
          api.decks.list({ limit: 10 }),
        ])
        
        setAnalytics(analyticsData)
        setSettings(settingsData)
        setDueCards(dueCardsData)
        setDueCount(analyticsData.dueForReview)
        
        // Map API decks to local format for display
        setDecks(decksResult.items.map(d => ({
          id: d.id,
          title: d.title,
          description: d.description || '',
          emoji: d.emoji,
          cards: [],
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        })))
        
        // Build weekly data from API
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const today = new Date().getDay()
        const weekly: WeeklyData[] = analyticsData.weeklyActivity.map((cards, i) => ({
          day: days[(today - 6 + i + 7) % 7],
          cards,
        }))
        setWeeklyData(weekly)
      } else {
        // Fallback to local storage
        setIsOnline(false)
        const [statsData, decksData, dueCardsData, settingsData] = await Promise.all([
          getStudyStats(),
          getAllDecks(),
          getCardsForReview(10),
          getLocalSettings(),
        ])
        
        setLocalStats(statsData)
        setDecks(decksData)
        setDueCount(dueCardsData.length)
        setSettings({
          theme: settingsData.theme,
          dailyGoal: settingsData.dailyGoal,
          soundEnabled: settingsData.soundEnabled,
          hapticsEnabled: true,
          autoPlayEnabled: false,
          currentStreak: statsData.streak,
          longestStreak: statsData.streak,
          lastActiveDate: null,
        })
        
        // Demo weekly data
        setWeeklyData([
          { day: 'Mon', cards: 12 },
          { day: 'Tue', cards: 18 },
          { day: 'Wed', cards: 8 },
          { day: 'Thu', cards: 25 },
          { day: 'Fri', cards: 15 },
          { day: 'Sat', cards: 20 },
          { day: 'Sun', cards: 10 },
        ])
      }
    } catch (err) {
      console.error('Failed to load profile data:', err)
      // Fallback to local on error
      setIsOnline(false)
      try {
        const statsData = await getStudyStats()
        setLocalStats(statsData)
      } catch {
        // Ignore
      }
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    try {
      if (isOnline) {
        const blob = await api.settings.export()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `microscroll-backup-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await exportLocalData()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `microscroll-backup-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return
    if (!confirm('Really? All your decks and progress will be permanently deleted.')) return
    
    try {
      if (isOnline) {
        await api.settings.deleteAllData()
      }
      await clearAllData()
      localStorage.removeItem('microscroll_onboarded')
      window.location.href = '/'
    } catch (err) {
      console.error('Clear data failed:', err)
    }
  }

  const handleSaveSettings = async (newSettings: Partial<ApiUserSettings>) => {
    try {
      const updated = { ...settings, ...newSettings }
      
      if (isOnline) {
        await api.settings.update({
          theme: updated.theme as 'light' | 'dark' | 'system',
          dailyGoal: updated.dailyGoal,
          soundEnabled: updated.soundEnabled,
          hapticsEnabled: updated.hapticsEnabled,
          autoPlayEnabled: updated.autoPlayEnabled,
        })
      } else {
        await saveLocalSettings({
          theme: updated.theme,
          aiProvider: 'demo',
          dailyGoal: updated.dailyGoal,
          soundEnabled: updated.soundEnabled,
        })
      }
      
      setSettings(updated)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } catch (err) {
      console.error('Logout failed:', err)
      api.tokens.clear()
    }
    
    // Clear onboarding flag so user sees "Get Started" page
    localStorage.removeItem('microscroll_onboarded')
    window.location.href = '/onboarding'
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

  // Use API stats if online, otherwise local
  const stats = analytics ? {
    totalDecks: analytics.totalDecks,
    totalCards: analytics.totalCards,
    cardsReviewed: analytics.totalReviewed,
    averageMastery: analytics.masteryPercent,
    streak: analytics.streak,
    todayStudied: analytics.todayStudied,
    dailyGoal: analytics.dailyGoal,
  } : {
    ...localStats,
    todayStudied: 0,
    dailyGoal: settings.dailyGoal,
  }

  const masteryLevel = getMasteryLevel(stats.averageMastery)
  const maxCards = Math.max(...weeklyData.map(d => d.cards), 1)

  return (
    <div className="pb-6">
      {/* Logout Confirmation Toast */}
      {showLogoutConfirm && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-lg bg-white border border-slate-200 animate-fade-in-up max-w-sm w-[calc(100%-2rem)]">
          <p className="font-medium text-center mb-4 text-slate-800">Are you sure you want to log out?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 py-2 px-4 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowLogoutConfirm(false)
                handleLogout()
              }}
              className="flex-1 py-2 px-4 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      )}

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

      {/* Online/Offline indicator */}
      {!isOnline && (
        <div className="px-5 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg text-amber-700 text-sm">
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            <span>Offline mode - data stored locally</span>
          </div>
        </div>
      )}

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
                  onChange={(e) => handleSaveSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}
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
                  onClick={() => handleSaveSettings({ soundEnabled: !settings.soundEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.soundEnabled ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Haptics */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Haptic Feedback</span>
                <button
                  onClick={() => handleSaveSettings({ hapticsEnabled: !settings.hapticsEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.hapticsEnabled ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.hapticsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              
              {/* Daily Goal */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Daily Goal</span>
                <select
                  value={settings.dailyGoal}
                  onChange={(e) => handleSaveSettings({ dailyGoal: parseInt(e.target.value) })}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  <option value={10}>10 cards</option>
                  <option value={20}>20 cards</option>
                  <option value={30}>30 cards</option>
                  <option value={50}>50 cards</option>
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
              
              {isOnline && (
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Log Out
                </button>
              )}
              
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

          {/* Daily progress */}
          {stats.dailyGoal > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Today's Progress</span>
                <span className="font-semibold text-slate-900">{stats.todayStudied}/{stats.dailyGoal}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (stats.todayStudied / stats.dailyGoal) * 100)}%` }}
                />
              </div>
            </div>
          )}
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
                  className="w-full bg-primary rounded-t-lg transition-all hover:opacity-80"
                  style={{ height: `${(data.cards / maxCards) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-slate-500 mt-2">{data.day}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 pt-4 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              Total: <span className="font-semibold text-slate-700">{weeklyData.reduce((sum, d) => sum + d.cards, 0)} cards</span>
            </span>
          </div>
        </Card>
      </div>

      {/* Due for review */}
      {dueCount > 0 && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900">Due for Review</h3>
            <span className="text-sm text-primary font-semibold">{dueCount} cards</span>
          </div>
          <Card variant="elevated" className="bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-600">schedule</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Review needed!</p>
                <p className="text-sm text-slate-600">{dueCount} cards are due for spaced repetition review</p>
              </div>
              <button
                onClick={() => {
                  // Navigate to first due card's deck or first deck
                  if (dueCards.length > 0 && dueCards[0].deck) {
                    navigate(`/study/${dueCards[0].deck.id}`)
                  } else if (decks.length > 0) {
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
