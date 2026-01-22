import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { processContent, type ProcessingStatus } from '../lib/fileProcessor'
import { initDB } from '../lib/storage'
import { incrementUsageCount } from '../lib/usageLimit'

interface ProcessingStep {
  id: string
  icon: string
  label: string
  description: string
  status: 'pending' | 'active' | 'complete' | 'error'
}

const initialSteps: ProcessingStep[] = [
  {
    id: 'reading',
    icon: 'menu_book',
    label: 'Reading',
    description: 'Extracting text content...',
    status: 'pending',
  },
  {
    id: 'chunking',
    icon: 'cut',
    label: 'Chunking',
    description: 'Breaking down complex topics...',
    status: 'pending',
  },
  {
    id: 'summarizing',
    icon: 'auto_awesome',
    label: 'Summarizing',
    description: 'Creating key points...',
    status: 'pending',
  },
  {
    id: 'designing',
    icon: 'design_services',
    label: 'Designing cards',
    description: 'Styling your content...',
    status: 'pending',
  },
]

export default function Processing() {
  const navigate = useNavigate()
  const location = useLocation()
  const [steps, setSteps] = useState<ProcessingStep[]>(initialSteps)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const processingStarted = useRef(false)

  // Get content from navigation state or sessionStorage
  const getContent = (): { text?: string; file?: File; title?: string } | null => {
    console.log('📦 [Processing.getContent] Checking for content')
    console.log('📦 [Processing.getContent] location.state?.content:', location.state?.content ? 'EXISTS' : 'UNDEFINED')
    
    // Try navigation state first
    if (location.state?.content) {
      console.log('📦 [Processing.getContent] Found content in location.state')
      return location.state.content
    }
    
    // Fall back to sessionStorage for text
    const stored = sessionStorage.getItem('microscroll_content')
    console.log('📦 [Processing.getContent] sessionStorage content:', stored ? 'EXISTS' : 'NULL')
    
    if (stored) {
      console.log('📦 [Processing.getContent] Parsing sessionStorage content')
      return JSON.parse(stored)
    }
    
    console.log('📦 [Processing.getContent] No content found')
    return null
  }

  // Get file from location state (can't be stored in sessionStorage)
  const getFile = (): File | null => {
    console.log('📦 [Processing.getFile] Checking for file')
    console.log('📦 [Processing.getFile] location.state?.file:', location.state?.file ? 'EXISTS' : 'UNDEFINED')
    
    const file = location.state?.file || null
    if (file) {
      console.log('📦 [Processing.getFile] File found:', file.name, file.size, file.type)
    } else {
      console.log('📦 [Processing.getFile] No file found')
    }
    
    return file
  }

  useEffect(() => {
    console.log('📦 [Processing] useEffect triggered')
    console.log('📦 [Processing] processingStarted.current:', processingStarted.current)
    console.log('📦 [Processing] location.state:', location.state)
    
    if (processingStarted.current) {
      console.log('📦 [Processing] Already started, skipping')
      return
    }
    processingStarted.current = true

    const content = getContent()
    const file = getFile()
    
    console.log('📦 [Processing] getContent() returned:', content ? { title: content.title, hasText: !!content.text, textLength: content.text?.length } : 'null')
    console.log('📦 [Processing] getFile() returned:', file ? { name: file.name, size: file.size, type: file.type } : 'null')
    
    if (!content && !file) {
      console.log('📦 [Processing] No content and no file, navigating to /create')
      navigate('/create')
      return
    }

    console.log('📦 [Processing] Starting processing...')
    startProcessing(content, file)
  }, [])

  const updateStep = (stepId: string, status: 'pending' | 'active' | 'complete' | 'error', description?: string) => {
    setSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        return { ...step, status, description: description || step.description }
      }
      // Mark previous steps as complete
      const stepOrder = ['reading', 'chunking', 'summarizing', 'designing']
      const currentStepIndex = stepOrder.indexOf(stepId)
      const thisStepIndex = stepOrder.indexOf(step.id)
      
      if (thisStepIndex < currentStepIndex && step.status !== 'complete') {
        return { ...step, status: 'complete' as const }
      }
      
      return step
    }))
  }

  const startProcessing = async (content: { text?: string; title?: string } | null, file: File | null) => {
    console.log('📦 [Processing] startProcessing called')
    console.log('📦 [Processing] content:', content ? { ...content, text: content.text?.slice(0, 100) + '...' } : null)
    console.log('📦 [Processing] file:', file?.name, file?.size, file?.type)
    
    if (isProcessing) {
      console.log('📦 [Processing] Already processing, skipping')
      return
    }
    setIsProcessing(true)

    const isAuthenticated = api.auth.isAuthenticated()
    console.log('📦 [Processing] isAuthenticated:', isAuthenticated)
    console.log('📦 [Processing] Token:', api.tokens.get().accessToken ? 'EXISTS' : 'MISSING')
    
    if (isAuthenticated) {
      console.log('📦 [Processing] Using BACKEND API')
      // Use backend API for processing
      await processWithBackend(content, file)
    } else {
      console.log('📦 [Processing] Using LOCAL processing (offline mode)')
      
      // Check if trying to upload a file without auth - files require backend
      if (file && !content?.text) {
        console.log('📦 [Processing] ERROR: Cannot process files without authentication')
        setError('Please log in to upload files. PDF, DOCX, and PPTX files require server-side processing.')
        setSteps(prev => prev.map(step => 
          step.id === 'reading' 
            ? { ...step, status: 'error' as const, description: 'Login required for file uploads' }
            : step
        ))
        return
      }
      
      // Fallback to client-side processing (offline mode) - only for text
      await processLocally(content)
    }
  }

  // Process using backend API
  const processWithBackend = async (content: { text?: string; title?: string } | null, file: File | null) => {
    console.log('🔥 [Backend] processWithBackend started')
    console.log('🔥 [Backend] file:', file ? { name: file.name, size: file.size, type: file.type } : 'NO FILE')
    console.log('🔥 [Backend] content:', content ? { title: content.title, textLength: content.text?.length } : 'NO CONTENT')
    
    try {
      // Step 1: Reading/Uploading
      updateStep('reading', 'active', 'Uploading content...')
      setProgress(10)

      let result: { job: any; deck: any }

      if (file) {
        console.log('🔥 [Backend] Uploading FILE to backend...')
        // Upload file to backend
        updateStep('reading', 'active', `Parsing ${file.name}...`)
        setProgress(20)
        
        console.log('🔥 [Backend] Calling api.process.uploadFile...')
        result = await api.process.uploadFile(file, content?.title)
        console.log('🔥 [Backend] uploadFile result:', result)
      } else if (content?.text) {
        console.log('🔥 [Backend] Processing TEXT content...')
        // Process text
        updateStep('reading', 'active', 'Processing text content...')
        setProgress(20)
        
        const title = content.title || 'Study Notes'
        console.log('🔥 [Backend] Calling api.process.processText with title:', title)
        result = await api.process.processText(content.text, title)
        console.log('🔥 [Backend] processText result:', result)
      } else {
        console.error('🔥 [Backend] ERROR: No content to process!')
        throw new Error('No content to process')
      }

      console.log('🔥 [Backend] Processing complete, result:', result)

      // Step 2: Chunking (simulated - happens on server)
      updateStep('chunking', 'active', 'Breaking down complex topics...')
      setProgress(40)
      await new Promise(r => setTimeout(r, 500))

      // Step 3: Summarizing
      updateStep('summarizing', 'active', 'AI is generating cards...')
      setProgress(60)
      await new Promise(r => setTimeout(r, 500))

      // Step 4: Designing
      updateStep('designing', 'active', 'Finalizing your deck...')
      setProgress(80)
      await new Promise(r => setTimeout(r, 500))

      // Complete
      setProgress(100)
      setSteps(prev => prev.map(step => ({ ...step, status: 'complete' as const })))

      // Increment usage count on successful generation
      incrementUsageCount()
      console.log('🔥 [Backend] Usage count incremented')

      // Clean up
      sessionStorage.removeItem('microscroll_content')

      console.log('🔥 [Backend] Navigating to study page for deck:', result.deck.id)

      // Navigate to study page (replace to prevent going back to processing)
      setTimeout(() => {
        navigate(`/study/${result.deck.id}`, { 
          replace: true,
          state: { 
            isNew: true,
            cardCount: result.deck.totalCards || 0,
          } 
        })
      }, 1000)

    } catch (err) {
      console.error('🔥 [Backend] ERROR:', err)
      console.error('🔥 [Backend] Error stack:', err instanceof Error ? err.stack : 'No stack')
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate cards'
      
      setError(errorMessage)
      setSteps(prev => prev.map(step => 
        step.status === 'active' 
          ? { ...step, status: 'error' as const, description: errorMessage }
          : step
      ))
    }
  }

  // Process locally (offline mode)
  const processLocally = async (content: { text?: string } | null) => {
    // Initialize database
    await initDB()

    // Update step status based on processing status
    const handleStatus = (status: ProcessingStatus) => {
      setProgress(status.progress)
      
      setSteps(prev => prev.map(step => {
        if (step.id === status.step) {
          return {
            ...step,
            status: status.step === 'error' ? 'error' : 'active',
            description: status.message,
          }
        }
        
        // Mark previous steps as complete
        const stepOrder = ['reading', 'chunking', 'summarizing', 'designing', 'saving', 'complete']
        const currentStepIndex = stepOrder.indexOf(status.step)
        const thisStepIndex = stepOrder.indexOf(step.id)
        
        if (thisStepIndex < currentStepIndex) {
          return { ...step, status: 'complete' as const }
        }
        
        return step
      }))

      if (status.step === 'error') {
        setError(status.error || 'An error occurred')
      }
    }

    // Process content
    const result = await processContent(
      { text: content?.text },
      handleStatus
    )

    // Clean up sessionStorage
    sessionStorage.removeItem('microscroll_content')

    if (result.success && result.deckId) {
      // Mark all steps complete
      setSteps(prev => prev.map(step => ({ ...step, status: 'complete' as const })))
      
      // Increment usage count on successful generation
      incrementUsageCount()
      console.log('📦 [Local] Usage count incremented')
      
      // Navigate to study page after a brief delay (replace to prevent going back to processing)
      setTimeout(() => {
        navigate(`/study/${result.deckId}`, { 
          replace: true,
          state: { 
            isNew: true,
            cardCount: result.cards?.length || 0,
          } 
        })
      }, 1000)
    } else if (!result.success) {
      setError(result.error || 'Failed to generate cards')
    }
  }

  const handleCancel = () => {
    sessionStorage.removeItem('microscroll_content')
    navigate('/create')
  }

  const handleRetry = () => {
    setError(null)
    setSteps(initialSteps)
    setProgress(0)
    setIsProcessing(false)
    processingStarted.current = false
    
    const content = getContent()
    const file = getFile()
    if (content || file) {
      processingStarted.current = true
      startProcessing(content, file)
    } else {
      navigate('/create')
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col mx-auto max-w-md bg-background-light">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50">
        <button
          onClick={handleCancel}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-[24px] text-slate-900">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          Generating Deck
        </h1>
        <div className="w-10" />
      </header>

      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-200">
        <div 
          className={`h-full transition-all duration-500 ease-out ${error ? 'bg-red-500' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {/* AI Brain Icon */}
        <div className="relative mb-8">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
            error ? 'bg-red-100' : 'bg-primary/10'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              error 
                ? 'bg-red-500' 
                : 'bg-primary animate-pulse-glow'
            }`}>
              <span className="material-symbols-outlined text-white text-[32px]">
                {error ? 'error' : 'psychology'}
              </span>
            </div>
          </div>
          
          {/* Orbiting dots (only when not errored) */}
          {!error && (
            <>
              <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '8s' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
              </div>
              <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
                <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
            </>
          )}
        </div>

        {/* Title */}
        <h2 className={`text-2xl font-bold mb-2 ${error ? 'text-red-600' : 'text-slate-900'}`}>
          {error ? 'Processing Failed' : 'Processing notes…'}
        </h2>
        <p className="text-slate-500 text-sm mb-10 text-center max-w-xs">
          {error || 'This may take a few seconds'}
        </p>

        {/* Steps */}
        <div className="w-full max-w-xs">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4 relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-5 top-10 w-0.5 h-12 -ml-px">
                  <div 
                    className={`w-full h-full transition-all duration-500 ${
                      step.status === 'complete' ? 'bg-primary' : 
                      step.status === 'error' ? 'bg-red-500' :
                      'bg-slate-200'
                    }`}
                  />
                </div>
              )}

              {/* Icon */}
              <div
                className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  step.status === 'complete'
                    ? 'bg-primary text-white'
                    : step.status === 'active'
                    ? 'bg-primary/10 text-primary border-2 border-primary'
                    : step.status === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step.status === 'complete' ? (
                  <span className="material-symbols-outlined text-[20px]">check</span>
                ) : step.status === 'error' ? (
                  <span className="material-symbols-outlined text-[20px]">close</span>
                ) : (
                  <span className={`material-symbols-outlined text-[20px] ${
                    step.status === 'active' ? 'animate-progress-pulse' : ''
                  }`}>
                    {step.icon}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 pb-8">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold transition-colors ${
                    step.status === 'pending' ? 'text-slate-400' : 
                    step.status === 'error' ? 'text-red-600' :
                    'text-slate-900'
                  }`}>
                    {step.label}
                  </h3>
                  {step.status === 'active' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <p className={`text-sm transition-colors ${
                  step.status === 'complete'
                    ? 'text-green-600'
                    : step.status === 'active'
                    ? 'text-slate-600'
                    : step.status === 'error'
                    ? 'text-red-500'
                    : 'text-slate-400'
                }`}>
                  {step.status === 'complete' ? 'Complete' : step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="pb-8 pt-4 px-6 text-center">
        {error ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleCancel}
              className="text-slate-600 font-semibold hover:text-slate-900 transition-colors"
            >
              Go Back
            </button>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-sm mb-4">This may take a few seconds...</p>
            <button
              onClick={handleCancel}
              className="text-slate-600 font-semibold hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </footer>
    </div>
  )
}
