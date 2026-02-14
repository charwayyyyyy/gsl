import React, { useEffect, useState } from 'react'
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useWebRTC } from '../hooks/useWebRTC'

interface AudioCaptureProps {
  onAudioData?: (audioData: Float32Array) => void
  showLevel?: boolean
  className?: string
  disabled?: boolean
}

const AudioCapture: React.FC<AudioCaptureProps> = ({
  onAudioData,
  showLevel = true,
  className = '',
  disabled = false
}) => {
  const [error, setError] = useState<string | null>(null)
  const [micState, setMicState] = useState<'idle' | 'requesting_permission' | 'listening' | 'processing' | 'error'>('idle')
  
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
  
  useEffect(() => {
    if (!isSupported) {
      setMicState('error')
      return
    }
    if (error || webrtcError) {
      setMicState('error')
      return
    }
    if (isAudioEnabled) {
      setMicState('listening')
    } else if (micState !== 'processing' && micState !== 'requesting_permission') {
      setMicState('idle')
    }
  }, [isSupported, isAudioEnabled, error, webrtcError])

  useEffect(() => {
    if (webrtcError) {
      setError(webrtcError)
    }
  }, [webrtcError])

  useEffect(() => {
    if (!onAudioData || !isAudioEnabled) return

    const captureAudio = () => {
      const audioData = getAudioData()
      if (audioData) {
        onAudioData(audioData)
      }
    }
    const interval = setInterval(captureAudio, 1000 / 30)

    return () => clearInterval(interval)
  }, [isAudioEnabled, onAudioData, getAudioData])

  const toggleAudio = async () => {
    if (disabled) return
    if (isAudioEnabled) {
      setMicState('processing')
      stopAudio()
      setTimeout(() => {
        setMicState(prev => (prev === 'processing' ? 'idle' : prev))
      }, 800)
    } else {
      try {
        setError(null)
        setMicState('requesting_permission')
        await startAudio()
      } catch (error) {
        setError('Failed to start audio')
        setMicState('error')
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

  const displayLevel = isAudioEnabled ? audioLevel : 0
  const isListening = micState === 'listening'
  const isProcessing = micState === 'processing'
  const isRequesting = micState === 'requesting_permission'

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
        <h3 className={`${getTextSize()} font-bold mb-2 text-slate-900 dark:text-white`}>Audio Error</h3>
        <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} text-slate-500 dark:text-slate-400 text-center mb-8`}>
          {error}
        </p>
        <button
          onClick={toggleAudio}
          className="ios-button-primary w-full max-w-xs"
        >
          Retry Microphone
        </button>
      </div>
    )
  }

  return (
    <div className={`
      glass-card flex flex-col items-center p-6 shadow-2xl
      ${accessibility.highContrast 
        ? 'bg-black border-4 border-white' 
        : ''
      }
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <Volume2 className={`${accessibility.largeText ? 'w-6 h-6' : 'w-5 h-5'} text-blue-500`} />
          </div>
          <h3 className={`${getTextSize()} font-bold text-slate-900 dark:text-white`}>
            Audio
          </h3>
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={toggleAudio}
          disabled={disabled || micState === 'requesting_permission'}
          className={`
            ${getButtonSize()} rounded-2xl flex items-center justify-center
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' 
              : isProcessing
                ? 'bg-blue-500 text-white animate-pulse' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
            }
            transition-all duration-300 transform ${disabled ? '' : 'hover:scale-105 active:scale-95'}
            ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : ''}
          `}
          aria-label={isListening ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isListening ? (
            <MicOff className={`${accessibility.largeText ? 'w-7 h-7' : 'w-6 h-6'}`} />
          ) : (
            <Mic className={`${accessibility.largeText ? 'w-7 h-7' : 'w-6 h-6'}`} />
          )}
        </button>
      </div>

      <div className="w-full space-y-6">
        {/* Status Indicator */}
        <div className={`
          flex items-center justify-between px-4 py-3 rounded-2xl
          ${accessibility.highContrast ? 'bg-black border-2 border-white text-yellow-400' : 'bg-slate-100 dark:bg-slate-800/50'}
        `}>
          <span className={`${accessibility.largeText ? 'text-base' : 'text-sm'} font-semibold text-slate-700 dark:text-slate-300`}>
            Status
          </span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} font-bold uppercase tracking-wider text-slate-500`}>
              {!isSupported
                ? 'Unsupported'
                : micState === 'requesting_permission'
                  ? 'Requesting...'
                  : isListening ? 'Listening' : 'Ready'}
            </span>
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
                {Math.round(displayLevel * 100)}%
              </div>
            </div>
            
            {/* Level Bar */}
            <div className={`w-full ${accessibility.largeText ? 'h-6' : 'h-4'} bg-gray-200 rounded-full overflow-hidden ${accessibility.highContrast ? 'bg-gray-800' : ''}`}>
              <div
                className={`h-full transition-all duration-150 ease-out ${getVolumeColor(displayLevel)}`}
                style={{ width: `${Math.min(100, displayLevel * 100)}%` }}
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
            w-3 h-3 rounded-full ${
              isListening ? 'bg-green-500' : micState === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
            }
            ${isListening ? 'animate-pulse' : ''}
          `} />
          <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-700'}`}>
            {isListening
              ? 'Listening for speech'
              : micState === 'processing'
                ? 'Processing speech'
                : micState === 'requesting_permission'
                  ? 'Waiting for microphone access'
                  : 'Microphone Off'}
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
    </div>
  )
}

export default AudioCapture
