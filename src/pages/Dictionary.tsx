import React, { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight, AlertTriangle, BookOpen, Layers, CheckCircle, Flag, MessageSquare } from 'lucide-react'
import { analytics } from '../services/analytics'

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

  const search = async (query: string, isVoice: boolean = false) => {
    if (!query) return
    try {
      setLoading(true)
      setError(null)
      setReported(false) // Reset report status for new search
      
      const resp = await fetch(`http://localhost:8000/api/dictionary/search?q=${encodeURIComponent(query)}`)
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
      const resp = await fetch(`http://localhost:8000/api/dictionary/list?letter=${encodeURIComponent(ltr)}`)
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
    setSelectedImage(`http://localhost:8000/static/${result.gloss}/${result.images[newIndex]}`)
    setZoomLevel(1)
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!result?.images) return
    const newIndex = (selectedImageIndex + 1) % result.images.length
    setSelectedImageIndex(newIndex)
    setSelectedImage(`http://localhost:8000/static/${result.gloss}/${result.images[newIndex]}`)
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
      case 'Exact': return 'bg-green-100 text-green-800 border-green-200'
      case 'Prefix': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Semantic': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Related': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Image Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 animate-in fade-in duration-200"
          onClick={closeImageModal}
        >
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <img 
              src={selectedImage} 
              alt="Zoomed view" 
              className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out"
              style={{ transform: `scale(${zoomLevel})` }}
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Navigation Controls */}
            {result?.images && result.images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full text-white transition-all"
                  title="Previous Image (Left Arrow)"
                >
                  <ChevronLeft size={32} />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full text-white transition-all"
                  title="Next Image (Right Arrow)"
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}

            {/* Zoom Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-900 bg-opacity-75 px-6 py-3 rounded-full text-white backdrop-blur-sm">
              <button 
                onClick={handleZoomOut}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut size={24} />
              </button>
              <span className="font-mono w-16 text-center select-none">{Math.round(zoomLevel * 100)}%</span>
              <button 
                onClick={handleZoomIn}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn size={24} />
              </button>
            </div>
            
            {/* Manual Mode Hint */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black bg-opacity-60 text-white rounded-full text-sm font-medium backdrop-blur-sm">
              Manual Step-Through Mode
            </div>

            <button 
              onClick={closeImageModal}
              className="absolute top-4 right-4 p-2 text-white hover:bg-gray-800 rounded-full transition-colors bg-black bg-opacity-50"
              title="Close (Esc)"
            >
              <X size={32} />
            </button>
            
            {/* Image Counter */}
            {result?.images && result.images.length > 1 && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-black bg-opacity-50 text-white rounded-full text-sm">
                {selectedImageIndex + 1} / {result.images.length}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Text → Sign</h1>
        <div className="relative mb-6">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={isListening}
            placeholder={isListening ? "Listening..." : "Type a word (e.g., cat) or click mic to speak"}
            className={`w-full p-4 pr-12 rounded-xl border-2 transition-all ${
              isListening 
                ? 'border-red-400 ring-4 ring-red-100 bg-red-50' 
                : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'
            }`}
          />
          <button
            onClick={toggleListening}
            disabled={loading}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
              isListening 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : loading
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:text-blue-600'
            }`}
            title={loading ? "Please wait..." : "Search by voice"}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          {isListening && (
            <div className="absolute -bottom-8 left-0 flex items-center gap-2 text-red-600 animate-pulse bg-red-50 px-3 py-1 rounded-full border border-red-100">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
              <span className="text-sm font-medium">Listening... Speak now</span>
            </div>
          )}
        </div>
        
        {!q && (
          <div className="flex flex-wrap gap-2 mb-4">
            {alphabet.map((a) => (
              <button
                key={a}
                onClick={() => setLetter(a)}
                className={`px-3 py-1 rounded-full border transition-colors ${letter === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 animate-in fade-in duration-300">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="animate-pulse text-lg font-medium">Searching dictionary...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 mb-6 animate-in slide-in-from-top-2">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            {/* Header / Metadata */}
            {result.gloss ? (
              <>
                <div className="p-6 border-b bg-gray-50/50">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">{result.gloss}</h2>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMatchColor(result.match_type)}`}>
                          {result.match_type} Match
                        </span>
                        {result.page && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            <BookOpen size={12} /> Page {result.page}
                          </span>
                        )}
                        {result.variants > 0 && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            <Layers size={12} /> {result.variants} Variants
                          </span>
                        )}
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          <CheckCircle size={12} /> {Math.round((result.confidence || 0) * 100)}% Confidence
                        </span>
                      </div>
                    </div>
                    
                    {/* Report / Feedback Button */}
                    <button
                      onClick={handleReport}
                      disabled={reported}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        reported 
                          ? 'bg-green-100 text-green-700 border border-green-200 cursor-default' 
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-red-600 hover:border-red-200'
                      }`}
                    >
                      {reported ? (
                        <>
                          <CheckCircle size={16} />
                          Reported
                        </>
                      ) : (
                        <>
                          <Flag size={16} />
                          Report Issue
                        </>
                      )}
                    </button>
                  </div>
                  
                  {result.description && (
                    <div className="flex gap-3 mt-4 text-gray-700 leading-relaxed max-w-2xl bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <MessageSquare size={20} className="text-blue-400 shrink-0 mt-0.5" />
                      <p>{result.description}</p>
                    </div>
                  )}
                </div>

                {/* Images Grid */}
                <div className="p-6">
                  <div className="flex gap-4 flex-wrap">
                    {Array.isArray(result.images) && result.images.length > 0 ? (
                      result.images.map((img: string, i: number) => (
                        <div key={i} className="relative group cursor-pointer" onClick={() => openImageModal(`http://localhost:8000/static/${result.gloss}/${img}`, i)}>
                          <img
                            src={`http://localhost:8000/static/${result.gloss}/${img}`}
                            alt={`${result.gloss} sign ${i+1}`}
                            className="w-96 h-96 object-contain rounded-xl border bg-white shadow-sm transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-md"
                            loading="lazy"
                            onError={(e) => {
                              const el = e.target as HTMLImageElement
                              el.style.display = 'none'
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ZoomIn className="text-white drop-shadow-md transform scale-75 group-hover:scale-100 transition-transform" size={48} />
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to zoom
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="w-96 h-96 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400">
                        <AlertTriangle size={48} className="mb-2 opacity-20" />
                        <span className="text-sm font-medium">No images available</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500 opacity-50" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No exact match found</h3>
                <p>We couldn't find a sign for "{q}". Try one of the suggestions below.</p>
              </div>
            )}

            {/* Alternatives / Did You Mean */}
            {Array.isArray(result.alternatives) && result.alternatives.length > 0 && (
              <div className="bg-yellow-50 border-t border-yellow-100 p-6">
                <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wide mb-3">Related Signs / Did you mean?</h3>
                <div className="flex flex-wrap gap-2">
                  {result.alternatives.map((alt) => (
                    <button
                      key={alt}
                      onClick={() => {
                        setQ(alt)
                        search(alt, false)
                      }}
                      className="px-4 py-2 bg-white text-yellow-900 border border-yellow-200 rounded-lg hover:bg-yellow-100 hover:border-yellow-300 transition-colors shadow-sm text-sm font-medium"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!q && list && list.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6 mt-6">
            <h2 className="text-lg font-semibold mb-3">Glosses: {letter}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {list.map((item) => (
                <button
                  key={item.gloss}
                  onClick={() => {
                    setQ(item.gloss)
                    search(item.gloss, false)
                  }}
                  className="text-left p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{item.gloss}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border">
                      {item.variants} var
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">Page: {item.page || '-'}</div>
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

