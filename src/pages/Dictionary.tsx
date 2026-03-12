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

  const inputRef = useRef<HTMLInputElement>(null)

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
    return `${API_BASE_URL}/static/${gloss}/${imgName}`
  }

  const search = async (query: string, isVoice: boolean = false) => {
    if (!query) return
    try {
      setLoading(true)
      setError(null)
      setReported(false) // Reset report status for new search

      const resp = await fetch(`${API_BASE_URL}/api/dictionary/search?q=${encodeURIComponent(query)}`)
      const data = await resp.json()
      setResult(data)

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
      const history = JSON.parse(localStorage.getItem('search_history') || '[]')
      if (!history.includes(query)) {
        localStorage.setItem('search_history', JSON.stringify([query, ...history].slice(0, 10)))
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
      setError(null)
      const resp = await fetch(`${API_BASE_URL}/api/dictionary/list?letter=${encodeURIComponent(ltr)}`)
      const data = await resp.json()
      setList(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setList([])
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

      {/* Header */}
      <div className={`sticky top-0 z-50 ${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-b-2' : 'glass border-b border-white/20'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                onClick={() => navigate('/')}
                className={`
                  ${getButtonSize()} rounded-2xl flex items-center justify-center
                  ${accessibility.highContrast
                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400'
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-white/40 dark:border-white/10'
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
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-white/40 dark:border-white/10'
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

      {/* Main Container with bottom padding for sticky mobile input */}
      <div className="max-w-5xl mx-auto px-6 py-12 pb-32 relative z-10 flex flex-col">
        {/* 1. Search Results (Top on mobile) */}
        <div className="order-1">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white animate-pulse tracking-tight">Accessing Dictionary...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="glass-card p-6 border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 flex items-center gap-4 mb-12 animate-slide-up">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertTriangle size={24} />
              </div>
              <p className={`${getTextSize()} font-bold text-rose-700 dark:text-rose-400`}>{error}</p>
            </div>
          )}

          {/* Actual Results */}
          {result && !loading && (
            <div className="animate-slide-up">
              {result.gloss ? (
                <div className="glass-card overflow-hidden border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] transition-all duration-500 mb-12">
                  {/* Result Header */}
                  <div className="p-6 sm:p-8 border-b border-white/20 bg-white/30 dark:bg-white/5 backdrop-blur-md">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <BookOpen size={24} />
                          </div>
                          <h2 className={`${getHeaderSize()} font-black text-slate-900 dark:text-white tracking-tighter`}>
                            {result.gloss}
                          </h2>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${getMatchColor(result.match_type)}`}>
                            {result.match_type} Match
                          </span>
                          {result.page && (
                            <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-white/20">
                              <Info size={14} /> Page {result.page}
                            </span>
                          )}
                          {result.variants > 0 && (
                            <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-white/20">
                              <Layers size={14} /> {result.variants} Variants
                            </span>
                          )}
                          <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle size={14} /> {Math.round((result.confidence || 0) * 100)}% Match
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleReport}
                        disabled={reported}
                        className={`
                          flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300
                          ${reported
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 cursor-default'
                            : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10 hover:bg-rose-500 hover:text-white hover:border-rose-500 shadow-sm'
                          }
                          transform hover:scale-105 active:scale-95
                        `}
                      >
                        {reported ? (
                          <>
                            <CheckCircle size={18} />
                            Reported
                          </>
                        ) : (
                          <>
                            <Flag size={18} />
                            Report Issue
                          </>
                        )}
                      </button>
                    </div>

                    {result.description && (
                      <div className="mt-8 flex gap-4 p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 backdrop-blur-sm">
                        <MessageSquare size={24} className="text-blue-500 shrink-0" />
                        <p className={`${getTextSize()} font-medium text-slate-700 dark:text-slate-300 leading-relaxed`}>
                          {result.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Images Grid */}
                  <div className="p-4 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {Array.isArray(result.images) && result.images.length > 0 ? (
                        result.images.map((img: string, i: number) => (
                          <div
                            key={i}
                            className="relative group cursor-pointer overflow-hidden rounded-3xl border border-amber-500/30 bg-white/50 dark:bg-slate-900/50 shadow-sm transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] hover:border-amber-400/80"
                            onClick={() => openImageModal(`${API_BASE_URL}/static/${result.gloss}/${img}`, i)}
                          >
                            <div className="aspect-square flex items-center justify-center p-4">
                              <img
                                src={getImageUrl(result.gloss, img)}
                                alt={`${result.gloss} sign frame ${i + 1}`}
                                className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-700"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=Sign+Image+Unavailable';
                                }}
                              />
                            </div>

                            <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all duration-500 flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-[2px]">
                              <div className="bg-white/90 dark:bg-slate-900/90 p-4 rounded-2xl shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-500">
                                <ZoomIn className="text-blue-600" size={32} />
                              </div>
                            </div>

                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/20">
                                Frame {i + 1}
                              </div>
                              <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-lg">
                                Zoom View
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                          <AlertTriangle size={48} className="mb-4 opacity-20" />
                          <span className="text-lg font-bold tracking-tight">Visual sequence unavailable</span>
                          <p className="text-sm font-medium mt-1">We're working on adding more signs.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alternatives Section */}
                  {Array.isArray(result.alternatives) && result.alternatives.length > 0 && (
                    <div className="bg-blue-500/5 border-t border-white/20 p-6 sm:p-8">
                      <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-4 sm:mb-6">Suggested / Related Signs</h3>
                      <div className="flex flex-wrap gap-3">
                        {result.alternatives.map((alt) => (
                          <button
                            key={alt}
                            onClick={() => {
                              setQ(alt)
                              search(alt, false)
                            }}
                            className="px-6 py-3 bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border border-white/40 dark:border-white/10 rounded-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-sm text-sm font-bold transform hover:scale-105 active:scale-95"
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-card p-8 sm:p-16 text-center animate-fade-in mx-4 sm:mx-0 mb-12">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <AlertTriangle className="w-10 h-10 text-amber-500 opacity-80" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">No exact match found</h3>
                  <p className={`${getTextSize()} text-slate-600 dark:text-slate-400 mb-10 max-w-md mx-auto leading-relaxed`}>
                    We couldn't find a direct sign for <span className="text-blue-500 font-bold">"{q}"</span>. Try one of our suggested alternatives below.
                  </p>

                  {/* Fallback alternatives for no match */}
                  {Array.isArray(result.alternatives) && result.alternatives.length > 0 && (
                    <div className="flex flex-wrap gap-3 justify-center">
                      {result.alternatives.map((alt) => (
                        <button
                          key={alt}
                          onClick={() => {
                            setQ(alt)
                            search(alt, false)
                          }}
                          className="px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/30 text-base font-bold transform hover:scale-105 active:scale-95"
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Search Section (Sticky at Bottom on mobile) */}
        <div className="sticky bottom-0 left-0 right-0 z-40 order-2 -mx-6 px-6 py-6 mt-auto sm:static sm:z-auto sm:mx-0 sm:px-0 sm:py-0 sm:mt-12 animate-slide-up bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-t border-white/20 sm:bg-transparent sm:dark:bg-transparent sm:backdrop-blur-none sm:border-none">
          <div className="relative group max-w-5xl mx-auto">
            <div className={`absolute inset-y-0 left-5 flex items-center pointer-events-none transition-colors duration-300 ${isListening ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-blue-500'}`}>
              <Search size={24} />
            </div>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={isListening}
              placeholder={isListening ? "Listening..." : "Search for a word (e.g., dog, hello)..."}
              className={`
                w-full pl-12 sm:pl-14 pr-16 py-4 sm:py-6 rounded-[2rem] border-2 transition-all duration-500 outline-none
                ${accessibility.largeText ? 'text-xl sm:text-2xl' : 'text-base sm:text-xl'}
                ${isListening
                  ? 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                  : 'bg-white/50 dark:bg-slate-900/50 border-white/40 dark:border-white/10 focus:border-blue-500/50 dark:focus:border-blue-400/50 shadow-glass focus:shadow-glass-hover'
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

          {isListening && (
            <div className="mt-4 flex items-center justify-center gap-3 text-rose-500 animate-pulse">
              <div className="flex gap-1">
                <span className="w-1.5 h-4 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-6 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></span>
                <span className="w-1.5 h-4 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
              </div>
              <span className="text-sm font-black uppercase tracking-widest">Listening... Speak clearly</span>
            </div>
          )}
        </div>

        {/* 3. Alphabet Navigation (Bottom on mobile) */}
        {!q && (
          <div className="animate-fade-in space-y-4 order-3">
            <div className="flex items-center gap-3 px-2 mb-2">
              <Layers className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Browse by letter</span>
            </div>
            <div className="glass p-4 rounded-[2.5rem] flex flex-wrap gap-2 justify-center mb-12 shadow-inner">
              {alphabet.map((a) => (
                <button
                  key={a}
                  onClick={() => setLetter(a)}
                  className={`
                    w-11 h-11 sm:w-14 sm:h-14 rounded-2xl font-bold transition-all duration-500 flex items-center justify-center
                    ${letter === a
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/40 scale-110 -translate-y-1'
                      : 'bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:scale-105'
                    }
                    ${accessibility.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}
                    border border-white/20 dark:border-white/5
                  `}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white animate-pulse tracking-tight">Accessing Dictionary...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="glass-card p-6 border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 flex items-center gap-4 mb-12 animate-slide-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertTriangle size={24} />
            </div>
            <p className={`${getTextSize()} font-bold text-rose-700 dark:text-rose-400`}>{error}</p>
          </div>
        )}

        {/* Search Results */}
        {result && !loading && (
          <div className="animate-slide-up">
            {result.gloss ? (
              <div className="glass-card overflow-hidden border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] transition-all duration-500">
                {/* Result Header */}
                <div className="p-6 sm:p-8 border-b border-white/20 bg-white/30 dark:bg-white/5 backdrop-blur-md">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <BookOpen size={24} />
                        </div>
                        <h2 className={`${getHeaderSize()} font-black text-slate-900 dark:text-white tracking-tighter`}>
                          {result.gloss}
                        </h2>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${getMatchColor(result.match_type)}`}>
                          {result.match_type} Match
                        </span>
                        {result.page && (
                          <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-white/20">
                            <Info size={14} /> Page {result.page}
                          </span>
                        )}
                        {result.variants > 0 && (
                          <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-white/20">
                            <Layers size={14} /> {result.variants} Variants
                          </span>
                        )}
                        <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle size={14} /> {Math.round((result.confidence || 0) * 100)}% Match
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleReport}
                      disabled={reported}
                      className={`
                        flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300
                        ${reported
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 cursor-default'
                          : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10 hover:bg-rose-500 hover:text-white hover:border-rose-500 shadow-sm'
                        }
                        transform hover:scale-105 active:scale-95
                      `}
                    >
                      {reported ? (
                        <>
                          <CheckCircle size={18} />
                          Reported
                        </>
                      ) : (
                        <>
                          <Flag size={18} />
                          Report Issue
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Images Grid */}
                <div className="p-4 sm:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {Array.isArray(result.images) && result.images.length > 0 ? (
                      result.images.map((img: string, i: number) => (
                        <div key={i} className="flex flex-col gap-6">
                          <div
                            className="relative group cursor-pointer overflow-hidden rounded-3xl border border-amber-500/30 bg-white/50 dark:bg-slate-900/50 shadow-sm transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] hover:border-amber-400/80"
                            onClick={() => openImageModal(`${API_BASE_URL}/static/${img}`, i)}
                          >
                            <div className="aspect-square flex items-center justify-center p-4">
                              <img
                                src={getImageUrl(result.gloss, img)}
                                alt={`${result.gloss} sign frame ${i + 1}`}
                                className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-700"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=Sign+Image+Unavailable';
                                }}
                              />
                            </div>

                            <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all duration-500 flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-[2px]">
                              <div className="bg-white/90 dark:bg-slate-900/90 p-4 rounded-2xl shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-500">
                                <ZoomIn className="text-blue-600" size={32} />
                              </div>
                            </div>

                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/20">
                                Frame {i + 1}
                              </div>
                              <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-lg">
                                Zoom View
                              </div>
                            </div>
                          </div>

                          {/* Sign Definition - Matches User Request */}
                          <div className="text-center px-4 pb-4 animate-fade-in">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                              {result.gloss}
                            </h3>
                            {result.description && (
                              <p className={`${getTextSize()} font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto`}>
                                {result.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400">
                        <AlertTriangle size={48} className="mb-4 opacity-20" />
                        <span className="text-lg font-bold tracking-tight">Visual sequence unavailable</span>
                        <p className="text-sm font-medium mt-1">We're working on adding more signs.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Alternatives Section */}
                {Array.isArray(result.alternatives) && result.alternatives.length > 0 && (
                  <div className="bg-blue-500/5 border-t border-white/20 p-6 sm:p-8">
                    <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-4 sm:mb-6">Suggested / Related Signs</h3>
                    <div className="flex flex-wrap gap-3">
                      {result.alternatives.map((alt) => (
                        <button
                          key={alt}
                          onClick={() => {
                            setQ(alt)
                            search(alt, false)
                          }}
                          className="px-6 py-3 bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border border-white/40 dark:border-white/10 rounded-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-sm text-sm font-bold transform hover:scale-105 active:scale-95"
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card p-8 sm:p-16 text-center animate-fade-in mx-4 sm:mx-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 sm:mb-8">
                  <AlertTriangle className="w-10 h-10 text-amber-500 opacity-80" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">No exact match found</h3>
                <p className={`${getTextSize()} text-slate-600 dark:text-slate-400 mb-10 max-w-md mx-auto leading-relaxed`}>
                  We couldn't find a direct sign for <span className="text-blue-500 font-bold">"{q}"</span>. Try one of our suggested alternatives below.
                </p>

                {/* Fallback alternatives for no match */}
                {Array.isArray(result.alternatives) && result.alternatives.length > 0 && (
                  <div className="flex flex-wrap gap-3 justify-center">
                    {result.alternatives.map((alt) => (
                      <button
                        key={alt}
                        onClick={() => {
                          setQ(alt)
                          search(alt, false)
                        }}
                        className="px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/30 text-base font-bold transform hover:scale-105 active:scale-95"
                      >
                        {alt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Letter Glosses List (Last on mobile) */}
        {!q && list && list.length > 0 && (
          <div className="animate-fade-in order-4">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Layers size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                Glosses starting with <span className="text-indigo-500">"{letter}"</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((item) => (
                <button
                  key={item.gloss}
                  onClick={() => {
                    setQ(item.gloss)
                    search(item.gloss, false)
                  }}
                  className="glass-card p-6 text-left group border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)] transition-all duration-500 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors tracking-tight" >
                      {item.gloss}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {item.variants} Var
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    <BookOpen size={14} />
                    Page {item.page || 'N/A'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dictionary

