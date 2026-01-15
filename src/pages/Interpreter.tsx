import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, HelpCircle, Eye, EyeOff, Volume2, VolumeX, ChevronLeft, ChevronRight, Play, Pause, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useWebRTC, useWebSocket } from '../hooks/useWebRTC'
import VideoCapture from '../components/VideoCapture'
import AudioCapture from '../components/AudioCapture'

interface SignPrimitives {
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'FORWARD' | 'CIRCULAR' | 'TAP' | 'HOLD' | 'NONE'
  repetition: 'SINGLE' | 'REPEAT'
  handshape: 'FLAT' | 'FIST' | 'POINT' | 'OPEN' | 'CURVED' | 'UNKNOWN'
  location: 'HEAD' | 'FACE' | 'CHIN' | 'CHEST' | 'TORSO' | 'NEUTRAL' | 'UNKNOWN'
  two_hands: boolean
  facial: boolean
  can_animate: boolean
}

interface SignWord {
  word: string
  gloss: string | null
  images: string[]
  description: string
  page?: number
  confidence: number
  match_type: string
  variants: number
  status: 'matched' | 'unknown'
  primitives?: SignPrimitives | null
}

type RecognitionTier = 'browser' | 'backend' | 'manual'

const dictionaryCache: Record<string, any> = {}

