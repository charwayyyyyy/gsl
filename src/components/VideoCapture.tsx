import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Camera, CameraOff, AlertCircle } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useWebRTC } from '../hooks/useWebRTC'

interface VideoCaptureProps {
  onFrameCapture?: (frameData: string) => void
  showLandmarks?: boolean
  showConfidence?: boolean
  className?: string
}

const VideoCapture: React.FC<VideoCaptureProps> = ({
  onFrameCapture,
  showLandmarks = true,
  showConfidence = true,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const { settings } = useAppStore()
  const { 
    isSupported,
    isVideoEnabled, 
    videoStream, 
    videoLevel, 
    error: webrtcError,
    startVideo, 
    stopVideo,
    getVideoFrame,
    setVideoElement
  } = useWebRTC()

  const { accessibility, visual } = settings
  
  // Initialize video when support is confirmed
  useEffect(() => {
    if (isSupported && !isVideoEnabled) {
      startVideo().catch(err => {
        setError('Failed to start video capture')
        console.error('Video initialization error:', err)
      })
    }
  }, [isSupported])

  // Handle WebRTC errors
  useEffect(() => {
    if (webrtcError) {
      setError(webrtcError)
    }
  }, [webrtcError])

  // Set up video stream
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream
      setVideoElement(videoRef.current)
      
      // Start frame capture loop
      if (onFrameCapture) {
        setIsCapturing(true)
      }
    }
  }, [videoStream, onFrameCapture, setVideoElement])

  // Frame capture loop
  useEffect(() => {
    if (!isCapturing || !onFrameCapture) return

    const captureFrame = () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const frameData = getVideoFrame()
        if (frameData) {
          onFrameCapture(frameData)
        }
      }
    }

    // Capture frames at 10 FPS for performance (reduced to give backend breathing room)
    const interval = setInterval(captureFrame, 1000 / 10)

    return () => {
      clearInterval(interval)
      setIsCapturing(false)
    }
  }, [isCapturing, onFrameCapture, getVideoFrame])

  // Simulate confidence updates (would come from backend in real implementation)
  useEffect(() => {
    const interval = setInterval(() => {
      setConfidence(Math.random() * 0.3 + 0.7) // 70-100% confidence
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const toggleVideo = useCallback(async () => {
    if (isVideoEnabled) {
      stopVideo()
      setIsCapturing(false)
    } else {
      try {
        await startVideo()
        if (onFrameCapture) {
          setIsCapturing(true)
        }
      } catch (error) {
        setError('Failed to start video')
        console.error('Video toggle error:', error)
      }
    }
  }, [isVideoEnabled, startVideo, stopVideo, onFrameCapture])

  const getTextSize = () => {
    if (accessibility.largeText) return 'text-xl'
    return 'text-lg'
  }

  const getButtonSize = () => {
    if (accessibility.largeText) return 'w-16 h-16'
    return 'w-12 h-12'
  }

  const getConfidenceColor = (level: number) => {
    if (level >= 0.8) return 'bg-green-500'
    if (level >= 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (error) {
    return (
      <div className={`
        glass-card flex flex-col items-center justify-center p-8
        ${accessibility.highContrast 
          ? 'bg-black border-4 border-yellow-400 text-yellow-400' 
          : 'border-red-500/20'
        }
        ${className}
      `}>
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-glass border border-red-500/20">
          <AlertCircle className={`${accessibility.largeText ? 'w-10 h-10' : 'w-8 h-8'} text-red-500`} />
        </div>
        <h3 className={`${getTextSize()} font-bold mb-2 text-slate-900 dark:text-white`}>Video Error</h3>
        <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} text-slate-600 dark:text-slate-400 text-center mb-8`}>
          {error}
        </p>
        <button
          onClick={toggleVideo}
          className="ios-button-primary w-full max-w-xs"
        >
          Retry Camera
        </button>
      </div>
    )
  }

  return (
    <div className={`
      relative rounded-3xl overflow-hidden shadow-2xl group
      ${accessibility.highContrast ? 'border-4 border-white' : 'border border-white/20 shadow-glass'}
      ${className}
    `}>
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover bg-slate-950 transition-all duration-700 group-hover:scale-105"
        style={{
          filter: accessibility.highContrast ? 'contrast(1.5) brightness(1.2)' : undefined
        }}
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none transition-opacity duration-500 group-hover:opacity-40" />
      
      {/* Top Status Bar */}
      <div className="absolute top-4 inset-x-4 flex justify-between items-center pointer-events-auto">
        <div className="glass px-4 py-2 rounded-2xl flex items-center gap-3 animate-fade-in border-white/20">
          <div className={`w-2 h-2 rounded-full ${isVideoEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            {isVideoEnabled ? 'Live Feed' : 'Camera Off'}
          </span>
        </div>

        <button
          onClick={toggleVideo}
          className={`
            ${getButtonSize()} rounded-2xl flex items-center justify-center backdrop-blur-md transition-all duration-300 transform hover:scale-105 active:scale-95
            ${isVideoEnabled 
              ? 'bg-red-500/80 hover:bg-red-500 text-white' 
              : 'bg-blue-600/80 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            }
          `}
          aria-label={isVideoEnabled ? 'Stop video' : 'Start video'}
        >
          {isVideoEnabled ? (
            <CameraOff className={`${accessibility.largeText ? 'w-7 h-7' : 'w-6 h-6'}`} />
          ) : (
            <Camera className={`${accessibility.largeText ? 'w-7 h-7' : 'w-6 h-6'}`} />
          )}
        </button>
      </div>

      {/* Confidence Overlay */}
      {showConfidence && isVideoEnabled && (
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none animate-slide-up">
          <div className="glass p-4 rounded-2xl border-white/20 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em]">Detection Confidence</span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${getConfidenceColor(confidence)} text-white`}>
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${getConfidenceColor(confidence)}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Scanning Animation */}
      {isVideoEnabled && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="w-full h-[2px] bg-blue-400 absolute animate-scan" />
        </div>
      )}
    </div>
  )
}

export default VideoCapture
