import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { initDB } from './lib/storage'
import { api } from './lib/api'
import Onboarding from './pages/Onboarding'
import Auth from './pages/Auth'
import AuthCallback from './pages/AuthCallback'
import Create from './pages/Create'
import Processing from './pages/Processing'
import Home from './pages/Home'
import Study from './pages/Study'
import Library from './pages/Library'
import Profile from './pages/Profile'
import SpeedRevision from './pages/SpeedRevision'
import DeckEditor from './pages/DeckEditor'
import Membership from './pages/Membership'
import Layout from './components/Layout'

// Protected route wrapper - redirects to auth if not logged in
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!api.auth.isAuthenticated()) {
    return <Navigate to="/auth" replace />
  }
  return <>{children}</>
}

function App() {
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    return localStorage.getItem('microscroll_onboarded') === 'true'
  })
  const [dbReady, setDbReady] = useState(false)
  const isAuthenticated = api.auth.isAuthenticated()

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
              ? (isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/auth" replace />)
              : <Onboarding onComplete={completeOnboarding} />
          } 
        />
        
        {/* Authentication - redirect to home if already logged in */}
        <Route 
          path="/auth" 
          element={
            isAuthenticated 
              ? <Navigate to="/" replace /> 
              : <Auth />
          } 
        />
        
        {/* OAuth callback - handles token from Google */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Main app with bottom nav - Protected routes */}
        <Route element={<Layout />}>
          <Route 
            path="/" 
            element={
              !hasOnboarded 
                ? <Navigate to="/onboarding" replace />
                : !isAuthenticated
                ? <Navigate to="/auth" replace />
                : <Home />
            } 
          />
          <Route path="/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/explore" element={<ProtectedRoute><ExplorePlaceholder /></ProtectedRoute>} />
        </Route>
        
        {/* Full-screen routes (no nav) - Protected */}
        <Route path="/processing" element={<ProtectedRoute><Processing /></ProtectedRoute>} />
        <Route path="/study/:deckId" element={<ProtectedRoute><Study /></ProtectedRoute>} />
        <Route path="/speed/:deckId" element={<ProtectedRoute><SpeedRevision /></ProtectedRoute>} />
        <Route path="/edit/:deckId" element={<ProtectedRoute><DeckEditor /></ProtectedRoute>} />
        <Route path="/membership" element={<ProtectedRoute><Membership /></ProtectedRoute>} />
        
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
