import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { api, ContentLimits } from '../lib/api'
import { getUsageInfo, hasReachedLimit } from '../lib/usageLimit'

// Default limits (will be updated from API)
const DEFAULT_LIMITS: ContentLimits = {
  maxChars: 30000,
  maxCharsFormatted: '30,000',
  approximatePages: 15,
  approximateWords: 5000,
  fileMaxSizeMB: 10,
  supportedFormats: ['PDF', 'DOCX', 'PPTX', 'TXT'],
}

export default function Create() {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limits, setLimits] = useState<ContentLimits>(DEFAULT_LIMITS)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const usageInfo = getUsageInfo()

  // Fetch limits from API
  useEffect(() => {
    api.process.getLimits()
      .then(setLimits)
      .catch(console.error)
  }, [])

  const charCount = text.length
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const isOverLimit = charCount > limits.maxChars
  const hasContent = text.trim().length > 0 || fileName || url.trim().length > 0
  const charPercentage = Math.min((charCount / limits.maxChars) * 100, 100)
  
  // Estimate expected cards (90 words per card target)
  const expectedCards = Math.max(1, Math.ceil(wordCount / 90))

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    setError(null)
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    console.log('📂 [Create.handleFileSelect] File input changed')
    
    const file = e.target.files?.[0]
    console.log('📂 [Create.handleFileSelect] Selected file:', file ? { name: file.name, size: file.size, type: file.type } : 'NO FILE')
    
    if (!file) {
      console.log('📂 [Create.handleFileSelect] No file selected, returning')
      return
    }

    const maxSize = limits.fileMaxSizeMB * 1024 * 1024

    // Validate file size
    if (file.size > maxSize) {
      console.log('📂 [Create.handleFileSelect] File too large:', file.size, '>', maxSize)
      setError(`File size must be under ${limits.fileMaxSizeMB}MB`)
      return
    }

    // Validate file type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const acceptedFormats = limits.supportedFormats.map(f => `.${f.toLowerCase()}`)
    console.log('📂 [Create.handleFileSelect] File extension:', ext, 'Accepted:', acceptedFormats)
    
    if (!acceptedFormats.includes(ext)) {
      console.log('📂 [Create.handleFileSelect] Invalid file type')
      setError(`Please upload ${limits.supportedFormats.join(', ')} files`)
      return
    }

    console.log('📂 [Create.handleFileSelect] File validated successfully')
    setFileName(file.name)
    setSelectedFile(file)
    setError(null)
    
    // For text files, read content directly
    if (ext === '.txt') {
      console.log('📂 [Create.handleFileSelect] TXT file - reading content')
      const reader = new FileReader()
      reader.onload = (e) => {
        let content = e.target?.result as string
        console.log('📂 [Create.handleFileSelect] TXT content read, length:', content.length)
        // Trim to limit
        if (content.length > limits.maxChars) {
          content = content.slice(0, limits.maxChars)
          setError(`Content trimmed to ${limits.maxCharsFormatted} characters (Gemini limit)`)
        }
        setText(content)
      }
      reader.readAsText(file)
    } else {
      console.log('📂 [Create.handleFileSelect] Non-TXT file - will upload to server')
    }
  }

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    setError(null)
  }

  const handleGenerate = () => {
    console.log('🚀 [Create] handleGenerate called')
    console.log('🚀 [Create] hasContent:', hasContent)
    console.log('🚀 [Create] selectedFile:', selectedFile?.name, selectedFile?.size, selectedFile?.type)
    console.log('🚀 [Create] text length:', text.length)
    console.log('🚀 [Create] isAuthenticated:', api.auth.isAuthenticated())
    
    if (!hasContent) {
      setError('Please add some content first')
      return
    }

    // Check usage limit for authenticated users
    if (api.auth.isAuthenticated() && hasReachedLimit()) {
      console.log('🚀 [Create] Usage limit reached, showing modal')
      setShowLimitModal(true)
      return
    }

    // Check if trying to upload file without being logged in
    if (selectedFile && !text.trim() && !api.auth.isAuthenticated()) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase()
      if (ext !== 'txt') {
        setError('Please log in to upload PDF, DOCX, or PPTX files. These require server-side processing.')
        return
      }
    }

    if (isOverLimit) {
      setError(`Text exceeds ${limits.maxCharsFormatted} character limit`)
      return
    }

    // Prepare content object
    const content = {
      text: text.slice(0, limits.maxChars), // Ensure within limit
      title: fileName?.replace(/\.[^/.]+$/, '') || 'Study Notes', // Use filename without extension as title
      fileName,
      url,
    }

    console.log('🚀 [Create] Content prepared:', { ...content, text: content.text.slice(0, 100) + '...' })
    console.log('🚀 [Create] Navigating to /processing with file:', !!selectedFile)

    // Store text content in sessionStorage as backup
    sessionStorage.setItem('microscroll_content', JSON.stringify(content))

    // Navigate with file in state (files can't be stored in sessionStorage)
    navigate('/processing', {
      state: {
        content,
        file: selectedFile, // Pass file directly through navigation state
      }
    })
  }

  const clearFile = () => {
    setFileName(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Get progress bar color
  const getProgressColor = () => {
    if (charPercentage >= 100) return 'bg-red-500'
    if (charPercentage >= 80) return 'bg-amber-500'
    return 'bg-primary'
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Usage Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 mx-5 max-w-sm w-full shadow-xl animate-fade-in-up">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-amber-600 text-[32px]">warning</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Generation Limit Reached</h3>
              <p className="text-slate-600 mb-2">
                You've used all <span className="font-semibold">{usageInfo.limit}</span> free card generations.
              </p>
              <p className="text-slate-500 text-sm mb-6">
                Upgrade to Pro for unlimited AI-powered card generation and advanced features.
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => navigate('/membership')}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
                  Purchase Membership
                </button>
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 active:scale-[0.98] transition-all"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background-light/90 backdrop-blur-md border-b border-slate-200/50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-[24px] text-slate-900">close</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-slate-900 absolute left-1/2 -translate-x-1/2">
          Create
        </h1>
        <div className="w-10" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-32">
        {/* Usage Limit Info - Only for authenticated users */}
        {api.auth.isAuthenticated() && (
          <div className="px-5 pt-4">
            <div className={`flex items-center justify-between p-3 rounded-xl border ${
              usageInfo.hasReachedLimit 
                ? 'bg-red-50 border-red-200' 
                : usageInfo.remaining === 1
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${
                  usageInfo.hasReachedLimit ? 'text-red-500' : usageInfo.remaining === 1 ? 'text-amber-500' : 'text-slate-500'
                }`}>
                  {usageInfo.hasReachedLimit ? 'block' : 'bolt'}
                </span>
                <span className={`text-sm font-medium ${
                  usageInfo.hasReachedLimit ? 'text-red-700' : usageInfo.remaining === 1 ? 'text-amber-700' : 'text-slate-600'
                }`}>
                  {usageInfo.hasReachedLimit 
                    ? 'Free limit reached' 
                    : `${usageInfo.remaining} free generation${usageInfo.remaining !== 1 ? 's' : ''} left`
                  }
                </span>
              </div>
              <button
                onClick={() => navigate('/membership')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  usageInfo.hasReachedLimit 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {usageInfo.hasReachedLimit ? 'Upgrade Now' : 'Upgrade'}
              </button>
            </div>
          </div>
        )}

        {/* Headline */}
        <div className="px-5 pt-6 pb-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            Add your study material
          </h2>
          <p className="text-slate-500 text-base font-medium mt-2 leading-relaxed">
            Paste your notes below to convert them into bite-sized learning cards.
          </p>
        </div>

        {/* Content Limit Info Box */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">auto_awesome</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-700">
                TikTok-style Micro-Learning Cards
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Max: {limits.maxCharsFormatted} chars • ~90 words per card
              </p>
            </div>
          </div>
        </div>
        
        {/* Expected Cards Preview */}
        {wordCount > 20 && (
          <div className="px-5 pb-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600 text-[18px]">style</span>
                <span className="text-sm font-medium text-green-700">
                  ~{expectedCards} cards will be generated
                </span>
              </div>
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                {wordCount.toLocaleString()} words
              </span>
            </div>
          </div>
        )}

        {/* Text area */}
        <div className="px-5 py-2">
          <div className="relative group">
            {/* Glow effect on focus */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-400 rounded-2xl opacity-0 group-focus-within:opacity-20 transition duration-300 blur" />
            
            <textarea
              value={text}
              onChange={handleTextChange}
              className="relative w-full min-h-[240px] p-5 pb-12 rounded-2xl bg-white border border-slate-200 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:border-primary resize-none shadow-sm transition-all"
              placeholder="Paste your lecture notes, summaries, or raw text here..."
            />

            {/* Character count bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-slate-50 rounded-b-2xl border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${isOverLimit ? 'text-red-500' : 'text-slate-500'}`}>
                    {charCount.toLocaleString()} chars
                  </span>
                  {wordCount > 0 && (
                    <span className="text-xs text-slate-400">
                      • {wordCount.toLocaleString()} words
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {isOverLimit ? '⚠️ Over limit' : wordCount > 20 ? `≈${expectedCards} cards` : 'Start typing...'}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${getProgressColor()}`}
                  style={{ width: `${charPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* File indicator */}
        {fileName && (
          <div className="px-5 py-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
              <span className="material-symbols-outlined text-green-600">description</span>
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700 truncate block">{fileName}</span>
                <span className="text-xs text-green-600">Ready to process</span>
              </div>
              <button
                onClick={clearFile}
                className="p-1 rounded-full hover:bg-green-100 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500 text-[20px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* URL input */}
        {showUrlInput && (
          <div className="px-5 py-3">
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://example.com/article"
                className="w-full p-4 pr-10 rounded-xl bg-white border border-slate-200 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary transition-all"
              />
              <button
                onClick={() => {
                  setShowUrlInput(false)
                  setUrl('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-400 text-[20px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
              <span className="text-sm font-medium text-red-600">{error}</span>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Or import from
          </span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        {/* Import options */}
        <div className="px-5 grid grid-cols-2 gap-4">
          {/* Upload File */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl bg-white border border-slate-200 hover:border-primary hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">Upload File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={limits.supportedFormats.map(f => `.${f.toLowerCase()}`).join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Import URL */}
          <button
            onClick={() => setShowUrlInput(true)}
            className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl bg-white border border-slate-200 hover:border-primary hover:bg-slate-50 transition-all group shadow-sm"
          >
            <div className="size-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">link</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">Import URL</span>
          </button>
        </div>

        {/* Supported formats info */}
        <div className="px-5 pt-6">
          <p className="text-xs text-slate-400 text-center">
            Supports {limits.supportedFormats.join(', ')} (max {limits.fileMaxSizeMB}MB)
          </p>
          <p className="text-xs text-slate-400 text-center mt-1">
            Powered by Google Gemini AI
          </p>
        </div>
      </main>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto p-5 bg-gradient-to-t from-background-light via-background-light to-transparent pt-8 z-10">
        <Button
          onClick={handleGenerate}
          icon="auto_awesome"
          size="lg"
          className="w-full"
          disabled={!hasContent || isOverLimit}
        >
          Generate Cards
        </Button>
      </div>
    </div>
  )
}