const Interpreter: React.FC = () => {
  const navigate = useNavigate()
  const { 
    currentSession, 
    isTranslating, 
    lastTranslation,
    settings 
  } = useAppStore()
  
  const [translationText, setTranslationText] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showAvatar, setShowAvatar] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [recognitionTier, setRecognitionTier] = useState<RecognitionTier>('backend')
  const [lastTierUsed, setLastTierUsed] = useState<RecognitionTier>('backend')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [dictionaryOffline, setDictionaryOffline] = useState(false)
  const [supportsBrowserRecognition, setSupportsBrowserRecognition] = useState(false)
  const [signSequence, setSignSequence] = useState<SignWord[]>([])
  const [currentSignIndex, setCurrentSignIndex] = useState(0)
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [recognizedWords, setRecognizedWords] = useState<string[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [silenceMessage, setSilenceMessage] = useState<string | null>(null)
  const [sttConfidence, setSttConfidence] = useState(0)
  const [dictConfidence, setDictConfidence] = useState(0)
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)
  const [avatarKeyframes, setAvatarKeyframes] = useState<any[] | null>(null)
  
  const { startTranslationSession, endTranslationSession, setLastTranslation } = useAppStore.getState()
  
  // WebSocket connections
  const videoSocket = useWebSocket('ws://localhost:8000/api/video/stream')
  const audioSocket = useWebSocket('ws://localhost:8000/api/audio/stream')
  
  const { accessibility, visual, audio } = settings
  
  useEffect(() => {
    if (!currentSession) {
      startTranslationSession('sign_to_speech')
    }
  }, [])

  useEffect(() => {
    const w = window as any
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (Recognition) {
      setSupportsBrowserRecognition(true)
      setRecognitionTier('browser')
    }
  }, [])

  useEffect(() => {
    if (currentSession?.direction !== 'speech_to_sign') return
    const runChecks = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Microphone API not available; using manual input fallback')
      }
      try {
        const res = await fetch('http://localhost:8000/health')
        if (!res.ok) {
          console.warn('Backend health check failed with status', res.status)
        }
      } catch (e) {
        console.warn('Backend health check error', e)
      }
      try {
        const resp = await fetch('http://localhost:8000/api/dictionary/list?letter=A')
        if (!resp.ok) {
          console.warn('Dictionary list check failed with status', resp.status)
        } else {
          const data = await resp.json()
          if (!data || !Array.isArray(data.items) || data.items.length === 0) {
            console.warn('Dictionary appears to be empty or not loaded')
          }
        }
      } catch (e) {
        console.warn('Dictionary availability check error', e)
      }
    }
    runChecks()
  }, [currentSession?.direction])

  const normalizeText = (text: string): string[] => {
    const lower = text.toLowerCase()
    const cleaned = lower.replace(/[^a-z0-9\s']/g, ' ')
    const rawTokens = cleaned.split(/\s+/).filter(Boolean)
    const fillers = new Set([
      'uh',
      'um',
      'erm',
      'mm',
      'mmm',
      'ah',
      'eh',
      'please',
      'like'
    ])
    const auxiliaries = new Set([
      'can',
      'could',
      'would',
      'should',
      'shall',
      'will',
      'do',
      'does',
      'did'
    ])
    return rawTokens.filter(word => !fillers.has(word) && !auxiliaries.has(word))
  }

  const runTextToSignPipeline = useCallback(
    async (text: string, tier: RecognitionTier, sttConf: number) => {
      const tokens = normalizeText(text)
      setRecognizedWords(tokens)
      if (tokens.length === 0) {
        setTranslationText('')
        setTranslationText('')
        setSilenceMessage('No speech detected')
        setSttConfidence(sttConf)
        setDictConfidence(0)
        setConfidence(0)
        setMatchedCount(0)
        setUnknownCount(0)
        setLastTierUsed(tier)
        setLastUpdateTime(new Date().toLocaleTimeString())
        return
      }
      setSilenceMessage(null)
      const results: SignWord[] = []
      let matchSum = 0
      let matchCountLocal = 0
      for (const token of tokens) {
        const key = token.toLowerCase()
        let data = dictionaryCache[key]
        if (!data) {
          try {
            const resp = await fetch(
              `http://localhost:8000/api/dictionary/search?q=${encodeURIComponent(key)}`
            )
            if (resp.ok) {
              data = await resp.json()
              dictionaryCache[key] = data
              setDictionaryOffline(false)
            } else {
              setDictionaryOffline(true)
              data = dictionaryCache[key]
            }
          } catch (e) {
            setDictionaryOffline(true)
            data = dictionaryCache[key]
          }
        }
        if (data && data.gloss) {
          const c = typeof data.confidence === 'number' ? data.confidence : 0
          const primitives: SignPrimitives | null =
            data && data.primitives && typeof data.primitives === 'object'
              ? {
                  direction: data.primitives.direction || 'NONE',
                  repetition: data.primitives.repetition || 'SINGLE',
                  handshape: data.primitives.handshape || 'UNKNOWN',
                  location: data.primitives.location || 'UNKNOWN',
                  two_hands: Boolean(data.primitives.two_hands),
                  facial: Boolean(data.primitives.facial),
                  can_animate: Boolean(data.primitives.can_animate)
                }
              : null
          results.push({
            word: token,
            gloss: data.gloss || null,
            images: Array.isArray(data.images) ? data.images : [],
            description: typeof data.description === 'string' ? data.description : '',
            page: data.page,
            confidence: c,
            match_type: data.match_type || 'None',
            variants: typeof data.variants === 'number' ? data.variants : 0,
            status: 'matched',
            primitives
          })
          matchSum += c
          matchCountLocal += 1
        } else {
          results.push({
            word: token,
            gloss: null,
            images: [],
            description: '',
            page: undefined,
            confidence: 0,
            match_type: 'None',
            variants: 0,
            status: 'unknown'
          })
        }
      }
      const dictConfLocal = matchCountLocal ? matchSum / matchCountLocal : 0
      const combined =
        tokens.length > 0 ? Math.max(0.01, sttConf * 0.6 + dictConfLocal * 0.4) : 0
      setSignSequence(results)
      setCurrentSignIndex(0)
      setCurrentFrameIndex(0)
      setMatchedCount(matchCountLocal)
      setUnknownCount(tokens.length - matchCountLocal)
      setDictConfidence(dictConfLocal)
      setSttConfidence(sttConf)
      setConfidence(combined)
      setTranslationText(text)
      setLastTierUsed(tier)
      setLastUpdateTime(new Date().toLocaleTimeString())
      const summary = {
        input: text,
        output: results.map(r => r.gloss || r.word.toUpperCase()).join(' '),
        confidence: combined,
        timestamp: Date.now()
      }
      setLastTranslation(summary)
    },
    [setLastTranslation]
  )

  const startBrowserRecognition = () => {
    const w = window as any
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Recognition) {
      setRecognitionTier('backend')
      setSpeechError('Browser speech recognition not available. Using server transcription.')
      return
    }
    try {
      const recognition = new Recognition()
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onstart = () => {
        setSpeechError(null)
        setRecognitionTier('browser')
      }
      recognition.onend = () => {}
      recognition.onerror = (event: any) => {
        const code = event && event.error ? String(event.error) : ''
        if (code === 'not-allowed') {
          setSpeechError(
            'Microphone access was denied for browser recognition. Falling back to server.'
          )
        } else if (code === 'no-speech') {
          setSpeechError('No speech detected. You can try again or type below.')
          setSilenceMessage('No speech detected')
        } else {
          setSpeechError('Browser speech recognition failed. Using server transcription.')
        }
        setRecognitionTier('backend')
      }
      recognition.onresult = (event: any) => {
        if (!event || !event.results || !event.results[0] || !event.results[0][0]) return
        const res = event.results[0][0]
        const text = String(res.transcript || '')
        const conf =
          typeof res.confidence === 'number' && res.confidence > 0 ? res.confidence : 0.7
        runTextToSignPipeline(text, 'browser', conf)
      }
      recognition.start()
    } catch (e) {
      setRecognitionTier('backend')
      setSpeechError('Browser speech recognition could not start. Using server transcription.')
    }
  }

  useEffect(() => {
    if (!autoPlay || !signSequence.length) return
    const interval = setInterval(() => {
      setCurrentFrameIndex(prevFrame => {
        const current = signSequence[currentSignIndex]
        const frameCount =
          current && Array.isArray(current.images) && current.images.length > 0
            ? current.images.length
            : 1
        const nextFrame = prevFrame + 1
        if (nextFrame < frameCount) {
          return nextFrame
        }
        setCurrentSignIndex(prevSign => {
          const nextSign = prevSign + 1
          if (nextSign < signSequence.length) {
            return nextSign
          }
          setAutoPlay(false)
          return prevSign
        })
        return 0
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [autoPlay, signSequence, currentSignIndex])

  // Handle video frame processing
  const handleVideoFrame = useCallback((frameData: string) => {
    if (videoSocket.isConnected && currentSession) {
      videoSocket.sendMessage({
        type: 'video_frame',
        data: frameData,
        timestamp: Date.now(),
        session_id: currentSession.id,
        resolution: { width: 640, height: 480 }
      })
    }
  }, [videoSocket.isConnected, currentSession])

  // Handle audio data processing
  const handleAudioData = useCallback((audioData: Float32Array) => {
    if (audioSocket.isConnected && currentSession) {
      // Convert audio data to base64
      const buffer = new ArrayBuffer(audioData.length * 4)
      const view = new DataView(buffer)
      audioData.forEach((value, index) => {
        view.setFloat32(index * 4, value, true)
      })
      
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      
      audioSocket.sendMessage({
        type: 'audio_chunk',
        data: base64Data,
        timestamp: Date.now(),
        session_id: currentSession.id,
        sample_rate: 44100
      })
    }
  }, [audioSocket.isConnected, currentSession])

  // Handle WebSocket messages
  useEffect(() => {
    if (videoSocket.lastMessage) {
      const message = videoSocket.lastMessage
      if (message.type === 'pose_data') {
        // Process pose data for sign recognition
        setConfidence(message.confidence || 0)
        if (message.landmarks) {
          // Simulate translation based on pose data
          const mockTranslation = {
            input: 'GSL signs detected',
            output: 'Hello, how are you?',
            confidence: message.confidence || 0.85,
            timestamp: Date.now()
          }
          setLastTranslation(mockTranslation)
          setTranslationText(mockTranslation.output)
        }
      }
    }
  }, [videoSocket.lastMessage, setLastTranslation])

  useEffect(() => {
    if (!audioSocket.lastMessage) return
    if (currentSession?.direction !== 'speech_to_sign') return
    const message = audioSocket.lastMessage
    if (message.type === 'transcription') {
      const text = String(message.text || '').trim()
      const conf =
        typeof message.confidence === 'number' && message.confidence > 0
          ? message.confidence
          : 0.7
      if (!text) {
        setSilenceMessage('No speech detected')
        setTranslationText('')
        setSignSequence([])
        setRecognizedWords([])
        setMatchedCount(0)
        setUnknownCount(0)
        setSttConfidence(0)
        setDictConfidence(0)
        setConfidence(0)
        setLastTierUsed('backend')
        setLastUpdateTime(new Date().toLocaleTimeString())
        return
      }
      setSpeechError(null)
      setSilenceMessage(null)
      runTextToSignPipeline(text, 'backend', conf)
    }
  }, [audioSocket.lastMessage, currentSession?.direction, runTextToSignPipeline])

  useEffect(() => {
    if (currentSession?.direction !== 'speech_to_sign') {
      setAvatarStatus('idle')
      setAvatarMessage(null)
      setAvatarKeyframes(null)
      return
    }
    if (!showAvatar) {
      return
    }
    if (!signSequence.length) {
      setAvatarStatus('idle')
      setAvatarKeyframes(null)
      setAvatarMessage('Avatar will activate when there is a dictionary-backed translation.')
      return
    }
    const matched = signSequence.filter(s => s.status === 'matched' && s.gloss)
    if (!matched.length) {
      setAvatarStatus('idle')
      setAvatarKeyframes(null)
      setAvatarMessage('No dictionary signs available for these words. Avatar is disabled.')
      return
    }
    const animatable = matched.filter(
      s => s.primitives && s.primitives.can_animate
    )
    if (!animatable.length) {
      setAvatarStatus('idle')
      setAvatarKeyframes(null)
      setAvatarMessage(
        'Dictionary descriptions do not contain enough motion detail. Using dictionary images only.'
      )
      return
    }
    const gslSequence = matched.map(s => (s.gloss || '').toUpperCase())
    if (!gslSequence.length) {
      setAvatarStatus('idle')
      setAvatarKeyframes(null)
      setAvatarMessage('Avatar will activate when there is a dictionary-backed translation.')
      return
    }
    setAvatarStatus('loading')
    setAvatarMessage('Preparing signing path from dictionary.')
    const controller = new AbortController()
    const run = async () => {
      try {
        const resp = await fetch('http://localhost:8000/api/avatar/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gsl_sequence: gslSequence,
            animation_mode: '3d_avatar',
            speed: 1.0,
            facial_expressions: true
          }),
          signal: controller.signal
        })
        if (!resp.ok) {
          throw new Error('Avatar request failed')
        }
        const data = await resp.json()
        const keyframes =
          data &&
          data.animation_data &&
          Array.isArray(data.animation_data.keyframes)
            ? data.animation_data.keyframes
            : []
        if (!keyframes.length) {
          setAvatarStatus('idle')
          setAvatarKeyframes(null)
          setAvatarMessage(
            'Avatar did not receive any motion instructions. Dictionary images remain primary.'
          )
          return
        }
        setAvatarKeyframes(keyframes)
        setAvatarStatus('ready')
        setAvatarMessage(null)
      } catch (err) {
        if (controller.signal.aborted) return
        setAvatarStatus('error')
        setAvatarKeyframes(null)
        setAvatarMessage(
          'Avatar engine is unavailable at the moment. Dictionary images remain primary.'
        )
      }
    }
    run()
    return () => controller.abort()
  }, [signSequence, currentSession?.direction, showAvatar])

  // Text-to-speech functionality
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window && !isMuted) {
      const utterance = new SpeechSynthesisUtterance(text)
      const rate = Number.isFinite(audio.speechSpeed) ? Math.min(2, Math.max(0.1, audio.speechSpeed)) : 1
      const volume = Number.isFinite(audio.volumeLevel) ? Math.min(1, Math.max(0, audio.volumeLevel)) : 1
      const pitch = 1
      utterance.rate = rate
      utterance.volume = volume
      utterance.pitch = pitch
      
      // Use Ghanaian accent if available
      if (audio.ghanaianAccent) {
        const voices = speechSynthesis.getVoices()
        const englishVoice = voices.find(voice => 
          voice.lang.includes('en') && 
          (voice.name.includes('Ghana') || voice.name.includes('Africa'))
        ) || voices.find(voice => voice.lang.includes('en'))
        
        if (englishVoice) {
          utterance.voice = englishVoice
        }
      }
      
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      
      speechSynthesis.speak(utterance)
    }
  }, [audio.speechSpeed, audio.volumeLevel, audio.ghanaianAccent, isMuted])

  // Auto-speak translations for sign-to-speech
  useEffect(() => {
    if (currentSession?.direction === 'sign_to_speech' && 
        lastTranslation?.output && 
        !isSpeaking) {
      speakText(lastTranslation.output)
    }
  }, [lastTranslation?.output, currentSession?.direction, speakText, isSpeaking])

  const getTextSize = () => {
    return accessibility.largeText ? 'text-3xl' : 'text-2xl'
  }

  const getButtonSize = () => {
    return accessibility.largeText ? 'w-16 h-16' : 'w-12 h-12'
  }

  const getConfidenceColor = (level: number) => {
    if (level >= 0.7) return 'text-green-500'
    if (level >= 0.4) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getConfidenceLabel = (level: number) => {
    if (level >= 0.7) return 'Clear'
    if (level >= 0.4) return 'Fair'
    if (level === 0) return 'No speech detected'
    return 'Unclear'
  }

  if (!currentSession) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${accessibility.highContrast ? 'bg-black text-yellow-400' : 'bg-gray-100'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4" />
          <h2 className={`${getTextSize()} font-bold mb-2`}>Initializing Session...</h2>
          <p className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} text-gray-600 ${accessibility.highContrast ? 'text-yellow-300' : ''}`}>
            Preparing translation system
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${accessibility.highContrast ? 'bg-black text-yellow-400' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} shadow-lg border-b-2`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className={`
                  ${getButtonSize()} rounded-full flex items-center justify-center
                  ${accessibility.highContrast 
                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  transform hover:scale-110 active:scale-95 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-blue-300
                `}
                aria-label="Go back to home"
              >
                <ArrowLeft className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>
              
              <div>
                <h1 className={`${getTextSize()} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  {currentSession.direction === 'sign_to_speech' ? 'Sign → Speech' : 'Speech → Sign'}
                </h1>
                <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Real-time translation session
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Mute/Unmute */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`
                  ${getButtonSize()} rounded-full flex items-center justify-center
                  ${isMuted 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : accessibility.highContrast 
                      ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  transform hover:scale-110 active:scale-95 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-blue-300
                `}
                aria-label={isMuted ? 'Unmute audio output' : 'Mute audio output'}
              >
                {isMuted ? (
                  <VolumeX className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
                ) : (
                  <Volume2 className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
                )}
              </button>

              {/* Avatar Toggle */}
              <button
                onClick={() => setShowAvatar(!showAvatar)}
                className={`
                  ${getButtonSize()} rounded-full flex items-center justify-center
                  ${showAvatar 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : accessibility.highContrast 
                      ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  transform hover:scale-110 active:scale-95 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-blue-300
                `}
                aria-label={showAvatar ? 'Hide signing avatar' : 'Show signing avatar'}
              >
                {showAvatar ? (
                  <EyeOff className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
                ) : (
                  <Eye className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
                )}
              </button>

              {/* Settings */}
              <button
                onClick={() => navigate('/settings')}
                className={`
                  ${getButtonSize()} rounded-full flex items-center justify-center
                  ${accessibility.highContrast 
                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  transform hover:scale-110 active:scale-95 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-blue-300
                `}
                aria-label="Open settings"
              >
                <Settings className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>

              {/* Help */}
              <button
                onClick={() => navigate('/help')}
                className={`
                  ${getButtonSize()} rounded-full flex items-center justify-center
                  ${accessibility.highContrast 
                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  transform hover:scale-110 active:scale-95 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-blue-300
                `}
                aria-label="Open help"
              >
                <HelpCircle className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Input */}
          <div className="space-y-6">
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
              <h2 className={`${getTextSize()} font-bold mb-4 ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                {currentSession.direction === 'sign_to_speech' ? 'Sign Language Input' : 'Speech Input'}
              </h2>
              
              {currentSession.direction === 'sign_to_speech' ? (
                <VideoCapture
                  onFrameCapture={handleVideoFrame}
                  showLandmarks={visual.showLandmarks}
                  showConfidence={visual.showConfidence}
                  className="w-full h-96"
                />
              ) : (
                <AudioCapture
                  onAudioData={handleAudioData}
                  showLevel={true}
                  className="w-full"
                />
              )}
            </div>

            {visual.showConfidence && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    Recognition Confidence
                  </h3>
                  {(() => {
                    const effective = silenceMessage ? 0 : Math.max(0.01, confidence || 0)
                    return (
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getConfidenceColor(effective)}`}>
                          {Math.round(effective * 100)}%
                        </div>
                        <div className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                          {getConfidenceLabel(effective)}
                        </div>
                      </div>
                    )
                  })()}
                </div>
                
                <div className={`w-full ${accessibility.largeText ? 'h-4' : 'h-3'} bg-gray-200 rounded-full overflow-hidden ${accessibility.highContrast ? 'bg-gray-700' : ''}`}>
                  <div
                    className={`h-full transition-all duration-300 ease-out ${
                      (!silenceMessage && confidence >= 0.7) ? 'bg-green-500' :
                      (!silenceMessage && confidence >= 0.4) ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (silenceMessage ? 0 : Math.max(0.01, confidence || 0)) * 100
                      )}%`
                    }}
                  />
                </div>
                
                <div className="mt-3 grid grid-cols-1 gap-1">
                  <div className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Speech recognition: {Math.round((sttConfidence || 0) * 100)}%
                  </div>
                  <div className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Dictionary match: {Math.round((dictConfidence || 0) * 100)}%
                  </div>
                </div>

                <div className="flex justify-between mt-2">
                  <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Poor
                  </span>
                  <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Good
                  </span>
                  <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Excellent
                  </span>
                </div>
              </div>
            )}

            {currentSession.direction === 'speech_to_sign' && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
                <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold mb-4 ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Speech Controls & Text Fallback
                </h3>

                {speechError && (
                  <div className={`mb-4 flex items-start gap-3 rounded-xl p-3 ${
                    accessibility.highContrast ? 'bg-black border border-yellow-400' : 'bg-red-50 border border-red-200'
                  }`}>
                    <AlertTriangle className={`${accessibility.largeText ? 'w-7 h-7' : 'w-5 h-5'} ${accessibility.highContrast ? 'text-yellow-400' : 'text-red-500'} mt-0.5`} />
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} ${accessibility.highContrast ? 'text-yellow-200' : 'text-red-700'}`}>
                      {speechError}
                    </p>
                  </div>
                )}

                {silenceMessage && (
                  <div className={`mb-4 flex items-start gap-3 rounded-xl p-3 ${
                    accessibility.highContrast ? 'bg-black border border-yellow-400' : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <AlertTriangle className={`${accessibility.largeText ? 'w-7 h-7' : 'w-5 h-5'} ${accessibility.highContrast ? 'text-yellow-400' : 'text-yellow-500'} mt-0.5`} />
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} ${accessibility.highContrast ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      {silenceMessage}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <label
                    htmlFor="manual-speech-input"
                    className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-800'}`}
                  >
                    Manual Text Input
                  </label>
                  <textarea
                    id="manual-speech-input"
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    rows={accessibility.largeText ? 4 : 3}
                    className={`
                      w-full rounded-xl border-2 px-4 py-3
                      ${accessibility.highContrast
                        ? 'bg-black border-yellow-400 text-yellow-200 placeholder-yellow-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }
                      focus:outline-none focus:ring-4 focus:ring-blue-300
                      ${accessibility.largeText ? 'text-lg' : 'text-base'}
                    `}
                    placeholder="Type what was said here if the microphone has trouble..."
                  />

                  <div className="flex flex-wrap gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const text = manualInput.trim()
                        if (!text) return
                        setSilenceMessage(null)
                        setSpeechError(null)
                        setRecognitionTier('manual')
                        runTextToSignPipeline(text, 'manual', 0.9)
                      }}
                      className={`
                        inline-flex items-center justify-center px-5 py-2.5 rounded-full font-semibold
                        ${accessibility.highContrast
                          ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                        }
                        transform hover:scale-105 active:scale-95 transition-all duration-200
                        focus:outline-none focus:ring-4 focus:ring-blue-300
                        ${accessibility.largeText ? 'text-lg' : 'text-base'}
                      `}
                    >
                      Translate Text
                    </button>

                    {supportsBrowserRecognition && (
                      <button
                        type="button"
                        onClick={() => {
                          setSilenceMessage(null)
                          setSpeechError(null)
                          startBrowserRecognition()
                        }}
                        className={`
                          inline-flex items-center justify-center px-5 py-2.5 rounded-full font-semibold
                          ${accessibility.highContrast
                            ? 'bg-gray-800 text-yellow-300 border border-yellow-400 hover:bg-gray-700'
                            : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
                          }
                          transform hover:scale-105 active:scale-95 transition-all duration-200
                          focus:outline-none focus:ring-4 focus:ring-blue-300
                          ${accessibility.largeText ? 'text-lg' : 'text-base'}
                        `}
                      >
                        Use Browser Speech Recognition
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Output */}
          <div className="space-y-6">
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
              <h2 className={`${getTextSize()} font-bold mb-4 ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                Translation Output
              </h2>
              
              <div className={`min-h-32 p-4 rounded-xl border-2 ${
                accessibility.highContrast 
                  ? 'bg-black border-yellow-400 text-yellow-200' 
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}>
                {translationText ? (
                  <p className={`${getTextSize()} font-medium leading-relaxed`}>
                    {translationText}
                  </p>
                ) : (
                  <p className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} italic ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-500'}`}>
                    {currentSession.direction === 'sign_to_speech' 
                      ? 'Sign to begin translation...' 
                      : 'Speak to begin translation...'
                    }
                  </p>
                )}
              </div>
            </div>

            {currentSession.direction === 'speech_to_sign' && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
                <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold mb-4 ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Sign Playback
                </h3>

                {dictionaryOffline && (
                  <div className={`mb-4 rounded-xl p-3 ${
                    accessibility.highContrast ? 'bg-black border border-yellow-400' : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} ${accessibility.highContrast ? 'text-yellow-200' : 'text-yellow-800'}`}>
                      Dictionary server is offline. Using cached dictionary results only.
                    </p>
                  </div>
                )}

                {signSequence.length === 0 ? (
                  <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} italic ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-500'}`}>
                    After speech or text is processed, signs will appear here one by one.
                  </p>
                ) : (
                  <>
                    {(() => {
                      const current = signSequence[currentSignIndex] || signSequence[0]
                      const hasImages = current.images && current.images.length > 0
                      const glossKey = (current.gloss || current.word || '').toUpperCase()
                      const frameCount = hasImages ? current.images.length : 1
                      const clampedFrame = Math.min(
                        frameCount - 1,
                        Math.max(0, currentFrameIndex)
                      )
                      const imageSrc =
                        hasImages && glossKey
                          ? `http://localhost:8000/static/${glossKey}/${current.images[clampedFrame]}`
                          : null
                      const statusText =
                        current.status === 'matched'
                          ? 'Dictionary match'
                          : 'Unknown word, showing fallback'

                      return (
                        <>
                          {imageSrc ? (
                            <div className="mb-4">
                              <div className={`w-full h-64 rounded-xl border-2 overflow-hidden flex items-center justify-center ${
                                accessibility.highContrast
                                  ? 'bg-black border-yellow-400'
                                  : 'bg-gray-100 border-gray-200'
                              }`}>
                                <img
                                  src={imageSrc}
                                  alt={`${glossKey} sign ${clampedFrame + 1}`}
                                  className="max-h-full max-w-full object-contain"
                                  onError={e => {
                                    const el = e.target as HTMLImageElement
                                    el.style.display = 'none'
                                  }}
                                />
                              </div>
                              {frameCount > 1 && (
                                <div className="flex items-center justify-between mt-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCurrentFrameIndex(prev =>
                                        prev > 0 ? prev - 1 : frameCount - 1
                                      )
                                    }}
                                    className={`
                                      inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold
                                      ${accessibility.highContrast
                                        ? 'bg-gray-800 text-yellow-300 border border-yellow-400 hover:bg-gray-700'
                                        : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
                                      }
                                      transform hover:scale-105 active:scale-95 transition-all duration-200
                                      ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                                    `}
                                  >
                                    <ChevronLeft className={`${accessibility.largeText ? 'w-6 h-6' : 'w-4 h-4'}`} />
                                    Previous frame
                                  </button>
                                  <div className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-700'}`}>
                                    Frame {clampedFrame + 1} of {frameCount}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCurrentFrameIndex(prev =>
                                        prev + 1 < frameCount ? prev + 1 : 0
                                      )
                                    }}
                                    className={`
                                      inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold
                                      ${accessibility.highContrast
                                        ? 'bg-gray-800 text-yellow-300 border border-yellow-400 hover:bg-gray-700'
                                        : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
                                      }
                                      transform hover:scale-105 active:scale-95 transition-all duration-200
                                      ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                                    `}
                                  >
                                    Next frame
                                    <ChevronRight className={`${accessibility.largeText ? 'w-6 h-6' : 'w-4 h-4'}`} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`mb-4 p-4 rounded-xl border-2 ${
                              accessibility.highContrast
                                ? 'bg-black border-yellow-400 text-yellow-200'
                                : 'bg-gray-50 border-gray-200 text-gray-900'
                            }`}>
                              <div className={`${getTextSize()} font-bold mb-2`}>
                                {(current.gloss || current.word || '').toUpperCase() || 'UNKNOWN'}
                              </div>
                              {current.description && (
                                <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} mb-1`}>
                                  {current.description}
                                </p>
                              )}
                              {current.page && (
                                <p className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                                  See Ghanaian Sign Language Dictionary, page {current.page}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentSignIndex(prev => Math.max(0, prev - 1))
                                  setCurrentFrameIndex(0)
                                }}
                                disabled={currentSignIndex === 0}
                                className={`
                                  inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold
                                  ${currentSignIndex === 0
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'transform hover:scale-105 active:scale-95 transition-all duration-200'
                                  }
                                  ${accessibility.highContrast
                                    ? 'bg-gray-800 text-yellow-300 border border-yellow-400 hover:bg-gray-700'
                                    : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
                                  }
                                  ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                                `}
                              >
                                <ChevronLeft className={`${accessibility.largeText ? 'w-6 h-6' : 'w-4 h-4'}`} />
                                Previous word
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentSignIndex(prev =>
                                    prev + 1 < signSequence.length ? prev + 1 : prev
                                  )
                                  setCurrentFrameIndex(0)
                                }}
                                disabled={currentSignIndex >= signSequence.length - 1}
                                className={`
                                  inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold
                                  ${currentSignIndex >= signSequence.length - 1
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'transform hover:scale-105 active:scale-95 transition-all duration-200'
                                  }
                                  ${accessibility.highContrast
                                    ? 'bg-gray-800 text-yellow-300 border border-yellow-400 hover:bg-gray-700'
                                    : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
                                  }
                                  ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                                `}
                              >
                                Next word
                                <ChevronRight className={`${accessibility.largeText ? 'w-6 h-6' : 'w-4 h-4'}`} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => setAutoPlay(prev => !prev)}
                              className={`
                                inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold
                                ${autoPlay
                                  ? accessibility.highContrast
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                  : accessibility.highContrast
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }
                                transform hover:scale-105 active:scale-95 transition-all duration-200
                                ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                              `}
                            >
                              {autoPlay ? (
                                <>
                                  <Pause className={`${accessibility.largeText ? 'w-6 h-6' : 'w-4 h-4'}`} />
                                  Stop auto-play
                                </>
                              ) : (
                                <>
                                  <Play className={`${accessibility.largeText ? 'w-6 h-6' : 'w-4 h-4'}`} />
                                  Auto-play signs
                                </>
                              )}
                            </button>
                          </div>

                          <div className="mt-4 space-y-1">
                            <div className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-800'}`}>
                              Current word:{' '}
                              <span className="font-semibold">
                                {current.word || (current.gloss || '').toLowerCase()}
                              </span>
                            </div>
                            <div className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                              Status: {statusText}
                            </div>
                            <div className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                              Word {currentSignIndex + 1} of {signSequence.length}
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </>
                )}
              </div>
            )}

            {currentSession.direction === 'speech_to_sign' && showAvatar && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
                <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold mb-4 ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Signing Avatar
                </h3>
                
                <div className={`h-64 rounded-xl border-2 flex items-center justify-center ${
                  accessibility.highContrast 
                    ? 'bg-black border-yellow-400' 
                    : 'bg-gray-100 border-gray-200'
                }`}>
                  {avatarStatus === 'loading' && (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 border-blue-500" />
                      <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                        Preparing signing sequence from dictionary...
                      </p>
                    </div>
                  )}
                  {avatarStatus === 'ready' && avatarKeyframes && avatarKeyframes.length > 0 && (
                    <div className="w-full h-full flex flex-col items-center justify-center px-4 overflow-hidden">
                      <div className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold mb-2 ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-800'}`}>
                        Avatar signing path
                      </div>
                      <p className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} mb-3 ${accessibility.highContrast ? 'text-yellow-200' : 'text-gray-600'}`}>
                        The avatar will follow this sequence, one dictionary-backed sign at a time.
                      </p>
                      <div className="w-full max-h-40 overflow-y-auto text-left">
                        {avatarKeyframes.slice(0, 8).map((kf, idx) => {
                          const label = String(kf.sign || kf.gloss || '').toUpperCase() || 'UNKNOWN'
                          const start = typeof kf.start === 'number' ? Math.round(kf.start) : null
                          const end = typeof kf.end === 'number' ? Math.round(kf.end) : null
                          return (
                            <div
                              key={`${label}-${idx}`}
                              className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-200' : 'text-gray-700'} mb-1`}
                            >
                              <span className="font-semibold">{label}</span>
                              {start !== null && end !== null && (
                                <span className="ml-2">
                                  {start}–{end} ms
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {(avatarStatus === 'idle' || avatarStatus === 'error' || !avatarKeyframes || avatarKeyframes.length === 0) && (
                    <div className="text-center px-4">
                      <div className="text-6xl mb-4">🤟</div>
                      <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                        {avatarMessage || 'Avatar will activate only for signs that exist in the dictionary.'}
                      </p>
                      <p className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-200' : 'text-gray-500'} mt-2`}>
                        Dictionary pages remain the primary reference for sign accuracy.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Session Info */}
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
              <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold mb-4 ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                Session Information
              </h3>
              
                <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Direction:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    {currentSession.direction === 'sign_to_speech' ? 'Sign → Speech' : 'Speech → Sign'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Status:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${
                    isTranslating 
                      ? 'text-green-600' 
                      : accessibility.highContrast ? 'text-yellow-300' : 'text-gray-900'
                  }`}>
                    {isTranslating ? 'Active' : 'Ready'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Events:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    {currentSession.totalEvents}
                  </span>
                </div>
                
                {currentSession.avgConfidence && (
                  <div className="flex justify-between items-center">
                    <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                      Avg Confidence:
                    </span>
                    <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${getConfidenceColor(currentSession.avgConfidence)}`}>
                      {Math.round(currentSession.avgConfidence * 100)}%
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Recognition tier:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    {lastTierUsed === 'browser'
                      ? 'Browser (on-device)'
                      : lastTierUsed === 'backend'
                        ? 'Server (Whisper)'
                        : 'Manual text'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Words recognized:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    {recognizedWords.length}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Words matched:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    {matchedCount}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Unknown words:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    {unknownCount}
                  </span>
                </div>

                {lastUpdateTime && (
                  <div className="flex justify-between items-center">
                    <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                      Last update:
                    </span>
                    <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                      {lastUpdateTime}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Interpreter
