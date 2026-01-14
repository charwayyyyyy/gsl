import React, { useState, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-gray-50">
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
                  <img
                    key={i}
                    src={`http://localhost:8000/static/${result.gloss}/${img}`}
                    alt={`${result.gloss} sign ${i+1}`}
                    className="w-96 h-96 object-contain rounded-lg border bg-white"
                    loading="lazy"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement
                      el.style.display = 'none'
                    }}
                  />
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

