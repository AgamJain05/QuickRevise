/**
 * OAuth Callback Page - Handles token exchange from Google OAuth
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { tokens } from '../lib/api'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setError(errorParam.replace(/_/g, ' '))
      setTimeout(() => navigate('/auth'), 3000)
      return
    }

    if (accessToken && refreshToken) {
      // Store tokens
      tokens.set(accessToken, refreshToken)
      
      // Mark as onboarded
      localStorage.setItem('microscroll_onboarded', 'true')
      
      // Redirect to home
      window.location.href = '/'
    } else {
      setError('Authentication failed - missing tokens')
      setTimeout(() => navigate('/auth'), 3000)
    }
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-slate-50 to-white p-5">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-[40px]">error</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Authentication Failed</h1>
          <p className="text-slate-500">{error}</p>
          <p className="text-sm text-slate-400 mt-4">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-slate-50 to-white p-5">
      <div className="max-w-sm w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[40px] animate-spin">
            progress_activity
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Signing you in...</h1>
        <p className="text-slate-500">Please wait while we complete the authentication.</p>
      </div>
    </div>
  )
}
