import React, { useState, useCallback, useRef, useEffect } from 'react'
import { API_BASE_URL, WS_BASE_URL } from '@/config'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useVisualSettings } from '../stores/appStore'
import { ArrowLeft, Settings, HelpCircle, Eye, EyeOff, Volume2, VolumeX, Camera, CameraOff, ChevronLeft, ChevronRight, Play, Pause, AlertTriangle, BookOpen, User, Lightbulb, Keyboard, Sun, Moon, CheckCircle, Mic, Laptop } from 'lucide-react'
import { useWebRTC, useWebSocket } from '../hooks/useWebRTC'
import VideoCapture from '../components/VideoCapture'
import AudioCapture from '../components/AudioCapture'
const Avatar3D = React.lazy(() => import('../components/Avatar3D'))
import SmartTipsOverlay from '../components/SmartTipsOverlay'

import { SIGN_TO_SPEECH_DEMO, SPEECH_TO_SIGN_DEMO, TEXT_TO_SIGN_DEMO, DemoScenario } from '../config/demoData'
import logo from '@/assets/signbridge.png'

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
  const { colorScheme, updateVisual } = useVisualSettings()
  
  const isDark = colorScheme === 'dark' || 
                 (colorScheme === 'default' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = () => {
    if (colorScheme === 'light') updateVisual({ colorScheme: 'dark' })
    else if (colorScheme === 'dark') updateVisual({ colorScheme: 'default' })
    else updateVisual({ colorScheme: 'light' })
  }

  const [translationText, setTranslationText] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showAvatar, setShowAvatar] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(true)
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSignRecognized, setIsSignRecognized] = useState(false)
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

  const demoScenariosMap = {
    sign_to_speech: SIGN_TO_SPEECH_DEMO,
    speech_to_sign: SPEECH_TO_SIGN_DEMO,
    text_to_sign: TEXT_TO_SIGN_DEMO,
  }

  // Demo simulation state
  const [isDemoRunning, setIsDemoRunning] = useState(false)
  const [demoStep, setDemoStep] = useState<'idle' | 'detecting' | 'processing' | 'success'>('idle')

  const runDemoScenario = useCallback(async (scenario: DemoScenario) => {
    if (isDemoRunning) return
    setIsDemoRunning(true)
    setDemoStep('detecting')
    setConfidence(0)
    setLivePredictedGloss(null)
    setLivePredictedConf(0)
    
    // Step 1: Detecting (800ms)
    await new Promise(r => setTimeout(r, 800))
    setDemoStep('processing')
    setConfidence(0.2)
    
    // Step 2: Processing (1000ms)
    await new Promise(r => setTimeout(r, 1000))
    setDemoStep('success')
    
    // Apply results based on mode
    if (currentSession?.direction === 'sign_to_speech') {
      setLivePredictedGloss(scenario.output)
      setLivePredictedConf(scenario.confidence)
      setConfidence(scenario.confidence)
      setTranslationText(scenario.output)
      setLastUpdateTime(new Date().toLocaleTimeString())
      
      // Update sequence
      const newSign: SignWord = {
        word: scenario.output,
        gloss: scenario.output,
        images: [],
        description: 'Demo simulated sign',
        confidence: scenario.confidence,
        match_type: 'Demo',
        variants: 0,
        status: 'matched'
      }
      setSignSequence(prev => [...prev.slice(-4), newSign])
    } else {
      // Speech to sign / Text to sign
      runTextToSignPipeline(scenario.input, 'manual', scenario.confidence)
    }

    setIsDemoRunning(false)
    setTimeout(() => setDemoStep('idle'), 2000)
  }, [currentSession?.direction, isDemoRunning])

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
      setIsProcessing(true)
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
      
      // Fetch all unknown tokens concurrently
      const fetchPromises = tokens.map(async (token) => {
        const key = token.toLowerCase()
        let data = dictionaryCache[key]
        
        if (!data) {
          try {
            const resp = await fetch(`${API_BASE_URL}/api/dictionary/search?q=${encodeURIComponent(key)}`, {
              signal: AbortSignal.timeout(5000)
            })
            if (resp.ok) {
              data = await resp.json()
              dictionaryCache[key] = data
              setDictionaryOffline(false)
            } else {
              setDictionaryOffline(true)
            }
          } catch (e) {
            setDictionaryOffline(true)
          }
        }
        return { token, data }
      })

      const resolvedTokens = await Promise.all(fetchPromises)

      for (const { token, data } of resolvedTokens) {
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
      setIsProcessing(false)
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
        setIsProcessing(true)
      }
      recognition.onend = () => { 
        setIsProcessing(false)
      }
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

  // Update sign sequence for speech-to-sign to show dictionary entries
  const updateSpeechToSignSequence = useCallback(async (text: string) => {
    const tokens = normalizeText(text)
    if (tokens.length === 0) {
      setSignSequence([])
      return
    }

    const results: SignWord[] = []
    
    // Fetch all unknown tokens concurrently
    const fetchPromises = tokens.map(async (token) => {
      const key = token.toLowerCase()
      let data = dictionaryCache[key]
      
      if (!data) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/dictionary/search?q=${encodeURIComponent(key)}`, {
            signal: AbortSignal.timeout(5000)
          })
          if (resp.ok) {
            data = await resp.json()
            dictionaryCache[key] = data
          }
        } catch (e) {
          console.error('Error fetching dictionary entry:', e)
        }
      }
      return { token, data }
    })

    const resolvedTokens = await Promise.all(fetchPromises)

    for (const { token, data } of resolvedTokens) {
      if (data && data.gloss) {
        results.push({
          word: token,
          gloss: data.gloss || null,
          images: Array.isArray(data.images) ? data.images : [],
          description: typeof data.description === 'string' ? data.description : '',
          page: data.page,
          confidence: data.confidence || 1.0,
          match_type: data.match_type || 'Exact',
          variants: typeof data.variants === 'number' ? data.variants : 0,
          status: 'matched',
          primitives: data.primitives
        })
      } else {
        results.push({
          word: token,
          gloss: null,
          images: [],
          description: '',
          confidence: 0,
          match_type: 'None',
          variants: 0,
          status: 'unknown'
        })
      }
    }
    setSignSequence(results)
    setCurrentSignIndex(0)
    setAutoPlay(true)
  }, [])

  // Handle WebSocket messages
  useEffect(() => {
    if (videoSocket.lastMessage) {
      const message = videoSocket.lastMessage
      if (message.type === 'pose_data') {
        // Process pose data for sign recognition
        setConfidence(message.confidence || 0)
        
        // WebSocket health check/latency can be estimated here
        
        // === Smart Tips: parse live prediction from backend ===
        const gloss = (message.predicted_gloss && message.predicted_gloss !== 'UNKNOWN')
          ? String(message.predicted_gloss).toUpperCase()
          : null
        const conf = typeof message.predicted_confidence === 'number' ? message.predicted_confidence : 0
        const tops: Array<{ gloss: string; confidence: number }> = Array.isArray(message.top_matches)
          ? message.top_matches
          : []

        // If high confidence new sign, update translation text and sequence
        if (gloss && conf > 0.65 && gloss !== livePredictedGloss) {
          setIsProcessing(true)
          setIsSignRecognized(true)
          // Add to sequence for visual feedback
          const key = gloss.toLowerCase()
          const cached = dictionaryCache[key]
          
          const newSign: SignWord = cached ? {
            word: gloss,
            gloss: cached.gloss,
            images: cached.images || [],
            description: cached.description || '',
            confidence: conf,
            match_type: 'Live',
            variants: cached.variants || 0,
            status: 'matched',
            primitives: cached.primitives
          } : {
            word: gloss,
            gloss: gloss,
            images: [],
            description: 'Detected from live sign',
            confidence: conf,
            match_type: 'Live',
            variants: 0,
            status: 'matched'
          }

          setSignSequence(prev => {
            const last = prev[prev.length - 1]
            if (last?.gloss === gloss) return prev
            const next = [...prev, newSign]
            // Keep last 5 signs for the sequence view
            return next.slice(-5)
          })

          setTranslationText(prev => {
            const words = prev.trim().split(' ');
            if (words[words.length - 1] !== gloss) {
              const newText = prev ? `${prev} ${gloss}` : gloss;
              setLastTranslation({
                input: 'Sign Language',
                output: newText,
                confidence: conf,
                timestamp: Date.now()
              });
              return newText;
            }
            return prev;
          });
          
          setTimeout(() => {
            setIsProcessing(false)
            setIsSignRecognized(false)
          }, 1000)
        }

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
            fetch(`${API_BASE_URL}/api/dictionary/search?q=${encodeURIComponent(key)}`, {
              signal: AbortSignal.timeout(5000)
            })
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
      updateSpeechToSignSequence(text)
    }
  }, [audioSocket.lastMessage, currentSession?.direction, runTextToSignPipeline, updateSpeechToSignSequence])

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
      // Cancel any ongoing speech to avoid overlap
      speechSynthesis.cancel()
      
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
      utterance.onerror = () => setIsSpeaking(false)

      speechSynthesis.speak(utterance)
    }
  }, [settings.translation.speechSpeed, audio.volumeLevel, audio.ghanaianAccent, isMuted])

  // Auto-speak translations for sign-to-speech and text-to-sign
  useEffect(() => {
    if ((currentSession?.direction === 'sign_to_speech' || currentSession?.direction === 'text_to_sign') &&
      translationText &&
      !isSpeaking) {
      speakText(translationText)
    }
  }, [translationText, currentSession?.direction, speakText, isSpeaking])

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
    // Ensure minimum 44px for touch targets on mobile (11rem = 44px)
    const base = accessibility.largeText ? 'w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16' : 'w-11 h-11 sm:w-12 sm:h-12 lg:w-12 lg:h-12'
    return base
  }

  const getHeaderSize = () => {
    return accessibility.largeText ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-3xl'
  }

  const getConfidenceColor = (level: number) => {
    if (level === 0) return 'text-slate-400'
    if (level >= 0.7) return 'text-green-500'
    if (level >= 0.4) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getConfidenceLabel = (level: number) => {
    if (level === 0) return isCameraActive ? 'Analyzing frame...' : 'Waiting for input...'
    if (level >= 0.7) return 'Clear'
    if (level >= 0.4) return 'Fair'
    return 'Unclear'
  }

  if (!currentSession) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 ${accessibility.highContrast ? 'bg-black text-yellow-400' : 'bg-slate-50 dark:bg-[#050505]'}`}>
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-3xl" />
          <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-3xl animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <p className={`${getTextSize()} font-black uppercase tracking-[0.2em] animate-pulse`}>Initializing System</p>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Preparing translation environment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen relative overflow-hidden ${accessibility.highContrast ? 'bg-black text-yellow-400' : 'bg-slate-50 dark:bg-[#050505]'}`}>
      {/* Background Orbs - Only if not high contrast */}
      {!accessibility.highContrast && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '-2s' }} />
        </>
      )}

      {/* Mode Header */}
      <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-b-2' : 'bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-auto min-h-[4rem] sm:min-h-[5rem] py-2 sm:py-3 flex-wrap gap-y-3 sm:gap-y-4">
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
                <ArrowLeft className={`${accessibility.largeText ? 'w-6 h-6 sm:w-8 sm:h-8' : 'w-5 h-5 sm:w-6 sm:h-6'}`} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black hidden sm:flex items-center justify-center shadow-lg border border-white/10 p-1">
                  <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="translate-y-0.5 sm:translate-y-1">
                  <h1 className={`${accessibility.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'} font-serif italic tracking-tight leading-none mb-0.5 sm:mb-1 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    SignBridge Ghana
                  </h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400 leading-none">
                    {currentSession.direction === 'sign_to_speech'
                      ? 'Sign → Speech'
                      : currentSession.direction === 'speech_to_sign'
                        ? 'Speech → Sign'
                        : 'Text → Sign'}
                  </p>
                </div>
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
                  icon: isCameraActive ? Camera : CameraOff,
                  onClick: () => setIsCameraActive(!isCameraActive),
                  active: !isCameraActive,
                  label: isCameraActive ? 'Turn Camera Off' : 'Turn Camera On',
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
                        : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-slate-200/60 dark:border-white/10'
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
                  bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200
                  hover:bg-white dark:hover:bg-slate-700 shadow-sm border border-slate-200/60 dark:border-white/10
                  transform hover:scale-110 active:scale-95 focus:outline-none
                `}
              >
                {colorScheme === 'default'
                  ? <Laptop className={`${accessibility.largeText ? 'w-5 h-5' : 'w-4 h-4'} text-slate-500`} />
                  : isDark
                    ? <Sun className={`${accessibility.largeText ? 'w-5 h-5' : 'w-4 h-4'} text-amber-400`} />
                    : <Moon className={`${accessibility.largeText ? 'w-5 h-5' : 'w-4 h-4'} text-slate-600`} />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-12 py-4 sm:py-8 pb-40 relative z-10">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-10 animate-fade-in items-start">
          
          {/* Left Panel - Control & Input (Fixed width on desktop, full width on mobile) */}
          <div className="w-full lg:w-[450px] xl:w-[550px] space-y-6 sm:space-y-10">
            
            {/* Input Panel */}
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-4 sm:p-6' : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] p-4 sm:p-8'} overflow-hidden transition-all duration-500`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${currentSession.direction === 'sign_to_speech' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  <h2 className={`${getTextSize()} font-bold tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    {currentSession.direction === 'sign_to_speech'
                      ? 'Sign Language Input'
                      : currentSession.direction === 'speech_to_sign'
                        ? 'Speech Input'
                        : 'Text Input'}
                  </h2>
                </div>
                
                {/* Live Status Indicators */}
                <div className="flex items-center gap-2">
                  {currentSession.direction === 'sign_to_speech' && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${isCameraActive ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                      {isCameraActive ? <Camera size={12} /> : <CameraOff size={12} />}
                      {isCameraActive ? 'Cam On' : 'Cam Off'}
                    </div>
                  )}
                  {currentSession.direction === 'speech_to_sign' && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${!isMuted ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                      {!isMuted ? <Volume2 size={12} /> : <VolumeX size={12} />}
                      {!isMuted ? 'Mic On' : 'Muted'}
                    </div>
                  )}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${(videoSocket.isConnected || audioSocket.isConnected) ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${(videoSocket.isConnected || audioSocket.isConnected) ? 'bg-green-500 animate-pulse' : 'bg-rose-500'}`} />
                    {(videoSocket.isConnected || audioSocket.isConnected) ? 'Connected' : 'Offline'}
                  </div>
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-slate-900 ring-1 ring-white/10 group/input">
                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center animate-fade-in">
                    <div className="flex flex-col items-center gap-4">
                      {isSignRecognized ? (
                        <div className="flex flex-col items-center gap-2 animate-bounce-slow">
                          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/40">
                            <CheckCircle size={32} />
                          </div>
                          <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">Sign Detected</span>
                        </div>
                      ) : (
                        <>
                          <div className="relative w-12 h-12">
                            <div className="absolute inset-0 border-4 border-white/20 rounded-full" />
                            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                          <span className="text-xs font-black text-white uppercase tracking-[0.2em] animate-pulse">Processing...</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {/* Demo Mode Overlay */}
                {visual.demoMode && (
                  <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-blue-600/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-widest border border-white/20 shadow-lg animate-pulse">
                      Demo Mode Active
                    </div>
                    
                    {isDemoRunning && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in pointer-events-auto">
                        <div className="flex flex-col items-center gap-4">
                          <div className="relative w-16 h-16">
                            <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                            <div className={`absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full ${demoStep !== 'idle' ? 'animate-spin' : ''}`} />
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-black text-white uppercase tracking-[0.2em] block mb-1">
                              {demoStep === 'detecting' ? 'Analyzing Movement...' : 
                               demoStep === 'processing' ? 'Matching Patterns...' : 
                               'Recognition Success'}
                            </span>
                            <div className="flex gap-1 justify-center">
                              <div className={`w-1 h-1 rounded-full bg-blue-500 ${demoStep === 'detecting' ? 'animate-bounce' : ''}`} />
                              <div className={`w-1 h-1 rounded-full bg-blue-500 ${demoStep === 'detecting' ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.2s' }} />
                              <div className={`w-1 h-1 rounded-full bg-blue-500 ${demoStep === 'detecting' ? 'animate-bounce' : ''}`} style={{ animationDelay: '0.4s' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {currentSession.direction === 'sign_to_speech' ? (
                  <>
                    <VideoCapture
                      onFrameCapture={handleVideoFrame}
                      showLandmarks={visual.showLandmarks}
                      showConfidence={visual.showConfidence}
                      isActive={isCameraActive}
                      className="w-full h-[400px] sm:h-[450px] lg:h-[500px] object-cover"
                    />
                    
                    {/* Empty state for sign detection */}
                    {!livePredictedGloss && isCameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 flex flex-col items-center gap-2 animate-fade-in transition-all duration-500 group-hover/input:bg-black/40">
                          <div className="text-3xl animate-bounce-slow">🤟</div>
                          <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] text-center leading-relaxed">
                            Awaiting sign...<br/>Position yourself in frame
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <SmartTipsOverlay
                      predictedGloss={livePredictedGloss}
                      predictedConfidence={livePredictedConf}
                      primitives={livePrimitives}
                      topMatches={liveTopMatches}
                      highContrast={accessibility.highContrast}
                      visible={showSmartTips}
                    />

                    {/* Demo Example Controls */}
                    {visual.demoMode && !isDemoRunning && (
                      <div className="absolute bottom-4 left-4 right-4 z-40 flex flex-col gap-2 animate-slide-up pointer-events-auto">
                        <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Sample Gestures</span>
                        <div className="flex flex-wrap gap-1.5">
                          {SIGN_TO_SPEECH_DEMO.map((scenario) => (
                            <button
                              key={scenario.id}
                              onClick={() => runDemoScenario(scenario)}
                              className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-blue-600/80 backdrop-blur-md border border-white/10 text-[8px] font-black text-white uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            >
                              {scenario.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : currentSession.direction === 'speech_to_sign' ? (
                  <div className="p-8 sm:p-12 bg-emerald-950/20 relative">
                    <AudioCapture
                      onAudioData={handleAudioData}
                      showLevel={true}
                      className="w-full"
                      disabled={isMuted}
                    />
                    
                    {/* Empty state for speech recognition */}
                    {!translationText && !isMuted && (
                      <div className="mt-8 flex flex-col items-center gap-2 animate-fade-in pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 animate-pulse">
                          <Mic size={24} />
                        </div>
                        <span className="text-[10px] font-black text-emerald-500/70 uppercase tracking-[0.2em] text-center leading-relaxed">
                          Listening for speech...<br/>Results appear on the right
                        </span>
                      </div>
                    )}

                    {/* Demo Example Controls */}
                    {visual.demoMode && !isDemoRunning && (
                      <div className="mt-8 flex flex-col gap-3 animate-slide-up">
                        <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em]">Sample Phrases</span>
                        <div className="flex flex-wrap gap-2">
                          {SPEECH_TO_SIGN_DEMO.map((scenario) => (
                            <button
                              key={scenario.id}
                              onClick={() => runDemoScenario(scenario)}
                              className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            >
                              {scenario.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 sm:p-10 bg-purple-900/10 space-y-6 border-t border-purple-500/20 relative">
                    <textarea
                      id="primary-text-input"
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      rows={accessibility.largeText ? 5 : 4}
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
                        w-full flex items-center justify-center gap-4 px-8 py-5 rounded-2xl font-bold shadow-xl
                        ${accessibility.highContrast
                          ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                          : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-500/30'
                        }
                        transform hover:-translate-y-1 active:scale-95 transition-all duration-300
                        focus:outline-none focus:ring-4 focus:ring-purple-300/50
                        ${accessibility.largeText ? 'text-2xl' : 'text-xl'}
                      `}
                    >
                      <Keyboard className="w-8 h-8" />
                      Translate
                    </button>
                    {/* Demo Example Controls */}
                    {visual.demoMode && !isDemoRunning && (
                      <div className="mt-8 flex flex-col gap-3 animate-slide-up">
                        <span className="text-[10px] font-black text-purple-500/50 uppercase tracking-[0.2em]">Sample Inputs</span>
                        <div className="flex flex-wrap gap-2">
                          {TEXT_TO_SIGN_DEMO.map((scenario) => (
                            <button
                              key={scenario.id}
                              onClick={() => runDemoScenario(scenario)}
                              className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-[10px] font-black text-purple-400 uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            >
                              {scenario.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Confidence Panel */}
            {visual.showConfidence && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] p-8'} transition-all duration-500`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    System Confidence
                  </h3>
                  {(() => {
                    const effective = silenceMessage ? 0 : (confidence || 0)
                    const showValue = effective > 0.05 // Hide < 5% as it looks like noise
                    return (
                      <div className="text-right transition-all duration-500">
                        <div className={`text-3xl font-bold ${getConfidenceColor(effective)} ${!showValue ? 'opacity-30' : 'animate-fade-in'}`}>
                          {showValue ? `${Math.round(effective * 100)}%` : '--%'}
                        </div>
                        <div className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} font-medium ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500'}`}>
                          {getConfidenceLabel(effective)}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className={`w-full ${accessibility.largeText ? 'h-5' : 'h-4'} bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-1 shadow-inner relative`}>
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${(!silenceMessage && confidence >= 0.7) ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      (!silenceMessage && confidence >= 0.4) ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                        'bg-gradient-to-r from-rose-400 to-rose-600'
                      }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (silenceMessage || confidence < 0.05 ? 0 : confidence) * 100
                      )}%`
                    }}
                  />
                  {/* Activity shimmer when active but no match */}
                  {isCameraActive && confidence < 0.05 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  )}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  {[
                    { label: 'Input Quality', value: sttConfidence },
                    { label: 'Dictionary Match', value: dictConfidence }
                  ].map((stat, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-amber-500/30 hover:border-amber-400/60 transition-all duration-300">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{Math.round((stat.value || 0) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Session Info */}
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 sm:p-8'} rounded-3xl shadow-xl transition-all duration-500`}>
              <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold mb-6 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                Session Details
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    Direction
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    {currentSession.direction === 'sign_to_speech' ? 'Sign → Speech' : currentSession.direction === 'speech_to_sign' ? 'Speech → Sign' : 'Text → Sign'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    Status
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter ${isTranslating ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {isTranslating ? 'Active' : 'Standby'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    Words Recognized
                  </span>
                  <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                    {recognizedWords.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Output & Viz (Takes remaining space on desktop) */}
          <div className="flex-1 min-w-0 space-y-8 sm:space-y-10 order-1 lg:order-2">
            
            {/* Live Translation Output */}
            <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card border-blue-500/30 hover:border-blue-400/80 hover:shadow-[0_0_40px_rgba(59,130,246,0.1)] p-8 sm:p-10'} transition-all duration-500`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-500 shadow-inner">
                    <Volume2 size={32} />
                  </div>
                  <div>
                    <h2 className={`${getHeaderSize()} font-bold tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'} mb-0`}>
                      Live Translation
                    </h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest">
                      Real-time output stream
                    </p>
                  </div>
                </div>
                {lastUpdateTime && (
                  <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center gap-2">
                    {isTranslating && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                    Updated {lastUpdateTime}
                  </div>
                )}
              </div>

              <div className={`min-h-[220px] p-10 rounded-[2rem] border-2 transition-all duration-500 flex items-center justify-center relative overflow-hidden ${accessibility.highContrast
                ? 'bg-black border-yellow-400 text-yellow-200'
                : 'bg-white/40 dark:bg-slate-950/40 border-blue-500/20 hover:border-blue-400/40 text-slate-900 dark:text-white shadow-[inset_0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_2px_15px_rgba(0,0,0,0.3)]'
                }`}>
                
                {/* Background pulse when detecting */}
                {!translationText && isCameraActive && (
                  <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-400/5 animate-pulse-slow pointer-events-none" />
                )}

                {translationText ? (
                  <div className="w-full text-center space-y-6 relative z-10">
                    <p className={`${accessibility.largeText ? 'text-6xl' : 'text-5xl'} font-extrabold leading-tight animate-fade-in-up bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-400 dark:to-indigo-500 bg-clip-text text-transparent px-4 drop-shadow-sm`}>
                      {translationText}
                    </p>
                    {confidence > 0.05 && (
                      <div className="flex flex-col items-center gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                        <div className="h-2 w-48 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${confidence >= 0.7 ? 'bg-emerald-500' : confidence >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                            style={{ width: `${confidence * 100}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${getConfidenceColor(confidence)} bg-white/50 dark:bg-black/20 px-3 py-1 rounded-full border border-current/20`}>
                          {Math.round(confidence * 100)}% Confidence
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full space-y-6 py-12 relative z-10">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-3xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        {currentSession.direction === 'sign_to_speech' ? (
                          <Camera className="w-10 h-10 text-slate-400 animate-pulse" />
                        ) : currentSession.direction === 'speech_to_sign' ? (
                          <Mic className="w-10 h-10 text-slate-400 animate-pulse" />
                        ) : (
                          <Keyboard className="w-10 h-10 text-slate-400 animate-pulse" />
                        )}
                      </div>
                      {/* Pulse rings */}
                      <div className="absolute inset-0 rounded-3xl border-2 border-blue-500/20 animate-ping-slow" />
                      <div className="absolute inset-0 rounded-3xl border-2 border-blue-500/10 animate-ping-slow" style={{ animationDelay: '1s' }} />
                    </div>
                    <div className="text-center">
                      <p className={`${accessibility.largeText ? 'text-2xl' : 'text-xl'} font-bold ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500'}`}>
                        {currentSession.direction === 'sign_to_speech'
                          ? 'Position yourself in frame...'
                          : currentSession.direction === 'speech_to_sign'
                            ? 'Listening for speech...'
                            : 'Enter text to visualize'
                        }
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" />
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
                        </div>
                        <p className="text-sm font-medium text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                          System ready and active
                        </p>
                      </div>
                      {/* Demo suggestion */}
                      {currentSession.direction === 'text_to_sign' && (
                        <div className="mt-6">
                          <button 
                            onClick={() => {
                              setManualInput('Hello');
                              runTextToSignPipeline('Hello', 'manual', 0.9);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 transition-all hover:scale-105 active:scale-95"
                          >
                            Try example: "Hello"
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Detected Word Sequence (Always show for Sign-to-Speech) */}
              {currentSession.direction === 'sign_to_speech' && signSequence.length > 0 && (
                <div className="mt-8 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                      Detected Sign Sequence
                    </h4>
                    <button 
                      onClick={() => {
                        setSignSequence([]);
                        setTranslationText('');
                      }}
                      className="text-[10px] font-bold text-rose-500 uppercase hover:text-rose-400 transition-colors"
                    >
                      Clear Sequence
                    </button>
                  </div>
                  
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                    {signSequence.map((entry, idx) => {
                      const gloss = (entry.gloss || entry.word || '').toUpperCase();
                      const hasImagesEntry = entry.images && entry.images.length > 0;
                      const firstImg = hasImagesEntry ? (entry.images[0].includes('/') ? `${API_BASE_URL}/static/${entry.images[0]}` : `${API_BASE_URL}/static/${gloss}/${entry.images[0]}`) : null;

                      return (
                        <div
                          key={idx}
                          className="flex-shrink-0 w-28 sm:w-32 snap-start animate-fade-in"
                        >
                          <div className={`
                            relative aspect-square rounded-2xl overflow-hidden mb-2 border-2 shadow-lg bg-white dark:bg-slate-900
                            ${accessibility.highContrast ? 'border-yellow-400' : 'border-slate-200 dark:border-slate-800'}
                          `}>
                            {firstImg ? (
                              <img src={firstImg} alt={gloss} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <BookOpen size={20} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-1 left-1 right-1 text-[8px] font-black text-white truncate text-center uppercase tracking-wider">
                              {gloss}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Visualizer & Dictionary Results */}
            {(currentSession.direction === 'speech_to_sign' || currentSession.direction === 'text_to_sign') && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400 border-2 p-6' : 'glass-card border-emerald-500/30 hover:border-emerald-400/80 hover:shadow-[0_0_40px_rgba(16,185,129,0.1)] p-8 sm:p-10'} transition-all duration-500`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-inner">
                      <Eye size={32} />
                    </div>
                    <div>
                      <h3 className={`${getHeaderSize()} font-bold tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'} mb-0`}>
                        Sign Visualization
                      </h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest">
                        GSL dictionary-based results
                      </p>
                    </div>
                  </div>
                  {signSequence.length > 0 && (
                    <div className="flex gap-2">
                      <div className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 shadow-sm">
                        ENTRY {currentSignIndex + 1} / {signSequence.length}
                      </div>
                    </div>
                  )}
                </div>

                {signSequence.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] opacity-40 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Play size={40} className="ml-1" />
                    </div>
                    <p className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-medium italic ${accessibility.highContrast ? 'text-yellow-300' : 'text-slate-500 text-center px-16 leading-relaxed'}`}>
                      Dictionary diagrams will appear here as you speak or type.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {/* Main Viz Area */}
                    {(() => {
                      const current = signSequence[currentSignIndex] || signSequence[0]
                      const hasImages = current.images && current.images.length > 0
                      const glossKey = (current.gloss || current.word || '').toUpperCase()
                      const frameCount = hasImages ? current.images.length : 1
                      const clampedFrame = Math.min(
                        frameCount - 1,
                        Math.max(0, currentFrameIndex)
                      )
                      
                      // Fix: Handle dictionary structure variations
                      const getImageUrlLocal = (img: string) => {
                        if (!img) return null;
                        if (img.includes('/')) return `${API_BASE_URL}/static/${img}`;
                        return `${API_BASE_URL}/static/${glossKey}/${img}`;
                      };

                      const imageSrc = hasImages ? getImageUrlLocal(current.images[clampedFrame]) : null;

                      return (
                        <div className="animate-fade-in space-y-8">
                          {imageSrc ? (
                            <div className="space-y-8">
                              <div className={`relative group w-full aspect-video rounded-[2.5rem] border-2 overflow-hidden flex items-center justify-center shadow-2xl transition-all duration-700 hover:shadow-emerald-500/10 ${accessibility.highContrast
                                ? 'bg-black border-yellow-400'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                }`}>
                                <img
                                  src={imageSrc}
                                  alt={`${glossKey} sign`}
                                  className="max-h-[85%] max-w-[85%] object-contain transform transition-all duration-1000 group-hover:scale-105"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src !== 'https://via.placeholder.com/400x400?text=Sign+Diagram+Unavailable') {
                                      target.src = 'https://via.placeholder.com/400x400?text=Sign+Diagram+Unavailable';
                                      target.classList.add('opacity-50', 'grayscale');
                                    }
                                  }}
                                />
                                <div className="absolute top-6 left-6 px-6 py-3 rounded-2xl bg-black/80 backdrop-blur-xl text-white text-base font-black border border-white/20 shadow-xl uppercase tracking-wider">
                                  {glossKey}
                                </div>
                                <div className="absolute bottom-6 right-6 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white/60 text-[10px] font-bold border border-white/10 uppercase tracking-widest">
                                  Frame {clampedFrame + 1} / {frameCount}
                                </div>
                              </div>

                              {frameCount > 1 && (
                                <div className="flex items-center justify-between p-3 rounded-[1.5rem] bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAutoPlay(false);
                                      setCurrentFrameIndex(prev => prev > 0 ? prev - 1 : frameCount - 1);
                                    }}
                                    className={`
                                      p-4 rounded-2xl transition-all duration-300
                                      ${accessibility.highContrast
                                        ? 'bg-gray-800 text-yellow-300 border border-yellow-400'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 hover:-translate-x-1 active:scale-95'
                                      }
                                    `}
                                  >
                                    <ChevronLeft size={28} />
                                  </button>
                                  
                                  <div className="flex items-center gap-4">
                                    <button 
                                      onClick={() => setAutoPlay(!autoPlay)}
                                      className={`p-4 rounded-full ${autoPlay ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'} transition-all duration-300 shadow-lg`}
                                    >
                                      {autoPlay ? <Pause size={24} /> : <Play size={24} />}
                                    </button>
                                    <div className={`${accessibility.largeText ? 'text-xl' : 'text-base'} font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest`}>
                                      Sequence <span className="text-blue-500 tabular-nums">{clampedFrame + 1}</span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAutoPlay(false);
                                      setCurrentFrameIndex(prev => prev + 1 < frameCount ? prev + 1 : 0);
                                    }}
                                    className={`
                                      p-4 rounded-2xl transition-all duration-300
                                      ${accessibility.highContrast
                                        ? 'bg-gray-800 text-yellow-300 border border-yellow-400'
                                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 hover:translate-x-1 active:scale-95'
                                      }
                                    `}
                                  >
                                    <ChevronRight size={28} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`p-12 rounded-[2.5rem] border-2 shadow-2xl ${accessibility.highContrast
                              ? 'bg-black border-yellow-400 text-yellow-200'
                              : 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                              }`}>
                              <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-sm">
                                  <BookOpen size={28} />
                                </div>
                                <div className={`${getHeaderSize()} font-black tracking-tight uppercase`}>
                                  {glossKey || 'UNKNOWN'}
                                </div>
                              </div>
                              {current.description && (
                                <div className="space-y-4">
                                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Description & Usage</div>
                                  <p className={`${accessibility.largeText ? 'text-2xl' : 'text-xl'} font-medium leading-relaxed opacity-90 text-slate-700 dark:text-slate-300`}>
                                    {current.description}
                                  </p>
                                </div>
                              )}
                              {current.page && (
                                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                  <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 shadow-inner">
                                    <span className={`${accessibility.largeText ? 'text-base' : 'text-[10px]'} font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest`}>
                                      Dictionary Source: Page {current.page}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                                    Text Match
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Dictionary Entries Grid (User Centric Feature) */}
                          <div className="mt-12 space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                Detected Word Sequence
                              </h4>
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                {signSequence.length} {signSequence.length === 1 ? 'Entry' : 'Entries'}
                              </span>
                            </div>
                            
                            <div className="flex gap-4 overflow-x-auto pb-6 px-1 scrollbar-hide snap-x">
                              {signSequence.map((entry, idx) => {
                                const isCurrent = idx === currentSignIndex;
                                const gloss = (entry.gloss || entry.word || '').toUpperCase();
                                const hasImagesEntry = entry.images && entry.images.length > 0;
                                const firstImg = hasImagesEntry ? getImageUrlLocal(entry.images[0]) : null;

                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setCurrentSignIndex(idx);
                                      setCurrentFrameIndex(0);
                                      setAutoPlay(false);
                                    }}
                                    className={`
                                      flex-shrink-0 w-36 sm:w-44 snap-start group transition-all duration-500
                                      ${isCurrent ? 'scale-105' : 'opacity-60 hover:opacity-100 hover:scale-102'}
                                    `}
                                  >
                                    <div className={`
                                      relative aspect-square rounded-2xl overflow-hidden mb-3 border-2 transition-all duration-500 shadow-lg
                                      ${isCurrent 
                                        ? 'border-emerald-500 ring-4 ring-emerald-500/20' 
                                        : 'border-slate-200 dark:border-slate-800'
                                      }
                                      ${accessibility.highContrast && isCurrent ? 'border-yellow-400 ring-yellow-400/40' : ''}
                                    `}>
                                      {firstImg ? (
                                        <img 
                                          src={firstImg} 
                                          alt={gloss} 
                                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                          loading="lazy"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            if (target.src !== 'https://via.placeholder.com/400x400?text=Sign+Diagram+Unavailable') {
                                              target.src = 'https://via.placeholder.com/400x400?text=Sign+Diagram+Unavailable';
                                              target.classList.add('opacity-50', 'grayscale');
                                            }
                                          }}
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                          <BookOpen size={24} />
                                        </div>
                                      )}
                                      <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-500 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                      <div className="absolute bottom-2 left-2 right-2 text-[10px] font-black text-white truncate text-center uppercase tracking-wider">
                                        {gloss}
                                      </div>
                                    </div>
                                    <div className={`h-1 w-full rounded-full transition-all duration-500 ${isCurrent ? 'bg-emerald-500' : 'bg-transparent'}`} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
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
                    <React.Suspense fallback={
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <span className="text-xs font-black uppercase tracking-widest animate-pulse">Loading Avatar...</span>
                      </div>
                    }>
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
                    </React.Suspense>

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
          </div>
        </div>
      </div>
    </div>
  )
}

export default Interpreter
