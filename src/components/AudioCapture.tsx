import React, { useEffect, useState } from 'react'
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useWebRTC } from '../hooks/useWebRTC'

interface AudioCaptureProps {
  onAudioData?: (audioData: Float32Array) => void
  showLevel?: boolean
  className?: string
}

const AudioCapture: React.FC<AudioCaptureProps> = ({
  onAudioData,
  showLevel = true,
  className = ''
}) => {
  const [error, setError] = useState<string | null>(null)
  
  const { settings } = useAppStore()
  const { 
    isSupported,
    isAudioEnabled, 
    audioStream, 
    audioLevel, 
    error: webrtcError,
    startAudio, 
    stopAudio,
    getAudioData 
  } = useWebRTC()

  const { accessibility, audio } = settings
  
  // Initialize audio when support is confirmed
  useEffect(() => {
    if (isSupported && !isAudioEnabled) {
      startAudio().catch(err => {
        setError('Failed to start audio capture')
        console.error('Audio initialization error:', err)
      })
    }
  }, [isSupported])

  // Handle WebRTC errors
  useEffect(() => {
    if (webrtcError) {
      setError(webrtcError)
    }
  }, [webrtcError])

  // Audio data capture loop
  useEffect(() => {
    if (!onAudioData || !isAudioEnabled) return

    const captureAudio = () => {
      const audioData = getAudioData()
      if (audioData) {
        onAudioData(audioData)
      }
    }

    // Capture audio at 30 FPS for real-time processing
    const interval = setInterval(captureAudio, 1000 / 30)

    return () => clearInterval(interval)
  }, [isAudioEnabled, onAudioData, getAudioData])

  const toggleAudio = async () => {
    if (isAudioEnabled) {
      stopAudio()
    } else {
      try {
        await startAudio()
      } catch (error) {
        setError('Failed to start audio')
        console.error('Audio toggle error:', error)
      }
    }
  }

  const getTextSize = () => {
    if (accessibility.largeText) return 'text-xl'
    return 'text-lg'
  }

  const getButtonSize = () => {
    if (accessibility.largeText) return 'w-16 h-16'
    return 'w-12 h-12'
  }

  const getVolumeColor = (level: number) => {
    if (level >= 0.7) return 'bg-red-500'
    if (level >= 0.4) return 'bg-yellow-500'
    return 'bg-green-500'
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
        <h3 className={`${getTextSize()} font-bold mb-2`}>Audio Error</h3>
        <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} text-center mb-4`}>
          {error}
        </p>
        <button
          onClick={toggleAudio}
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
          Retry Microphone
        </button>
      </div>
    )
  }

  return (
    <div className={`
      flex flex-col items-center p-6 rounded-2xl shadow-2xl
      ${accessibility.highContrast 
        ? 'bg-black border-4 border-white' 
        : 'bg-white'
      }
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-6">
        <div className="flex items-center gap-3">
          <Volume2 className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'} text-blue-600`} />
          <h3 className={`${getTextSize()} font-bold text-gray-800 ${accessibility.highContrast ? 'text-yellow-400' : ''}`}>
            Audio Capture
          </h3>
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={toggleAudio}
          className={`
            ${getButtonSize()} rounded-full flex items-center justify-center
            ${isAudioEnabled 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
            }
            shadow-lg transform hover:scale-110 active:scale-95 transition-all duration-200
            focus:outline-none focus:ring-4 focus:ring-white/50
          `}
          aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioEnabled ? (
            <MicOff className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          ) : (
            <Mic className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          )}
        </button>

        {/* Permission Status */}
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-full
          ${accessibility.highContrast ? 'bg-black border-2 border-white text-yellow-400' : 'bg-white/80'}
        `}>
          <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} font-medium`}>
            {isSupported ? (isAudioEnabled ? 'Mic: granted' : 'Mic: pending') : 'Mic: unsupported'}
          </span>
          <div className={`w-2 h-2 rounded-full ${isAudioEnabled ? 'bg-green-500' : (isSupported ? 'bg-yellow-500' : 'bg-red-500')}`} />
        </div>
      </div>

      {/* Audio Level Visualization */}
      {showLevel && (
        <div className="w-full mb-6">
          <div className="flex items-center gap-4 mb-3">
            <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium text-gray-700 ${accessibility.highContrast ? 'text-yellow-400' : ''}`}>
              Audio Level
            </span>
            <div className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-bold text-blue-600`}>
              {Math.round(audioLevel * 100)}%
            </div>
          </div>
          
          {/* Level Bar */}
          <div className={`w-full ${accessibility.largeText ? 'h-6' : 'h-4'} bg-gray-200 rounded-full overflow-hidden ${accessibility.highContrast ? 'bg-gray-800' : ''}`}>
            <div
              className={`h-full transition-all duration-150 ease-out ${getVolumeColor(audioLevel)}`}
              style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
            />
          </div>
          
          {/* Level Indicators */}
          <div className="flex justify-between mt-2">
            <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} text-gray-500 ${accessibility.highContrast ? 'text-yellow-400' : ''}`}>
              Quiet
            </span>
            <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} text-gray-500 ${accessibility.highContrast ? 'text-yellow-400' : ''}`}>
              Good
            </span>
            <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} text-gray-500 ${accessibility.highContrast ? 'text-yellow-400' : ''}`}>
              Loud
            </span>
          </div>
        </div>
      )}

      {/* Audio Status */}
      <div className="flex items-center gap-3">
        <div className={`
          w-3 h-3 rounded-full ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}
          ${isAudioEnabled ? 'animate-pulse' : ''}
        `} />
        <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-700'}`}>
          {isAudioEnabled ? 'Microphone Active' : 'Microphone Off'}
        </span>
      </div>

      {/* Ghana-specific audio settings */}
      {audio.ghanaianAccent && (
        <div className={`mt-4 p-3 rounded-lg ${accessibility.highContrast ? 'bg-gray-900 border border-yellow-400' : 'bg-blue-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-2xl">🇬🇭</div>
            <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} font-medium ${accessibility.highContrast ? 'text-yellow-400' : 'text-blue-800'}`}>
              Ghanaian Accent Recognition Active
            </span>
          </div>
          <p className={`${accessibility.largeText ? 'text-xs' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-blue-600'}`}>
            Optimized for Ghanaian English pronunciation and speech patterns
          </p>
        </div>
      )}

      {/* Audio Quality Indicator */}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`
                ${accessibility.largeText ? 'w-2 h-6' : 'w-1 h-4'} rounded-full transition-all duration-200
                ${audioLevel > (i * 0.2) 
                  ? getVolumeColor(audioLevel) 
                  : 'bg-gray-300'
                }
              `}
              style={{
                height: `${Math.max(40, (i + 1) * 20)}%`,
                alignSelf: 'flex-end'
              }}
            />
          ))}
        </div>
        <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} font-medium ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-600'}`}>
          Quality
        </span>
      </div>
    </div>
  )
}

export default AudioCapture
