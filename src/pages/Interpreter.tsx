import React, { useState, useCallback, useRef, useEffect } from 'react'
import { API_BASE_URL, WS_BASE_URL } from '@/config'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, HelpCircle, Eye, EyeOff, Volume2, VolumeX, ChevronLeft, ChevronRight, Play, Pause, AlertTriangle, BookOpen, User, Lightbulb, Keyboard, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAppStore } from '../stores/appStore'
import { useWebRTC, useWebSocket } from '../hooks/useWebRTC'
import VideoCapture from '../components/VideoCapture'
import AudioCapture from '../components/AudioCapture'
import Avatar3D from '../components/Avatar3D'
import SmartTipsOverlay from '../components/SmartTipsOverlay'

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
  const { isDark, toggleTheme } = useTheme()

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

  // Smart Tips state
  const [showSmartTips, setShowSmartTips] = useState(true)
  const [livePredictedGloss, setLivePredictedGloss] = useState<string | null>(null)
  const [livePredictedConf, setLivePredictedConf] = useState(0)
  const [liveTopMatches, setLiveTopMatches] = useState<Array<{ gloss: string; confidence: number }>>([])
  const [livePrimitives, setLivePrimitives] = useState<SignPrimitives | null>(null)

  const { startTranslationSession, endTranslationSession, setLastTranslation } = useAppStore.getState()

  // WebSocket connections
  const videoSocket = useWebSocket(`${WS_BASE_URL}/api/video/stream`)
  const audioSocket = useWebSocket(`${WS_BASE_URL}/api/audio/stream`)

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
        const res = await fetch(`${API_BASE_URL}/health`)
        if (!res.ok) {
          console.warn('Backend health check failed with status', res.status)
        }
      } catch (e) {
        console.warn('Backend health check error', e)
      }
      try {
        const resp = await fetch(`${API_BASE_URL}/api/dictionary/list?letter=A`)
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
              `${API_BASE_URL}/api/dictionary/search?q=${encodeURIComponent(key)}`
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
      recognition.onend = () => { }
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

        // === Smart Tips: parse live prediction from backend ===
        const gloss = message.predicted_gloss && message.predicted_gloss !== 'UNKNOWN'
          ? String(message.predicted_gloss)
          : null
        const conf = typeof message.predicted_confidence === 'number' ? message.predicted_confidence : 0
        const tops: Array<{ gloss: string; confidence: number }> = Array.isArray(message.top_matches)
          ? message.top_matches
          : []

        setLivePredictedGloss(gloss)
        setLivePredictedConf(conf)
        setLiveTopMatches(tops)

        // Fetch primitives for the detected gloss (use cache)
        if (gloss && conf >= 0.35) {
          const key = gloss.toLowerCase()
          if (dictionaryCache[key]?.primitives) {
            const cached = dictionaryCache[key].primitives
            setLivePrimitives({
              direction: cached.direction || 'NONE',
              repetition: cached.repetition || 'SINGLE',
              handshape: cached.handshape || 'UNKNOWN',
              location: cached.location || 'UNKNOWN',
              two_hands: Boolean(cached.two_hands),
              facial: Boolean(cached.facial),
              can_animate: Boolean(cached.can_animate),
            })
          } else {
            // Async fetch & cache
            fetch(`${API_BASE_URL}/api/dictionary/search?q=${encodeURIComponent(key)}`)
              .then(r => r.ok ? r.json() : null)
              .then(data => {
                if (data) {
                  dictionaryCache[key] = data
                  if (data.primitives) {
                    setLivePrimitives({
                      direction: data.primitives.direction || 'NONE',
                      repetition: data.primitives.repetition || 'SINGLE',
                      handshape: data.primitives.handshape || 'UNKNOWN',
                      location: data.primitives.location || 'UNKNOWN',
                      two_hands: Boolean(data.primitives.two_hands),
                      facial: Boolean(data.primitives.facial),
                      can_animate: Boolean(data.primitives.can_animate),
                    })
                  }
                }
              })
              .catch(() => { })
          }
        } else {
          setLivePrimitives(null)
        }
        // =====================================================
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
    if (currentSession?.direction !== 'speech_to_sign' && currentSession?.direction !== 'text_to_sign') {
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
        const resp = await fetch(`${API_BASE_URL}/api/avatar/render`, {
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
      const rate = Number.isFinite(settings.translation.speechSpeed) ? Math.min(2, Math.max(0.1, settings.translation.speechSpeed)) : 1
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
  }, [settings.translation.speechSpeed, audio.volumeLevel, audio.ghanaianAccent, isMuted])

  // Auto-speak translations for sign-to-speech
  useEffect(() => {
    if (currentSession?.direction === 'sign_to_speech' &&
      lastTranslation?.output &&
      !isSpeaking) {
      speakText(lastTranslation.output)
    }
  }, [lastTranslation?.output, currentSession?.direction, speakText, isSpeaking])

  // Fetch primitives for active sign in speech-to-sign mode for Smart Tips overlay
  useEffect(() => {
    if (currentSession?.direction === 'speech_to_sign') {
      if (signSequence.length > 0) {
        // Find the actual sign being shown right now
        let currentSign = signSequence[currentSignIndex]

        // If avatar isn't visible, we fall back to index 0 if not playing, but autoPlay effectively drives currentSignIndex
        if (currentSign && currentSign.status === 'matched') {
          setLivePredictedGloss(currentSign.gloss || currentSign.word)
          setLivePredictedConf(1.0)
          setLiveTopMatches([])
          setLivePrimitives(currentSign.primitives || null)
        } else {
          setLivePredictedGloss(null)
          setLivePrimitives(null)
        }
      } else {
        setLivePredictedGloss(null)
        setLivePrimitives(null)
      }
    }
  }, [currentSession?.direction, signSequence, currentSignIndex])

  const getTextSize = () => {
    return accessibility.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'
  }

  const getButtonSize = () => {
    return accessibility.largeText ? 'w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16' : 'w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12'
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
    <div className={`min-h-screen relative overflow-hidden ${accessibility.highContrast ? 'bg-black text-yellow-400' : 'bg-slate-50 dark:bg-slate-950'}`}>
      {/* Background Orbs - Only if not high contrast */}
      {!accessibility.highContrast && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '-2s' }} />
        </>
      )}

      {/* Header */}
      <div className={`sticky top-0 z-50 ${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-b-2' : 'glass border-b border-white/20'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-auto min-h-[4rem] sm:min-h-[5rem] py-2 sm:py-3 flex-wrap gap-y-3 sm:gap-y-4">
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
                <ArrowLeft className={`${accessibility.largeText ? 'w-6 h-6 sm:w-8 sm:h-8' : 'w-5 h-5 sm:w-6 sm:h-6'}`} />
              </button>
              <div className="translate-y-0.5 sm:translate-y-1">
                <h1 className={`${accessibility.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'} font-bold tracking-tight leading-none mb-0.5 sm:mb-1 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                  {currentSession.direction === 'sign_to_speech'
                    ? 'Sign → Speech'
                    : currentSession.direction === 'speech_to_sign'
                      ? 'Speech → Sign'
                      : 'Text → Sign'}
                </h1>
                <p className={`${accessibility.largeText ? 'text-sm sm:text-lg' : 'text-[10px] sm:text-sm'} font-medium ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  Premium Translation Experience
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {[
                {
                  icon: isMuted ? VolumeX : Volume2,
                  onClick: () => setIsMuted(!isMuted),
                  active: isMuted,
                  label: isMuted ? 'Unmute' : 'Mute',
                  activeClass: 'bg-rose-500 text-white shadow-rose-500/20'
                },
                {
                  icon: showAvatar ? EyeOff : Eye,
                  onClick: () => setShowAvatar(!showAvatar),
                  active: showAvatar,
                  label: showAvatar ? 'Hide Avatar' : 'Show Avatar',
                  activeClass: 'bg-indigo-500 text-white shadow-indigo-500/20'
                },
                {
                  icon: Lightbulb,
                  onClick: () => setShowSmartTips(p => !p),
                  active: showSmartTips,
                  label: showSmartTips ? 'Hide Smart Tips' : 'Show Smart Tips',
                  activeClass: 'bg-amber-400 text-black shadow-amber-400/20'
                },
                {
                  icon: Settings,
                  onClick: () => navigate('/settings'),
                  label: 'Settings'
                },
                {
                  icon: HelpCircle,
                  onClick: () => navigate('/help'),
                  label: 'Help'
                }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className={`
                    ${getButtonSize()} rounded-2xl flex items-center justify-center transition-all duration-300
                    ${item.active && item.activeClass ? item.activeClass :
                      accessibility.highContrast
                        ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400'
                        : 'bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-white/40 dark:border-white/10'
                    }
                    transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300/30
                  `}
                  aria-label={item.label}
                >
                  <item.icon className={`${accessibility.largeText ? 'w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8' : 'w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6'}`} />
                </button>
              ))}

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className={`
                  ${getButtonSize()} rounded-2xl flex items-center justify-center transition-all duration-300
                  bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200
                  hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-white/40 dark:border-white/10
                  transform hover:scale-110 active:scale-95 focus:outline-none
                `}
              >
                {isDark
                  ? <Sun className={`${accessibility.largeText ? 'w-5 h-5' : 'w-4 h-4'} text-amber-400`} />
                  : <Moon className={`${accessibility.largeText ? 'w-5 h-5' : 'w-4 h-4'} text-slate-600`} />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 animate-fade-in">
          {/* Left Panel - Input (Moved below output on mobile) */}
          <div className="space-y-4 sm:space-y-8 order-2 lg:order-1">
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-4 sm:p-6' : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] p-4 sm:p-8'} overflow-hidden transition-all duration-500`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-3 h-3 rounded-full animate-pulse ${currentSession.direction === 'sign_to_speech' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                <h2 className={`${getTextSize()} font-bold tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                  {currentSession.direction === 'sign_to_speech'
                    ? 'Sign Language Input'
                    : currentSession.direction === 'speech_to_sign'
                      ? 'Speech Input'
                      : 'Text Input'}
                </h2>
              </div>

              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
                {currentSession.direction === 'sign_to_speech' ? (
                  <>
                    <VideoCapture
                      onFrameCapture={handleVideoFrame}
                      showLandmarks={visual.showLandmarks}
                      showConfidence={visual.showConfidence}
                      className="w-full h-[260px] sm:h-[340px] lg:h-[400px] object-cover"
                    />
                    <SmartTipsOverlay
                      predictedGloss={livePredictedGloss}
                      predictedConfidence={livePredictedConf}
                      primitives={livePrimitives}
                      topMatches={liveTopMatches}
                      highContrast={accessibility.highContrast}
                      visible={showSmartTips}
                    />
                  </>
                ) : currentSession.direction === 'speech_to_sign' ? (
                  <div className="p-10">
                    <AudioCapture
                      onAudioData={handleAudioData}
                      showLevel={true}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="p-8 pb-10 bg-purple-900/10 space-y-4 border-t border-purple-500/20">
                    <textarea
                      id="primary-text-input"
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      rows={accessibility.largeText ? 6 : 5}
                      className={`
                        w-full rounded-2xl border-2 px-6 py-5 transition-all duration-300
                        ${accessibility.highContrast
                          ? 'bg-black border-yellow-400 text-yellow-200 placeholder-yellow-500'
                          : 'bg-white/80 dark:bg-slate-900/80 border-purple-200 dark:border-purple-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:border-purple-500 dark:focus:border-purple-400 shadow-inner'
                        }
                        focus:outline-none focus:ring-4 focus:ring-purple-500/20
                        ${accessibility.largeText ? 'text-2xl' : 'text-xl'}
                      `}
                      placeholder="Type exactly what you want to translate here..."
                      autoFocus
                    />
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
                        w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-bold shadow-lg
                        ${accessibility.highContrast
                          ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                          : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-500/25'
                        }
                        transform hover:-translate-y-1 active:scale-95 transition-all duration-300
                        focus:outline-none focus:ring-4 focus:ring-purple-300/50
                        ${accessibility.largeText ? 'text-2xl' : 'text-xl'}
                      `}
                    >
                      <Keyboard className="w-7 h-7" />
                      Translate to Sign Language
                    </button>
                  </div>
                )}
              </div>
            </div>

            {visual.showConfidence && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] p-8'} transition-all duration-500`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    System Confidence
                  </h3>
                  {(() => {
                    const effective = silenceMessage ? 0 : Math.max(0.01, confidence || 0)
                    return (
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getConfidenceColor(effective)}`}>
                          {Math.round(effective * 100)}%
                        </div>
                        <div className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} font-medium ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500'}`}>
                          {getConfidenceLabel(effective)}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className={`w-full ${accessibility.largeText ? 'h-5' : 'h-4'} bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-1 shadow-inner`}>
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${(!silenceMessage && confidence >= 0.7) ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      (!silenceMessage && confidence >= 0.4) ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                        'bg-gradient-to-r from-rose-400 to-rose-600'
                      }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (silenceMessage ? 0 : Math.max(0.01, confidence || 0)) * 100
                      )}%`
                    }}
                  />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  {[
                    { label: 'Speech Recognition', value: sttConfidence },
                    { label: 'Dictionary Match', value: dictConfidence }
                  ].map((stat, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-amber-500/30 hover:border-amber-400/60 transition-all duration-300">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{Math.round((stat.value || 0) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(currentSession.direction === 'speech_to_sign' || currentSession.direction === 'text_to_sign') && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] p-8'} transition-all duration-500`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                    <Volume2 size={24} />
                  </div>
                  <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    Speech Controls & Fallback
                  </h3>
                </div>

                {speechError && (
                  <div className={`mb-6 flex items-start gap-3 rounded-2xl p-4 ${accessibility.highContrast ? 'bg-black border border-yellow-400' : 'bg-rose-50/50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20'
                    }`}>
                    <AlertTriangle className={`${accessibility.largeText ? 'w-7 h-7' : 'w-5 h-5'} ${accessibility.highContrast ? 'text-yellow-400' : 'text-rose-500'} mt-0.5`} />
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} font-medium ${accessibility.highContrast ? 'text-yellow-200' : 'text-rose-700 dark:text-rose-300'}`}>
                      {speechError}
                    </p>
                  </div>
                )}

                {silenceMessage && (
                  <div className={`mb-6 flex items-start gap-3 rounded-2xl p-4 ${accessibility.highContrast ? 'bg-black border border-yellow-400' : 'bg-amber-50/50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20'
                    }`}>
                    <AlertTriangle className={`${accessibility.largeText ? 'w-7 h-7' : 'w-5 h-5'} ${accessibility.highContrast ? 'text-yellow-400' : 'text-amber-500'} mt-0.5`} />
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} font-medium ${accessibility.highContrast ? 'text-yellow-200' : 'text-amber-800 dark:text-amber-300'}`}>
                      {silenceMessage}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <label
                    htmlFor="manual-speech-input"
                    className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider`}
                  >
                    Manual Text Input
                  </label>
                  <textarea
                    id="manual-speech-input"
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    rows={accessibility.largeText ? 4 : 3}
                    className={`
                      w-full rounded-2xl border-2 px-5 py-4 transition-all duration-300
                      ${accessibility.highContrast
                        ? 'bg-black border-yellow-400 text-yellow-200 placeholder-yellow-500'
                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 dark:focus:border-blue-400'
                      }
                      focus:outline-none focus:ring-4 focus:ring-blue-500/20
                      ${accessibility.largeText ? 'text-lg' : 'text-base'}
                    `}
                    placeholder={currentSession.direction === 'text_to_sign' ? "Type exactly what you want to translate here..." : "Type what was said here if the microphone has trouble..."}
                  />

                  <div className="flex flex-wrap gap-4 mt-2">
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
                        inline-flex items-center justify-center px-8 py-3.5 rounded-2xl font-bold shadow-lg
                        ${accessibility.highContrast
                          ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                        }
                        transform hover:scale-105 active:scale-95 transition-all duration-300
                        focus:outline-none focus:ring-4 focus:ring-blue-300/50
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
                          inline-flex items-center justify-center px-8 py-3.5 rounded-2xl font-bold
                          ${accessibility.highContrast
                            ? 'bg-gray-800 text-yellow-300 border-2 border-yellow-400 hover:bg-gray-700'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'
                          }
                          transform hover:scale-105 active:scale-95 transition-all duration-300
                          focus:outline-none focus:ring-4 focus:ring-blue-300/20
                          ${accessibility.largeText ? 'text-lg' : 'text-base'}
                        `}
                      >
                        Use Browser Speech
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Output (Moved above input on mobile) */}
          <div className="space-y-8 order-1 lg:order-2">
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] p-8'} transition-all duration-500`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-500 shadow-inner">
                    <Play size={28} />
                  </div>
                  <div>
                    <h2 className={`${getTextSize()} font-bold tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'} mb-0`}>
                      Live Translation
                    </h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                      Real-time output stream
                    </p>
                  </div>
                </div>
                {lastUpdateTime && (
                  <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200/50 dark:border-slate-700/50">
                    Updated {lastUpdateTime}
                  </div>
                )}
              </div>

              <div className={`min-h-[200px] p-8 rounded-[1.5rem] border-2 transition-all duration-500 flex items-center justify-center ${accessibility.highContrast
                ? 'bg-black border-yellow-400 text-yellow-200'
                : 'bg-white/40 dark:bg-slate-950/40 border-amber-500/20 hover:border-amber-400/40 text-slate-900 dark:text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]'
                }`}>
                {translationText ? (
                  <div className="w-full">
                    <p className={`${accessibility.largeText ? 'text-4xl' : 'text-3xl'} font-bold leading-tight animate-fade-in text-center bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent`}>
                      {translationText}
                    </p>
                    {confidence > 0 && (
                      <div className="mt-6 flex items-center justify-center gap-2">
                        <div className="h-1.5 w-32 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${confidence >= 0.7 ? 'bg-emerald-500' : confidence >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                            style={{ width: `${confidence * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-black uppercase tracking-widest ${getConfidenceColor(confidence)}`}>
                          {Math.round(confidence * 100)}% Match
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full space-y-4 py-10 opacity-40">
                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 animate-ping" />
                    </div>
                    <div className="text-center">
                      <p className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500'}`}>
                        {currentSession.direction === 'sign_to_speech'
                          ? 'Waiting for sign...'
                          : currentSession.direction === 'speech_to_sign'
                            ? 'Waiting for speech...'
                            : 'Type text to begin'
                        }
                      </p>
                      <p className="text-sm font-medium text-slate-400 dark:text-slate-600 mt-1">
                        System is ready and listening
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(currentSession.direction === 'speech_to_sign' || currentSession.direction === 'text_to_sign') && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] p-8'} transition-all duration-500`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-inner">
                      <Eye size={28} />
                    </div>
                    <div>
                      <h3 className={`${accessibility.largeText ? 'text-2xl' : 'text-xl'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'} mb-0`}>
                        Sign Visualization
                      </h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                        GSL dictionary-based animation
                      </p>
                    </div>
                  </div>
                  {signSequence.length > 0 && (
                    <div className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest border border-blue-500/20">
                      WORD {currentSignIndex + 1} / {signSequence.length}
                    </div>
                  )}
                </div>

                {dictionaryOffline && (
                  <div className={`mb-6 rounded-2xl p-4 flex items-center gap-3 ${accessibility.highContrast ? 'bg-black border border-yellow-400' : 'bg-amber-50/50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20'
                    }`}>
                    <AlertTriangle size={20} className="text-amber-500" />
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} font-medium ${accessibility.highContrast ? 'text-yellow-200' : 'text-amber-800 dark:text-amber-300'}`}>
                      Using cached results (Offline Mode)
                    </p>
                  </div>
                )}

                {signSequence.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl opacity-40">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Play size={32} />
                    </div>
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium italic ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500 text-center px-10'}`}>
                      Signs will appear here as you speak or type.
                    </p>
                  </div>
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
                          ? `${API_BASE_URL}/static/${glossKey}/${current.images[clampedFrame]}`
                          : null
                      const statusText =
                        current.status === 'matched'
                          ? 'Dictionary Match'
                          : 'Unknown Word (Fallback)'

                      return (
                        <div className="animate-fade-in relative rounded-3xl overflow-hidden border-2 border-transparent">
                          {imageSrc ? (
                            <div className="space-y-6">
                              <div className={`relative group w-full aspect-video rounded-3xl border-2 overflow-hidden flex items-center justify-center shadow-2xl transition-all duration-500 ${accessibility.highContrast
                                ? 'bg-black border-yellow-400'
                                : 'bg-slate-900 border-slate-200 dark:border-slate-800'
                                }`}>
                                <img
                                  src={imageSrc}
                                  alt={`${glossKey} sign ${clampedFrame + 1}`}
                                  className="max-h-full max-w-full object-contain transform transition-transform duration-700 group-hover:scale-105"
                                  onError={e => {
                                    const el = e.target as HTMLImageElement
                                    el.style.display = 'none'
                                  }}
                                />
                                <div className="absolute top-4 left-4 px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md text-white text-sm font-bold border border-white/20">
                                  {glossKey}
                                </div>
                              </div>

                              {frameCount > 1 && (
                                <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                                  <button
                                    type="button"
                                    onClick={() => setCurrentFrameIndex(prev => prev > 0 ? prev - 1 : frameCount - 1)}
                                    className={`
                                      p-3 rounded-xl transition-all duration-300
                                      ${accessibility.highContrast
                                        ? 'bg-gray-800 text-yellow-300 border border-yellow-400'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600'
                                      }
                                    `}
                                  >
                                    <ChevronLeft size={24} />
                                  </button>
                                  <div className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} font-bold text-slate-700 dark:text-slate-300`}>
                                    Frame <span className="text-blue-500">{clampedFrame + 1}</span> of {frameCount}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setCurrentFrameIndex(prev => prev + 1 < frameCount ? prev + 1 : 0)}
                                    className={`
                                      p-3 rounded-xl transition-all duration-300
                                      ${accessibility.highContrast
                                        ? 'bg-gray-800 text-yellow-300 border border-yellow-400'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600'
                                      }
                                    `}
                                  >
                                    <ChevronRight size={24} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`p-8 rounded-3xl border-2 shadow-xl ${accessibility.highContrast
                              ? 'bg-black border-yellow-400 text-yellow-200'
                              : 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                              }`}>
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                                  <BookOpen size={18} />
                                </div>
                                <div className={`${getTextSize()} font-extrabold tracking-tight`}>
                                  {(current.gloss || current.word || '').toUpperCase() || 'UNKNOWN'}
                                </div>
                              </div>
                              {current.description && (
                                <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium leading-relaxed mb-4 opacity-80`}>
                                  {current.description}
                                </p>
                              )}
                              {current.page && (
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-black/20 border border-white/20">
                                  <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} font-bold text-slate-500 dark:text-slate-400`}>
                                    GSL Dictionary Page {current.page}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* If Avatar is disabled, show Smart Tips overlaid on the image view instead */}
                          {!showAvatar && (
                            <SmartTipsOverlay
                              predictedGloss={livePredictedGloss}
                              predictedConfidence={livePredictedConf}
                              primitives={livePrimitives}
                              topMatches={liveTopMatches}
                              highContrast={accessibility.highContrast}
                              visible={showSmartTips}
                            />
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8 relative z-10">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentSignIndex(prev => Math.max(0, prev - 1))
                                setCurrentFrameIndex(0)
                              }}
                              disabled={currentSignIndex === 0}
                              className={`
                                flex items-center justify-center gap-2 p-4 rounded-2xl font-bold transition-all duration-300
                                ${currentSignIndex === 0
                                  ? 'opacity-30 grayscale'
                                  : 'hover:scale-105 active:scale-95 shadow-lg'
                                }
                                ${accessibility.highContrast
                                  ? 'bg-gray-800 text-yellow-300 border-2 border-yellow-400'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                }
                                ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                              `}
                            >
                              <ChevronLeft size={20} />
                              Previous
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCurrentSignIndex(prev => prev + 1 < signSequence.length ? prev + 1 : prev)
                                setCurrentFrameIndex(0)
                              }}
                              disabled={currentSignIndex >= signSequence.length - 1}
                              className={`
                                flex items-center justify-center gap-2 p-4 rounded-2xl font-bold transition-all duration-300
                                ${currentSignIndex >= signSequence.length - 1
                                  ? 'opacity-30 grayscale'
                                  : 'hover:scale-105 active:scale-95 shadow-lg'
                                }
                                ${accessibility.highContrast
                                  ? 'bg-gray-800 text-yellow-300 border-2 border-yellow-400'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                }
                                ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                              `}
                            >
                              Next
                              <ChevronRight size={20} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setAutoPlay(prev => !prev)}
                              className={`
                                flex items-center justify-center gap-2 p-4 rounded-2xl font-bold shadow-lg transition-all duration-300 col-span-2 sm:col-span-1
                                ${autoPlay
                                  ? 'bg-rose-500 text-white shadow-rose-500/20'
                                  : 'bg-indigo-600 text-white shadow-indigo-500/20'
                                }
                                transform hover:scale-105 active:scale-95
                                ${accessibility.largeText ? 'text-lg' : 'text-sm'}
                              `}
                            >
                              {autoPlay ? <Pause size={20} /> : <Play size={20} />}
                              {autoPlay ? 'Stop' : 'Play All'}
                            </button>
                          </div>

                          <div className="mt-8 p-6 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Translation Info</span>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${current.status === 'matched' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                                }`}>
                                {statusText}
                              </span>
                            </div>
                            <div className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-bold text-slate-900 dark:text-white`}>
                              Current word: <span className="text-blue-500">{current.word || (current.gloss || '').toLowerCase()}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )}

            {(currentSession.direction === 'speech_to_sign' || currentSession.direction === 'text_to_sign') && showAvatar && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card p-8'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center text-purple-500">
                    <User size={24} />
                  </div>
                  <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    Signing Avatar
                  </h3>
                </div>

                <div className="space-y-6">
                  <div className="h-96 relative rounded-3xl overflow-hidden bg-slate-900 shadow-2xl border border-white/10">
                    <Avatar3D
                      isVisible={avatarStatus === 'ready' && !!avatarKeyframes && avatarKeyframes.length > 0}
                      signSequence={
                        avatarKeyframes
                          ? avatarKeyframes
                            .map(kf => String(kf.sign || kf.gloss || '').toUpperCase())
                            .filter(label => label.length > 0)
                          : []
                      }
                      currentSign={
                        avatarKeyframes && avatarKeyframes.length > 0
                          ? String(avatarKeyframes[0].sign || avatarKeyframes[0].gloss || '').toUpperCase()
                          : undefined
                      }
                    />

                    <SmartTipsOverlay
                      predictedGloss={livePredictedGloss}
                      predictedConfidence={livePredictedConf}
                      primitives={livePrimitives}
                      topMatches={liveTopMatches}
                      highContrast={accessibility.highContrast}
                      visible={showSmartTips}
                    />
                  </div>

                  {avatarStatus === 'loading' && (
                    <div className="rounded-2xl p-4 flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                      <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-blue-800'}`}>
                        Preparing signing sequence from dictionary...
                      </p>
                    </div>
                  )}

                  {(avatarStatus === 'idle' || avatarStatus === 'error' || !avatarKeyframes || avatarKeyframes.length === 0) && (
                    <div className={`rounded-xl p-4 text-center border transition-colors ${accessibility.highContrast ? 'bg-black border-yellow-400' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50'}`}>
                      <div className="text-6xl mb-4">🤟</div>
                      <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {avatarMessage || 'Avatar will activate only for signs that exist in the dictionary.'}
                      </p>
                      <p className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'} mt-2`}>
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
                    {currentSession.direction === 'sign_to_speech'
                      ? 'Sign → Speech'
                      : currentSession.direction === 'speech_to_sign'
                        ? 'Speech → Sign'
                        : 'Text → Sign'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                    Status:
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-semibold ${isTranslating
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
