import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { api, ContentLimits } from '../lib/api'

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

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
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = limits.fileMaxSizeMB * 1024 * 1024

    // Validate file size
    if (file.size > maxSize) {
      setError(`File size must be under ${limits.fileMaxSizeMB}MB`)
      return
    }

    // Validate file type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const acceptedFormats = limits.supportedFormats.map(f => `.${f.toLowerCase()}`)
    if (!acceptedFormats.includes(ext)) {
      setError(`Please upload ${limits.supportedFormats.join(', ')} files`)
      return
    }

    setFileName(file.name)
    setSelectedFile(file)
    setError(null)
    
    // For text files, read content directly
    if (ext === '.txt') {
      const reader = new FileReader()
      reader.onload = (e) => {
        let content = e.target?.result as string
        // Trim to limit
        if (content.length > limits.maxChars) {
          content = content.slice(0, limits.maxChars)
          setError(`Content trimmed to ${limits.maxCharsFormatted} characters (Gemini limit)`)
        }
        setText(content)
      }
      reader.readAsText(file)
    }
  }

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    setError(null)
  }

  const handleGenerate = () => {
    if (!hasContent) {
      setError('Please add some content first')
      return
    }

    if (isOverLimit) {
      setError(`Text exceeds ${limits.maxCharsFormatted} character limit`)
      return
    }

    // Store content in sessionStorage for processing page
    sessionStorage.setItem('microscroll_content', JSON.stringify({
      text: text.slice(0, limits.maxChars), // Ensure within limit
      fileName,
      url,
      hasFile: !!selectedFile,
    }))

    // Store file separately if needed
    if (selectedFile) {
      // Store file reference for processing page
      sessionStorage.setItem('microscroll_file_name', selectedFile.name)
    }

    navigate('/processing')
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
