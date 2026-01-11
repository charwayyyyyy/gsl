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
    isVideoEnabled, 
    videoStream, 
    videoLevel, 
    error: webrtcError,
    startVideo, 
    stopVideo,
    getVideoFrame 
  } = useWebRTC()

  const { accessibility, visual } = settings
  
  // Initialize video on mount
  useEffect(() => {
    if (!isVideoEnabled) {
      startVideo().catch(err => {
        setError('Failed to start video capture')
        console.error('Video initialization error:', err)
      })
    }
  }, [])

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
      
      // Start frame capture loop
      if (onFrameCapture) {
        setIsCapturing(true)
      }
    }
  }, [videoStream, onFrameCapture])

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

    // Capture frames at 15 FPS for performance
    const interval = setInterval(captureFrame, 1000 / 15)

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
        flex flex-col items-center justify-center p-8 rounded-2xl
        ${accessibility.highContrast 
          ? 'bg-black border-4 border-yellow-400 text-yellow-400' 
          : 'bg-red-50 border-2 border-red-200 text-red-800'
        }
        ${className}
      `}>
        <AlertCircle className={`${accessibility.largeText ? 'w-16 h-16' : 'w-12 h-12'} mb-4`} />
        <h3 className={`${getTextSize()} font-bold mb-2`}>Video Error</h3>
        <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} text-center mb-4`}>
          {error}
        </p>
        <button
          onClick={toggleVideo}
          className={`
            px-6 py-3 rounded-full font-semibold
            ${accessibility.highContrast 
              ? 'bg-yellow-400 text-black hover:bg-yellow-500' 
              : 'bg-red-600 text-white hover:bg-red-700'
            }
            transform hover:scale-105 active:scale-95 transition-all duration-200
            focus:outline-none focus:ring-4 focus:ring-red-300
          `}
        >
          Retry Camera
        </button>
      </div>
    )
  }

  return (
    <div className={`
      relative rounded-2xl overflow-hidden shadow-2xl
      ${accessibility.highContrast ? 'border-4 border-white' : ''}
      ${className}
    `}>
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{
          filter: accessibility.highContrast ? 'contrast(1.5) brightness(1.2)' : undefined
        }}
      />

      {/* Video Controls Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      
      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-auto">
        <button
          onClick={toggleVideo}
          className={`
            ${getButtonSize()} rounded-full flex items-center justify-center
            ${isVideoEnabled 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
            }
            shadow-lg transform hover:scale-110 active:scale-95 transition-all duration-200
            focus:outline-none focus:ring-4 focus:ring-white/50
          `}
          aria-label={isVideoEnabled ? 'Stop video' : 'Start video'}
        >
          {isVideoEnabled ? (
            <CameraOff className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          ) : (
            <Camera className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          )}
        </button>

        {/* Confidence Indicator */}
        {showConfidence && (
          <div className={`
            flex items-center gap-2 px-4 py-2 rounded-full
            ${accessibility.highContrast 
              ? 'bg-black/80 border-2 border-yellow-400 text-yellow-400' 
              : 'bg-black/70 text-white'
            }
          `}>
            <div className={`w-3 h-3 rounded-full ${getConfidenceColor(confidence)}`} />
            <span className={`${accessibility.largeText ? 'text-base' : 'text-sm'} font-semibold`}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Bottom Status */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex items-center justify-between">
          {/* Video Level Indicator */}
          <div className="flex items-center gap-2">
            <div className={`
              flex gap-1 ${accessibility.largeText ? 'h-6' : 'h-4'}
            `}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`
                    ${accessibility.largeText ? 'w-2' : 'w-1'} rounded-full transition-all duration-200
                    ${videoLevel > (i * 0.2) 
                      ? 'bg-green-400' 
                      : 'bg-gray-600'
                    }
                  `}
                  style={{
                    height: `${Math.max(20, (i + 1) * 20)}%`,
                    alignSelf: 'flex-end'
                  }}
                />
              ))}
            </div>
            <span className={`
              ${accessibility.largeText ? 'text-sm' : 'text-xs'} text-white font-medium
            `}>
              Video
            </span>
          </div>

          {/* Status Text */}
          <div className={`
            ${accessibility.largeText ? 'text-sm' : 'text-xs'} text-white font-medium
          `}>
            {isVideoEnabled ? 'Camera Active' : 'Camera Off'}
          </div>
        </div>
      </div>

      {/* Signing Space Guidelines */}
      {visual.showLandmarks && isVideoEnabled && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Center crosshair */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`
              ${accessibility.highContrast ? 'border-yellow-400' : 'border-white/50'}
              border-2 border-dashed rounded-full w-64 h-48
            `} />
          </div>
          
          {/* Corner markers */}
          <div className="absolute top-1/4 left-1/4 w-4 h-4 border-t-2 border-l-2 border-white/50" />
          <div className="absolute top-1/4 right-1/4 w-4 h-4 border-t-2 border-r-2 border-white/50" />
          <div className="absolute bottom-1/4 left-1/4 w-4 h-4 border-b-2 border-l-2 border-white/50" />
          <div className="absolute bottom-1/4 right-1/4 w-4 h-4 border-b-2 border-r-2 border-white/50" />
        </div>
      )}

      {/* Hidden canvas for frame extraction */}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={640}
        height={480}
      />
    </div>
  )
}

export default VideoCapture