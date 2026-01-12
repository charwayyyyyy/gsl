import React, { useState, useEffect } from 'react'

const Dictionary: React.FC = () => {
  const [q, setQ] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim()) search(q.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Text → Sign</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a word (e.g., cat)"
          className="w-full p-3 rounded-lg border mb-6"
        />
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
                    className="w-40 h-40 object-contain rounded-lg border bg-white"
                  />
                ))
              ) : (
                <div className="w-full text-sm text-gray-500">No images available</div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-600">Confidence: {Math.round((result.confidence || 0) * 100)}%</div>
            {result.page && (
              <div className="mt-1 text-sm text-gray-600">Page: {result.page}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dictionary

