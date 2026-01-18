import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { initDB } from './lib/storage'
import Onboarding from './pages/Onboarding'
import Create from './pages/Create'
import Processing from './pages/Processing'
import Home from './pages/Home'
import Study from './pages/Study'
import Library from './pages/Library'
import Profile from './pages/Profile'
import SpeedRevision from './pages/SpeedRevision'
import DeckEditor from './pages/DeckEditor'
import Layout from './components/Layout'

function App() {
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    return localStorage.getItem('microscroll_onboarded') === 'true'
  })
  const [dbReady, setDbReady] = useState(false)

  // Initialize database on app start
  useEffect(() => {
    initDB().then(() => setDbReady(true)).catch(console.error)
  }, [])

  const completeOnboarding = () => {
    localStorage.setItem('microscroll_onboarded', 'true')
    setHasOnboarded(true)
  }

  // Show loading while DB initializes
  if (!dbReady) {
    return (
      <div className="min-h-dvh bg-background-light flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary animate-spin-slow">
              progress_activity
            </span>
          </div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background-light">
      <Routes>
        {/* Onboarding flow */}
        <Route 
          path="/onboarding" 
          element={
            hasOnboarded 
              ? <Navigate to="/" replace /> 
              : <Onboarding onComplete={completeOnboarding} />
          } 
        />
        
        {/* Main app with bottom nav */}
        <Route element={<Layout />}>
          <Route 
            path="/" 
            element={
              hasOnboarded 
                ? <Home /> 
                : <Navigate to="/onboarding" replace />
            } 
          />
          <Route path="/create" element={<Create />} />
          <Route path="/library" element={<Library />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/explore" element={<ExplorePlaceholder />} />
        </Route>
        
        {/* Full-screen routes (no nav) */}
        <Route path="/processing" element={<Processing />} />
        <Route path="/study/:deckId" element={<Study />} />
        <Route path="/speed/:deckId" element={<SpeedRevision />} />
        <Route path="/edit/:deckId" element={<DeckEditor />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function ExplorePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] px-6">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-slate-400 text-[40px]">explore</span>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Explore</h2>
      <p className="text-slate-500 text-center">
        Discover community decks and trending study materials coming soon.
      </p>
    </div>
  )
}

export default App
