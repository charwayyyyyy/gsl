import React, { useState, useEffect } from 'react'
import { Mic, MicOff, ZoomIn, ZoomOut, X } from 'lucide-react'

// Add interface for SpeechRecognition
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const Dictionary: React.FC = () => {
  const [q, setQ] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [letter, setLetter] = useState<string>('A')
  const [list, setList] = useState<any[]>([])
  
  // Image zoom modal state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)

  const search = async (query: string) => {
    if (!query) return
    try {
      setLoading(true)
      setError(null)
      const resp = await fetch(`http://localhost:8000/api/dictionary/search?q=${encodeURIComponent(query)}`)
      const data = await resp.json()
      setResult(data)
    } catch (e: any) {
      setError('Failed to search dictionary')
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
      setError('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setQ(transcript)
      search(transcript)
    }

    recognition.onerror = (event: any) => {
      console.error(event.error)
      setIsListening(false)
      setError('Error occurred in speech recognition: ' + event.error)
    }

    recognition.start()
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
      if (q.trim()) search(q.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    fetchList(letter)
  }, [letter])

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  const openImageModal = (src: string) => {
    setSelectedImage(src)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Image Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
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
            
            {/* Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-900 bg-opacity-75 px-6 py-3 rounded-full text-white">
              <button 
                onClick={handleZoomOut}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={24} />
              </button>
              <span className="font-mono w-16 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button 
                onClick={handleZoomIn}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={24} />
              </button>
            </div>

            <button 
              onClick={closeImageModal}
              className="absolute top-4 right-4 p-2 text-white hover:bg-gray-800 rounded-full transition-colors bg-black bg-opacity-50"
              title="Close"
            >
              <X size={32} />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Text → Sign</h1>
        <div className="relative mb-6">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a word (e.g., cat) or click mic to speak"
            className="w-full p-3 pr-12 rounded-lg border"
          />
          <button
            onClick={toggleListening}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
              isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-500 hover:text-blue-600'
            }`}
            title="Search by voice"
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>
        {!q && (
          <div className="flex flex-wrap gap-2 mb-4">
            {alphabet.map((a) => (
              <button
                key={a}
                onClick={() => setLetter(a)}
                className={`px-3 py-1 rounded-full border ${letter === a ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {loading && <div className="text-gray-600 mb-4">Searching...</div>}
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {result && result.gloss && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold mb-2">{result.gloss}</h2>
            <p className="text-gray-700 mb-4">{result.description}</p>
            <div className="flex gap-3 flex-wrap">
              {Array.isArray(result.images) && result.images.length > 0 ? (
                result.images.map((img: string, i: number) => (
                  <div key={i} className="relative group cursor-pointer" onClick={() => openImageModal(`http://localhost:8000/static/${result.gloss}/${img}`)}>
                    <img
                      src={`http://localhost:8000/static/${result.gloss}/${img}`}
                      alt={`${result.gloss} sign ${i+1}`}
                      className="w-96 h-96 object-contain rounded-lg border bg-white transition-transform group-hover:scale-[1.02]"
                      loading="lazy"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="text-white drop-shadow-md" size={48} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-96 h-96 flex items-center justify-center rounded-lg border bg-gray-100 text-gray-500">
                  <span className="text-sm">{result.gloss}</span>
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-600">Confidence: {Math.round((result.confidence || 0) * 100)}%</div>
            {result.page && (
              <div className="mt-1 text-sm text-gray-600">Page: {result.page}</div>
            )}
            {Array.isArray(result.alternatives) && result.alternatives.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">Alternatives: {result.alternatives.join(', ')}</div>
            )}
          </div>
        )}

        {!q && list && list.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6 mt-6">
            <h2 className="text-lg font-semibold mb-3">Glosses: {letter}</h2>
            <div className="grid grid-cols-2 gap-3">
              {list.map((item) => (
                <button
                  key={item.gloss}
                  onClick={() => setQ(item.gloss)}
                  className="text-left p-3 rounded-lg border bg-white hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.gloss}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 border">
                      {item.variants} variants
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">Page: {item.page || '-'}</div>
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

