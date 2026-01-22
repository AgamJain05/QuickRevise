/**
 * Authentication Page - Login, Register with OTP Verification
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

type AuthMode = 'login' | 'register' | 'verify-otp'

// API base URL for Google OAuth
const API_BASE = '/api'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Check for OAuth callback error
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(`Authentication failed: ${errorParam.replace(/_/g, ' ')}`)
    }
  }, [searchParams])

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  // Password validation helper
  const getPasswordStrength = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
    }
    const passed = Object.values(checks).filter(Boolean).length
    return { checks, passed, total: 4 }
  }

  const passwordStrength = getPasswordStrength(password)

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newOtp = [...otp]
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit
        }
      })
      setOtp(newOtp)
      // Focus last filled input or next empty
      const lastIndex = Math.min(index + digits.length - 1, 5)
      otpInputRefs.current[lastIndex]?.focus()
      return
    }

    if (!/^\d*$/.test(value)) return // Only allow digits

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  // Handle OTP backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        // Validate password strength
        if (passwordStrength.passed < 4) {
          throw new Error('Password must contain uppercase, lowercase, and a number')
        }
        await api.auth.register(email, password, name || undefined)
        
        // Send verification OTP
        await api.auth.sendVerificationOTP()
        
        setToast({ message: '📧 Verification code sent to your email!', type: 'success' })
        setMode('verify-otp')
        setResendCountdown(60)
      } else if (mode === 'login') {
        await api.auth.login(email, password)
        
        // Mark as onboarded and navigate to home
        localStorage.setItem('microscroll_onboarded', 'true')
        window.location.href = '/'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }

    setError(null)
    setLoading(true)

    try {
      await api.auth.verifyOTP(otpCode)
      setToast({ message: '🎉 Email verified successfully!', type: 'success' })
      
      // Short delay then redirect
      await new Promise(resolve => setTimeout(resolve, 1000))
      localStorage.setItem('microscroll_onboarded', 'true')
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code')
      setOtp(['', '', '', '', '', ''])
      otpInputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return
    
    setLoading(true)
    try {
      await api.auth.sendVerificationOTP()
      setToast({ message: '📧 New code sent!', type: 'success' })
      setResendCountdown(60)
      setOtp(['', '', '', '', '', ''])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE}/auth/google`
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
    setOtp(['', '', '', '', '', ''])
  }

  const handleSkip = () => {
    localStorage.setItem('microscroll_onboarded', 'true')
    navigate('/')
  }

  // OTP Verification Screen
  if (mode === 'verify-otp') {
    return (
      <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-50 to-white">
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg animate-fade-in-up ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            <p className="font-medium text-center">{toast.message}</p>
          </div>
        )}

        <header className="px-5 pt-8 pb-4">
          <button 
            onClick={() => setMode('register')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span>Back</span>
          </button>
        </header>

        <main className="flex-1 flex flex-col justify-center px-5 pb-8">
          <div className="max-w-sm mx-auto w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[40px]">mail</span>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify your email</h2>
            <p className="text-slate-500 mb-8">
              Enter the 6-digit code sent to<br/>
              <span className="font-medium text-slate-700">{email}</span>
            </p>

            {/* OTP Input */}
            <div className="flex justify-center gap-3 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-slate-200 text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 mb-4">
                <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                <span className="text-sm font-medium text-red-600">{error}</span>
              </div>
            )}

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify Email</span>
              )}
            </button>

            <p className="text-slate-500 text-sm">
              Didn't receive the code?{' '}
              {resendCountdown > 0 ? (
                <span className="text-slate-400">Resend in {resendCountdown}s</span>
              ) : (
                <button
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-primary font-medium hover:underline"
                >
                  Resend code
                </button>
              )}
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Login / Register Screen
  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg animate-fade-in-up ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <p className="font-medium text-center">{toast.message}</p>
        </div>
      )}

      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <span className="text-2xl">📚</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">MicroScroll</h1>
            <p className="text-sm text-slate-500">Learn in scrolls</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-5 pb-8">
        <div className="max-w-sm mx-auto w-full">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {mode === 'login' ? 'Welcome back!' : 'Create account'}
          </h2>
          <p className="text-slate-500 mb-8">
            {mode === 'login' 
              ? 'Sign in to sync your decks across devices' 
              : 'Start your micro-learning journey'}
          </p>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Create a strong password' : 'Enter password'}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              
              {/* Password strength indicator for registration */}
              {mode === 'register' && password.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength.passed >= i
                            ? passwordStrength.passed >= 4 ? 'bg-green-500' 
                              : passwordStrength.passed >= 3 ? 'bg-yellow-500' 
                              : 'bg-red-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'length', label: '8+ chars' },
                      { key: 'uppercase', label: 'A-Z' },
                      { key: 'lowercase', label: 'a-z' },
                      { key: 'number', label: '0-9' },
                    ].map(({ key, label }) => (
                      <span
                        key={key}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          passwordStrength.checks[key as keyof typeof passwordStrength.checks]
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                <span className="text-sm font-medium text-red-600">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-sm text-slate-600 hover:text-primary transition-colors"
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={handleSkip}
              className="w-full py-3 text-slate-600 font-medium hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_off</span>
              <span>Continue without account</span>
            </button>
            <p className="text-xs text-slate-400 text-center mt-2">
              Data will be stored locally on this device only
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
