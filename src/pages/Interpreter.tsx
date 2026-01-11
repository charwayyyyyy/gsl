import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, HelpCircle, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useWebRTC, useWebSocket } from '../hooks/useWebRTC'
import VideoCapture from '../components/VideoCapture'
import AudioCapture from '../components/AudioCapture'

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
  
  const { startTranslationSession, endTranslationSession, setLastTranslation } = useAppStore.getState()
  
  // WebSocket connections
  const videoSocket = useWebSocket('ws://localhost:8000/api/video/stream')
  const audioSocket = useWebSocket('ws://localhost:8000/api/audio/stream')
  
  const { accessibility, visual, audio } = settings
  
  // Initialize session
  useEffect(() => {
    if (!currentSession) {
      // Default to sign to speech if no session exists
      startTranslationSession('sign_to_speech')
    }
  }, [])

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
    if (audioSocket.lastMessage) {
      const message = audioSocket.lastMessage
      if (message.type === 'transcription') {
        // Process transcription for speech to sign
        setTranslationText(message.text || '')
        setConfidence(message.confidence || 0)
        
        const mockTranslation = {
          input: message.text || '',
          output: 'GSL signs will be displayed',
          confidence: message.confidence || 0.85,
          timestamp: Date.now()
        }
        setLastTranslation(mockTranslation)
      }
    }
  }, [audioSocket.lastMessage, setLastTranslation])

  // Text-to-speech functionality
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window && !isMuted) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = audio.speechSpeed
      utterance.volume = audio.volumeLevel
      utterance.pitch = 1
      
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
    if (level >= 0.8) return 'text-green-500'
    if (level >= 0.6) return 'text-yellow-500'
    return 'text-red-500'
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

            {/* Confidence Indicator */}
            {visual.showConfidence && (
              <div className={`${accessibility.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-6 border-2`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-bold ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                    Recognition Confidence
                  </h3>
                  <div className={`text-2xl font-bold ${getConfidenceColor(confidence)}`}>
                    {Math.round(confidence * 100)}%
                  </div>
                </div>
                
                <div className={`w-full ${accessibility.largeText ? 'h-4' : 'h-3'} bg-gray-200 rounded-full overflow-hidden ${accessibility.highContrast ? 'bg-gray-700' : ''}`}>
                  <div
                    className={`h-full transition-all duration-300 ease-out ${
                      confidence >= 0.8 ? 'bg-green-500' :
                      confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, confidence * 100)}%` }}
                  />
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
          </div>

          {/* Right Panel - Output */}
          <div className="space-y-6">
            {/* Translation Display */}
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

            {/* Signing Avatar */}
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
                  <div className="text-center">
                    <div className="text-6xl mb-4">🤟</div>
                    <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} ${accessibility.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                      Avatar will appear here
                    </p>
                    <p className={`${accessibility.largeText ? 'text-sm' : 'text-xs'} ${accessibility.highContrast ? 'text-yellow-200' : 'text-gray-500'} mt-2`}>
                      3D signing animation will be displayed
                    </p>
                  </div>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Interpreter