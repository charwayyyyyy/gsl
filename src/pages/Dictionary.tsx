import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic, MicOff, ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight,
  AlertTriangle, BookOpen, Layers, CheckCircle, Flag,
  MessageSquare, Search, ArrowLeft, Info, HelpCircle
} from 'lucide-react'
import { analytics } from '../services/analytics'
import { useAppStore } from '../stores/appStore'
import { API_BASE_URL } from '@/config'

// Add interface for SpeechRecognition
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

interface SignResult {
  gloss: string
  images: string[]
  description: string
  page?: number
  confidence: number
  alternatives: string[]
  match_type: string
  variants: number
}

const Dictionary: React.FC = () => {
  const navigate = useNavigate()
  const { accessibility } = useAppStore(state => state.settings)
  const [q, setQ] = useState('')
  const [result, setResult] = useState<SignResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [letter, setLetter] = useState<string>('A')
  const [list, setList] = useState<any[]>([])
  const [reported, setReported] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [relatedSigns, setRelatedSigns] = useState<any[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize history and cache
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('search_history') || '[]')
    setHistory(saved)
  }, [])

  const suggestions = ['Hello', 'Thank you', 'Teacher', 'Student', 'Ghana', 'Water']

  // Image zoom modal state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [zoomLevel, setZoomLevel] = useState(1)

  // Helper for responsive text sizing
  const getTextSize = () => accessibility.largeText ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
  const getHeaderSize = () => accessibility.largeText ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
  const getButtonSize = () => accessibility.largeText ? 'p-5' : 'p-3'

  const getImageUrl = (gloss: string, imgName: string) => {
    // In production, images are served from /static/GLOSS/imagename.png
    // If imgName already contains the gloss prefix (e.g. "DOG/dog_p1.png"), don't duplicate it
    if (imgName.includes('/')) {
      return `${API_BASE_URL}/static/${imgName}`
    }
    return `${API_BASE_URL}/static/${gloss}/${imgName}`
  }

  // Fetch related signs based on current gloss
  const fetchRelatedSigns = async (gloss: string) => {
    try {
      // Simple keyword similarity via list API (prefix matching)
      const firstLetter = gloss.charAt(0).toUpperCase()
      const resp = await fetch(`${API_BASE_URL}/api/dictionary/list?letter=${encodeURIComponent(firstLetter)}`)
      if (resp.ok) {
        const data = await resp.json()
        const items = Array.isArray(data?.items) ? data.items : []
        // Filter out the current gloss and pick 3 random ones from the same letter
        const filtered = items.filter((item: any) => item.gloss.toUpperCase() !== gloss.toUpperCase())
        setRelatedSigns(filtered.sort(() => 0.5 - Math.random()).slice(0, 3))
      }
    } catch (e) {
      console.error('Failed to fetch related signs', e)
    }
  }

  const search = async (query: string, isVoice: boolean = false) => {
    if (!query) return
    try {
      setLoading(true)
      setError(null)
      setReported(false) // Reset report status for new search
      setResult(null) // Clear previous result to show loading state better
      setRelatedSigns([]) // Clear related signs

      // Check local cache first
      const cacheKey = `dict_cache_${query.toLowerCase()}`
      const cachedData = localStorage.getItem(cacheKey)
      
      let data;
      if (cachedData) {
        data = JSON.parse(cachedData)
      } else {
        const resp = await fetch(`${API_BASE_URL}/api/dictionary/search?q=${encodeURIComponent(query)}`, {
          // Simple retry logic
          signal: AbortSignal.timeout(5000)
        })
        if (!resp.ok) throw new Error(`Search failed: ${resp.status}`)
        data = await resp.json()
        
        // Cache valid results for 24 hours
        if (data && data.gloss) {
          localStorage.setItem(cacheKey, JSON.stringify(data))
        }
      }
      
      // Handle the case where the API returns a success but no data (shouldn't happen with our backend but good to check)
      if (!data) {
        setResult({ gloss: '', images: [], description: 'No results found', match_type: 'None', confidence: 0, alternatives: [], variants: 0 })
      } else {
        setResult(data)
        if (data.gloss) {
          fetchRelatedSigns(data.gloss)
        }
      }

      // Track analytics
      analytics.track({
        event_type: isVoice ? 'voice_search' : 'search',
        data: {
          query,
          success: !!data.gloss,
          match_type: data.match_type,
          confidence: data.confidence
        }
      })

      // Save to local history
      const savedHistory = JSON.parse(localStorage.getItem('search_history') || '[]')
      if (!savedHistory.includes(query)) {
        const newHistory = [query, ...savedHistory].slice(0, 5)
        localStorage.setItem('search_history', JSON.stringify(newHistory))
        setHistory(newHistory)
      }
    } catch (e: any) {
      setError('Failed to search dictionary')
      analytics.track({
        event_type: 'error',
        data: { query, error: e.message }
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false)
      return
    }

    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow
    const Recognition = SpeechRecognition || webkitSpeechRecognition

    if (!Recognition) {
      setError('Speech recognition not supported. Please type your search.')
      inputRef.current?.focus()
      return
    }

    try {
      const recognition = new Recognition()
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setQ(transcript)
        search(transcript, true)
      }

      recognition.onerror = (event: any) => {
        console.error(event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please check your settings.')
        } else {
          setError('Voice search failed. Please try typing.')
        }
        // Auto-fallback to keyboard
        inputRef.current?.focus()
      }

      recognition.start()
    } catch (e) {
      setError('Failed to start voice search.')
      inputRef.current?.focus()
    }
  }

  const handleReport = () => {
    if (!result || reported) return
    analytics.reportFeedback({
      gloss: result.gloss,
      reason: 'Unclear sign or image'
    })
    setReported(true)
  }

  const fetchList = async (ltr: string) => {
    try {
      setLoading(true) // Show loading for alphabet browsing too
      setError(null)
      const resp = await fetch(`${API_BASE_URL}/api/dictionary/list?letter=${encodeURIComponent(ltr)}`)
      if (!resp.ok) throw new Error('Failed to load dictionary list')
      const data = await resp.json()
      setList(Array.isArray(data?.items) ? data.items : [])
    } catch (e: any) {
      setError(e.message || 'Failed to load signs starting with ' + ltr)
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim()) search(q.trim(), false)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    fetchList(letter)
  }, [letter])

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  const openImageModal = (src: string, index: number) => {
    setSelectedImage(src)
    setSelectedImageIndex(index)
    setZoomLevel(1)
  }

  const closeImageModal = () => {
    setSelectedImage(null)
    setZoomLevel(1)
  }

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation()
    setZoomLevel(prev => Math.min(prev + 0.5, 4))
  }

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation()
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5))
  }

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!result?.images) return
    const newIndex = (selectedImageIndex - 1 + result.images.length) % result.images.length
    setSelectedImageIndex(newIndex)
    setSelectedImage(`${API_BASE_URL}/static/${result.images[newIndex]}`)
    setZoomLevel(1)
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!result?.images) return
    const newIndex = (selectedImageIndex + 1) % result.images.length
    setSelectedImageIndex(newIndex)
    setSelectedImage(`${API_BASE_URL}/static/${result.images[newIndex]}`)
    setZoomLevel(1)
  }

  // Keyboard navigation for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return

      if (e.key === 'Escape') closeImageModal()
      if (e.key === 'ArrowLeft') handlePrevImage(e as any)
      if (e.key === 'ArrowRight') handleNextImage(e as any)
      if (e.key === '+' || e.key === '=') handleZoomIn(e as any)
      if (e.key === '-') handleZoomOut(e as any)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, selectedImageIndex, zoomLevel])

  const getMatchColor = (type: string) => {
    switch (type) {
      case 'Exact': return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      case 'Prefix': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
      case 'Semantic': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30'
      case 'Related': return 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30'
      default: return 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30'
    }
  }

  return (
    <div className={`min-h-screen relative overflow-hidden ${accessibility.highContrast ? 'bg-black text-yellow-400' : 'bg-slate-50 dark:bg-slate-950'}`}>
      {/* Background Orbs */}
      {!accessibility.highContrast && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '-2s' }} />
        </>
      )}

      {/* Mode Header */}
      <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-b-2' : 'bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                onClick={() => navigate('/')}
                className={`
                  ${getButtonSize()} rounded-2xl flex items-center justify-center
                  ${accessibility.highContrast
                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400'
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-slate-200/60 dark:border-white/10'
                  }
                  transform hover:scale-110 active:scale-95 transition-all duration-300
                  focus:outline-none focus:ring-4 focus:ring-blue-300/50
                `}
                aria-label="Go back to home"
              >
                <ArrowLeft className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>

              <div>
                <h1 className={`${accessibility.largeText ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} font-serif italic tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                  SignBridge Ghana
                </h1>
                <p className={`${accessibility.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-sm'} font-sans font-black uppercase tracking-[0.2em] ${accessibility.highContrast ? 'text-yellow-300' : 'text-blue-500 dark:text-blue-400'}`}>
                  Visual Reference
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/help')}
                className={`
                  ${getButtonSize()} rounded-2xl flex items-center justify-center transition-all duration-300
                  ${accessibility.highContrast
                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400'
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-slate-200/60 dark:border-white/10'
                  }
                  transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300/30
                `}
                aria-label="Help"
              >
                <HelpCircle className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-fade-in"
          onClick={closeImageModal}
        >
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={selectedImage}
              alt="Zoomed view"
              className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out shadow-2xl rounded-3xl"
              style={{ transform: `scale(${zoomLevel})` }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Navigation Controls */}
            {result?.images && result.images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-8 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all transform hover:scale-110 active:scale-95 border border-white/10"
                  title="Previous Image (Left Arrow)"
                >
                  <ChevronLeft size={32} />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-8 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all transform hover:scale-110 active:scale-95 border border-white/10"
                  title="Next Image (Right Arrow)"
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}

            {/* Zoom Controls */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-white/10 backdrop-blur-xl px-8 py-4 rounded-3xl text-white border border-white/10 shadow-2xl">
              <button
                onClick={handleZoomOut}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut size={28} />
              </button>
              <span className="font-mono text-xl w-20 text-center select-none font-bold tracking-tighter">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn size={28} />
              </button>
            </div>

            <button
              onClick={closeImageModal}
              className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all transform hover:scale-110 active:scale-95 border border-white/10"
              title="Close (Esc)"
            >
              <X size={32} />
            </button>

            {/* Image Counter */}
            {result?.images && result.images.length > 1 && (
              <div className="absolute top-8 left-8 px-5 py-2.5 bg-white/10 backdrop-blur-md text-white rounded-2xl text-sm font-bold border border-white/10 tracking-widest">
                {selectedImageIndex + 1} / {result.images.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10 flex flex-col">
        
        {/* Search Section (Primary Entry Point) */}
        <div className="mb-12 animate-slide-up">
          <div className="relative group">
            <div className={`absolute inset-y-0 left-5 flex items-center pointer-events-none transition-colors duration-300 ${isListening ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-blue-500'}`}>
              <Search size={24} />
            </div>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={isListening}
              placeholder={isListening ? "Listening..." : "Search for a word (e.g., hello, teacher)..."}
              className={`
                w-full pl-12 sm:pl-14 pr-16 py-5 sm:py-7 rounded-[2rem] border-2 transition-all duration-500 outline-none
                ${accessibility.largeText ? 'text-xl sm:text-2xl' : 'text-base sm:text-xl'}
                ${isListening
                  ? 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                  : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-blue-500/50 dark:focus:border-blue-400/50 shadow-sm focus:shadow-xl'
                }
                backdrop-blur-xl
              `}
            />
            <button
              onClick={toggleListening}
              disabled={loading}
              className={`
                absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-2xl transition-all duration-500
                ${isListening
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500'
                }
              `}
              title={loading ? "Please wait..." : "Search by voice"}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
          </div>

          {/* Search Suggestions & History */}
          <div className="mt-6 flex flex-wrap gap-2 items-center">
            {history.length > 0 && (
              <div className="flex flex-wrap gap-2 mr-4 border-r border-slate-200 dark:border-slate-800 pr-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2 w-full mb-1">Recent</span>
                {history.map(h => (
                  <button key={h} onClick={() => { setQ(h); search(h) }} className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-500 hover:text-white transition-all">
                    {h}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2 w-full mb-1">Try these</span>
              {suggestions.map(s => (
                <button key={s} onClick={() => { setQ(s); search(s) }} className="px-3 py-1 text-xs font-bold rounded-full bg-blue-500/5 text-blue-600 dark:text-blue-400 border border-blue-500/10 hover:bg-blue-500 hover:text-white transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results / Alphabet Section */}
        <div className="space-y-12">
          {/* Loading Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-10 animate-pulse">
              {[1, 2].map(i => (
                <div key={i} className="h-96 rounded-[2.5rem] bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="glass-card p-6 border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 flex items-center gap-4 animate-slide-up">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertTriangle size={24} />
              </div>
              <p className={`${getTextSize()} font-bold text-rose-700 dark:text-rose-400`}>{error}</p>
            </div>
          )}

          {/* Search Result */}
          {result && !loading && (
            <div className="animate-slide-up">
              {result.gloss ? (
                <div className="glass-card overflow-hidden border-amber-500/30 shadow-2xl transition-all duration-500">
                  {/* Result Header */}
                  <div className="p-6 sm:p-10 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                            <BookOpen size={28} />
                          </div>
                          <h2 className={`${getHeaderSize()} font-black text-slate-900 dark:text-white tracking-tighter uppercase`}>
                            {result.gloss}
                          </h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getMatchColor(result.match_type)}`}>
                            {result.match_type} Match
                          </span>
                          {result.page && (
                            <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                              Page {result.page}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button onClick={handleReport} disabled={reported} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reported ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-500 hover:text-white'}`}>
                        {reported ? <CheckCircle size={16} /> : <Flag size={16} />}
                        {reported ? 'Reported' : 'Report Error'}
                      </button>
                    </div>

                    {result.description && (
                      <div className="p-6 rounded-3xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5">
                        <p className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic`}>
                          "{result.description}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Images */}
                  <div className="p-6 sm:p-10 bg-slate-50/50 dark:bg-black/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {result.images.length > 0 ? (
                        result.images.map((img, i) => (
                          <div key={i} className="relative group cursor-pointer overflow-hidden rounded-[2rem] border-2 border-white dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900" onClick={() => openImageModal(getImageUrl(result.gloss, img), i)}>
                            <div className="aspect-video flex items-center justify-center p-6">
                              <img src={getImageUrl(result.gloss, img)} alt={result.gloss} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                            </div>
                            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest">
                              Step {i + 1}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-40">
                          <AlertTriangle size={48} className="mb-4" />
                          <span className="font-bold uppercase tracking-widest">No diagrams available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Related Signs */}
                  {relatedSigns.length > 0 && (
                    <div className="p-6 sm:p-10 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-black/5">
                      <div className="flex items-center gap-3 mb-6">
                        <Layers className="w-5 h-5 text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Related Signs</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {relatedSigns.map(item => (
                          <button key={item.gloss} onClick={() => { setQ(item.gloss); search(item.gloss) }} className="p-4 text-left glass-card border-slate-200 dark:border-slate-800 hover:border-blue-500/50 group transition-all bg-white dark:bg-slate-900">
                            <span className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{item.gloss}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center glass-card border-slate-200 dark:border-slate-800">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Search className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No results for "{q}"</h3>
                  <p className="text-slate-500 mb-8">Try searching for common words or browsing the alphabet below.</p>
                </div>
              )}
            </div>
          )}

          {/* Alphabet / Browsing */}
          {!q && !loading && (
            <div className="space-y-12">
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dictionary Index</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{list.length} entries</span>
                </div>
                
                <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 gap-2">
                  {alphabet.map(a => (
                    <button key={a} onClick={() => setLetter(a)} className={`h-12 rounded-xl font-bold transition-all ${letter === a ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 hover:border-blue-500'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {list.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                  {list.map(item => (
                    <button key={item.gloss} onClick={() => { setQ(item.gloss); search(item.gloss) }} className="p-6 text-left glass-card border-slate-200 dark:border-slate-800 hover:border-blue-500/50 group transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{item.gloss}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.variants} Var</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <BookOpen size={12} /> Page {item.page}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dictionary

