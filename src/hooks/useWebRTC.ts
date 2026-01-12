import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'

export interface WebRTCState {
  isSupported: boolean
  isConnected: boolean
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  videoPermission: 'unknown' | 'prompt' | 'granted' | 'denied'
  audioPermission: 'unknown' | 'prompt' | 'granted' | 'denied'
  videoStream: MediaStream | null
  audioStream: MediaStream | null
  error: string | null
  videoLevel: number
  audioLevel: number
}

export interface WebRTCActions {
  startVideo: () => Promise<void>
  stopVideo: () => void
  startAudio: () => Promise<void>
  stopAudio: () => void
  toggleVideo: () => Promise<void>
  toggleAudio: () => Promise<void>
  getVideoFrame: () => string | null
  getAudioData: () => Float32Array | null
  clearError: () => void
  setVideoElement: (el: HTMLVideoElement | null) => void
}

export const useWebRTC = (): WebRTCState & WebRTCActions => {
  const { settings } = useAppStore()
  const [state, setState] = useState<WebRTCState>({
    isSupported: false,
    isConnected: false,
    isVideoEnabled: false,
    isAudioEnabled: false,
    videoPermission: 'unknown',
    audioPermission: 'unknown',
    videoStream: null,
    audioStream: null,
    error: null,
    videoLevel: 0,
    audioLevel: 0
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Float32Array | null>(null)
  const audioAnimRef = useRef<number | null>(null)
  const videoAnimRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoTrackCheckRef = useRef<number | null>(null)
  const maintainVideoRef = useRef<boolean>(false)
  const maintainAudioRef = useRef<boolean>(false)

  // Check WebRTC support
  useEffect(() => {
    const checkSupport = () => {
      const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      setState(prev => ({ ...prev, isSupported: supported }))
      
      if (!supported) {
        setState(prev => ({ 
          ...prev, 
          error: 'WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.' 
        }))
      } else {
        setState(prev => ({ ...prev, error: null }))
      }
    }
    checkSupport()
  }, [])

  // Permissions status
  useEffect(() => {
    const perms = (navigator as any).permissions
    if (!perms) return
    try {
      perms.query({ name: 'camera' as any }).then((res: any) => {
        setState(prev => ({ ...prev, videoPermission: res.state as any }))
        res.onchange = () => setState(prev => ({ ...prev, videoPermission: res.state as any }))
      }).catch(() => {})
      perms.query({ name: 'microphone' as any }).then((res: any) => {
        setState(prev => ({ ...prev, audioPermission: res.state as any }))
        res.onchange = () => setState(prev => ({ ...prev, audioPermission: res.state as any }))
      }).catch(() => {})
    } catch {}
  }, [])

  // Initialize audio context for level monitoring
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256
        dataArrayRef.current = new Float32Array(analyserRef.current.frequencyBinCount)
      } catch (error) {
        console.error('Failed to initialize audio context:', error)
        setState(prev => ({ 
          ...prev, 
          error: 'Audio processing is not available. Audio level monitoring will be disabled.' 
        }))
      }
    }
  }, [])

  // Monitor audio levels
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getFloatTimeDomainData(dataArrayRef.current)
    
    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i] * dataArrayRef.current[i]
    }
    const rms = Math.sqrt(sum / dataArrayRef.current.length)
    const level = Math.min(1.0, rms * 10) // Scale and clamp

    setState(prev => ({ ...prev, audioLevel: level }))

    if (state.isAudioEnabled) {
      audioAnimRef.current = requestAnimationFrame(monitorAudioLevel)
    }
  }, [state.isAudioEnabled])

  // Monitor video levels (placeholder for video quality)
  const monitorVideoLevel = useCallback(() => {
    // Simple video level monitoring based on stream activity
    if (state.videoStream && state.videoStream.active) {
      const level = Math.random() * 0.3 + 0.7 // Simulate good video signal
      setState(prev => ({ ...prev, videoLevel: level }))
    }

    if (state.isVideoEnabled) {
      videoAnimRef.current = requestAnimationFrame(monitorVideoLevel)
    }
  }, [state.videoStream, state.isVideoEnabled])

  // Start video capture
  const startVideo = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ 
        ...prev, 
        error: 'Video capture is not supported in this browser.' 
      }))
      return
    }

    try {
      setState(prev => ({ ...prev, error: null }))
      
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: 'user'
        }
      }

      // Apply accessibility settings
      if (settings.accessibility.largeText) {
        constraints.video = {
          ...constraints.video,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (primaryErr) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }
      
      setState(prev => ({
        ...prev,
        videoStream: stream,
        isVideoEnabled: true,
        isConnected: true
      }))
      maintainVideoRef.current = true

      // Bind to video element if provided
      if (videoRef.current) {
        try {
          (videoRef.current as any).srcObject = stream
          const el = videoRef.current
          const ensurePlay = () => { el.play().catch(() => {}) }
          if (el.readyState < 2) {
            el.onloadedmetadata = ensurePlay
            el.oncanplay = ensurePlay
          } else {
            ensurePlay()
          }
        } catch {}
      }

      // Restart if track ends
      const vt = stream.getVideoTracks()[0]
      if (vt) {
        vt.onended = () => {
          setState(prev => ({ ...prev, isVideoEnabled: false }))
          if (maintainVideoRef.current) {
            startVideo().catch(() => {
              setState(prev => ({ ...prev, error: 'Camera stopped. Please retry.' }))
            })
          }
        }
        vt.onmute = () => {
          if (maintainVideoRef.current) {
            startVideo().catch(() => {})
          }
        }
      }
      // Periodic check for track state
      if (videoTrackCheckRef.current) clearInterval(videoTrackCheckRef.current)
      videoTrackCheckRef.current = window.setInterval(() => {
        const t = stream.getVideoTracks()[0]
        if (maintainVideoRef.current && (!t || t.readyState === 'ended' || !stream.active)) {
          startVideo().catch(() => {})
        }
      }, 5000)

      // Start monitoring video levels
      monitorVideoLevel()
      
    } catch (error) {
      let errorMessage = 'Failed to access camera. '
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage += 'Camera access was denied. Please allow camera access in your browser settings.'
            break
          case 'NotFoundError':
            errorMessage += 'No camera was found. Please ensure a camera is connected.'
            break
          case 'NotReadableError':
            errorMessage += 'Camera is already in use by another application.'
            break
          default:
            errorMessage += error.message
        }
      } else if (error instanceof Error) {
        errorMessage += error.message
      } else {
        errorMessage += 'Unknown error occurred.'
      }

      setState(prev => ({ ...prev, error: errorMessage }))
      console.error('Video capture error:', error)
    }
  }, [state.isSupported, settings.accessibility.largeText, monitorVideoLevel])

  // Start audio capture
  const startAudio = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ 
        ...prev, 
        error: 'Audio capture is not supported in this browser.' 
      }))
      return
    }

    try {
      setState(prev => ({ ...prev, error: null }))
      initAudioContext()
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {})
      }
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: settings.audio.backgroundNoiseReduction,
          noiseSuppression: settings.audio.backgroundNoiseReduction,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (primaryErr) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      
      // Connect audio to analyser for level monitoring
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream)
        source.connect(analyserRef.current)
      }

      setState(prev => ({
        ...prev,
        audioStream: stream,
        isAudioEnabled: true,
        isConnected: true
      }))
      maintainAudioRef.current = true

      // Start monitoring audio levels
      monitorAudioLevel()
      
    } catch (error) {
      let errorMessage = 'Failed to access microphone. '
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage += 'Microphone access was denied. Please allow microphone access in your browser settings.'
            break
          case 'NotFoundError':
            errorMessage += 'No microphone was found. Please ensure a microphone is connected.'
            break
          case 'NotReadableError':
            errorMessage += 'Microphone is already in use by another application.'
            break
          default:
            errorMessage += error.message
        }
      } else if (error instanceof Error) {
        errorMessage += error.message
      } else {
        errorMessage += 'Unknown error occurred.'
      }

      setState(prev => ({ ...prev, error: errorMessage }))
      console.error('Audio capture error:', error)
    }
  }, [state.isSupported, settings.audio.backgroundNoiseReduction, initAudioContext, monitorAudioLevel])

  // Stop video capture
  const stopVideo = useCallback(() => {
    if (state.videoStream) {
      state.videoStream.getTracks().forEach(track => track.stop())
    }
    maintainVideoRef.current = false
    
    if (videoAnimRef.current) {
      cancelAnimationFrame(videoAnimRef.current)
      videoAnimRef.current = null
    }
    if (videoTrackCheckRef.current) {
      clearInterval(videoTrackCheckRef.current)
      videoTrackCheckRef.current = null
    }

    setState(prev => ({
      ...prev,
      videoStream: null,
      isVideoEnabled: false,
      videoLevel: 0
    }))
  }, [state.videoStream])

  // Stop audio capture
  const stopAudio = useCallback(() => {
    if (state.audioStream) {
      state.audioStream.getTracks().forEach(track => track.stop())
    }
    maintainAudioRef.current = false
    
    if (audioAnimRef.current) {
      cancelAnimationFrame(audioAnimRef.current)
      audioAnimRef.current = null
    }

    setState(prev => ({
      ...prev,
      audioStream: null,
      isAudioEnabled: false,
      audioLevel: 0
    }))
  }, [state.audioStream])

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (state.isVideoEnabled) {
      stopVideo()
    } else {
      await startVideo()
    }
  }, [state.isVideoEnabled, startVideo, stopVideo])

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (state.isAudioEnabled) {
      stopAudio()
    } else {
      await startAudio()
    }
  }, [state.isAudioEnabled, startAudio, stopAudio])

  // Get current video frame as base64
  const getVideoFrame = useCallback((): string | null => {
    if (!state.videoStream || !videoRef.current) return null

    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }
      
      const canvas = canvasRef.current
      const video = videoRef.current
      
      // Set canvas dimensions to match video
      if (!video.videoWidth || !video.videoHeight) return null
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      
      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Convert to base64
      return canvas.toDataURL('image/jpeg', 0.8)
    } catch (error) {
      console.error('Error capturing video frame:', error)
      return null
    }
  }, [state.videoStream])

  const setVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && state.videoStream) {
      try {
        (el as any).srcObject = state.videoStream
        el.play().catch(() => {})
      } catch {}
    }
  }, [state.videoStream])

  // Get current audio data
  const getAudioData = useCallback((): Float32Array | null => {
    if (!state.audioStream || !analyserRef.current || !dataArrayRef.current) return null
    
    try {
      analyserRef.current.getFloatTimeDomainData(dataArrayRef.current)
      return new Float32Array(dataArrayRef.current) // Return a copy
    } catch (error) {
      console.error('Error getting audio data:', error)
      return null
    }
  }, [state.audioStream])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioAnimRef.current) cancelAnimationFrame(audioAnimRef.current)
      if (videoAnimRef.current) cancelAnimationFrame(videoAnimRef.current)
      if (videoTrackCheckRef.current) clearInterval(videoTrackCheckRef.current)
      maintainVideoRef.current = false
      maintainAudioRef.current = false
      if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop())
      }
      if (state.audioStream) {
        state.audioStream.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return {
    ...state,
    startVideo,
    stopVideo,
    startAudio,
    stopAudio,
    toggleVideo,
    toggleAudio,
    getVideoFrame,
    getAudioData,
    clearError,
    setVideoElement
  }
}

// Hook for managing WebSocket connections
export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      wsRef.current = new WebSocket(url)
      
      wsRef.current.onopen = () => {
        setIsConnected(true)
        setError(null)
        console.log('WebSocket connected')
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('Connection error occurred')
      }

      wsRef.current.onclose = () => {
        setIsConnected(false)
        console.log('WebSocket disconnected')
        
        // Attempt to reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...')
          connect()
        }, 3000)
      }

    } catch (error) {
      setError('Failed to establish WebSocket connection')
      console.error('WebSocket connection error:', error)
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return {
    isConnected,
    lastMessage,
    error,
    connect,
    disconnect,
    sendMessage
  }
}

export default useWebRTC
