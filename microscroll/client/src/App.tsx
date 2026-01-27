import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { initDB } from './lib/storage'
import { api } from './lib/api'
import Layout from './components/Layout'

// Lazy load pages for better performance
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Auth = lazy(() => import('./pages/Auth'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const Create = lazy(() => import('./pages/Create'))
const Processing = lazy(() => import('./pages/Processing'))
const Home = lazy(() => import('./pages/Home'))
const Study = lazy(() => import('./pages/Study'))
const Library = lazy(() => import('./pages/Library'))
const Profile = lazy(() => import('./pages/Profile'))
const SpeedRevision = lazy(() => import('./pages/SpeedRevision'))
const DeckEditor = lazy(() => import('./pages/DeckEditor'))
const Membership = lazy(() => import('./pages/Membership'))

// Page loader component
function PageLoader() {
  return (
    <div className="min-h-dvh bg-background-light flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary animate-spin">
            progress_activity
          </span>
        </div>
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

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
    return <PageLoader />
  }

  return (
    <div className="min-h-dvh bg-background-light">
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
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
