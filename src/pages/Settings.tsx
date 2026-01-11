import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Accessibility, 
  Volume2, 
  Eye, 
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Palette,
  User,
  Globe,
  BookOpen
} from 'lucide-react'
import { 
  useAppStore, 
  useAccessibilitySettings,
  useTranslationSettings,
  useAudioSettings,
  useVisualSettings,
  useGhanaSettings
} from '../stores/appStore'

const Settings: React.FC = () => {
  const navigate = useNavigate()
  const { settings, resetSettings } = useAppStore()
  
  const accessibility = useAccessibilitySettings()
  const translation = useTranslationSettings()
  const audio = useAudioSettings()
  const visual = useVisualSettings()
  const ghana = useGhanaSettings()
  
  const [activeTab, setActiveTab] = useState('accessibility')
  const [hasChanges, setHasChanges] = useState(false)
  
  const { accessibility: accessibilitySettings } = settings
  
  const getTextSize = () => {
    return accessibilitySettings.largeText ? 'text-xl' : 'text-lg'
  }
  
  const getButtonSize = () => {
    return accessibilitySettings.largeText ? 'w-16 h-16' : 'w-12 h-12'
  }
  
  const tabs = [
    { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
    { id: 'translation', label: 'Translation', icon: Globe },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'visual', label: 'Visual', icon: Eye },
    { id: 'ghana', label: 'Ghana', icon: BookOpen }
  ]
  
  const handleSave = () => {
    // Settings are automatically saved via Zustand persist
    setHasChanges(false)
    // Show success feedback
    const event = new CustomEvent('settings-saved', { detail: { success: true } })
    window.dispatchEvent(event)
  }
  
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      resetSettings()
      setHasChanges(false)
    }
  }
  
  const renderAccessibilityTab = () => (
    <div className="space-y-8">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Visual Accessibility
        </h3>
        
        <div className="space-y-6">
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Palette className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`} />
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  High Contrast Mode
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Increase contrast for better visibility
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={accessibilitySettings.highContrast}
              onChange={(e) => {
                accessibility.updateAccessibility({ highContrast: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`}>
                <span className={`${accessibilitySettings.largeText ? 'text-2xl' : 'text-xl'} font-bold`}>A</span>
              </div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Large Text
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Increase text size throughout the app
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={accessibilitySettings.largeText}
              onChange={(e) => {
                accessibility.updateAccessibility({ largeText: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <BookOpen className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`} />
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Dyslexia-Friendly Font
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Use fonts optimized for dyslexic users
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={accessibilitySettings.dyslexiaFriendlyFont}
              onChange={(e) => {
                accessibility.updateAccessibility({ dyslexiaFriendlyFont: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`}>
                <span className={`${accessibilitySettings.largeText ? 'text-xl' : 'text-lg'} font-bold`}>○</span>
              </div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Focus Indicators
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Highlight focused elements clearly
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={accessibilitySettings.focusIndicators}
              onChange={(e) => {
                accessibility.updateAccessibility({ focusIndicators: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
    </div>
  )
  
  const renderTranslationTab = () => (
    <div className="space-y-8">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Translation Speed
        </h3>
        
        <div className="space-y-6">
          <div>
            <label className={`block font-semibold mb-3 ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
              Sign Language Speed
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={translation.signSpeed}
                onChange={(e) => {
                  translation.updateTranslation({ signSpeed: parseFloat(e.target.value) })
                  setHasChanges(true)
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                {translation.signSpeed.toFixed(1)}x
              </span>
            </div>
            <div className={`flex justify-between mt-2 ${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>
          
          <div>
            <label className={`block font-semibold mb-3 ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
              Speech Speed
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={translation.speechSpeed}
                onChange={(e) => {
                  translation.updateTranslation({ speechSpeed: parseFloat(e.target.value) })
                  setHasChanges(true)
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                {translation.speechSpeed.toFixed(1)}x
              </span>
            </div>
            <div className={`flex justify-between mt-2 ${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Avatar Settings
        </h3>
        
        <div className="space-y-6">
          <div>
            <label className={`block font-semibold mb-3 ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
              Avatar Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  translation.updateTranslation({ avatarMode: '3d_avatar' })
                  setHasChanges(true)
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  translation.avatarMode === '3d_avatar'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  3D Avatar
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Realistic 3D signing character
                </div>
              </button>
              
              <button
                onClick={() => {
                  translation.updateTranslation({ avatarMode: 'video_clips' })
                  setHasChanges(true)
                }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  translation.avatarMode === 'video_clips'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Video Clips
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Pre-recorded sign videos
                </div>
              </button>
            </div>
          </div>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`}>
                <span className={`${accessibilitySettings.largeText ? 'text-xl' : 'text-lg'} font-bold`}>😊</span>
              </div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Facial Expressions
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Include facial expressions in avatar
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={translation.facialExpressions}
              onChange={(e) => {
                translation.updateTranslation({ facialExpressions: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`}>
                <span className={`${accessibilitySettings.largeText ? 'text-xl' : 'text-lg'} font-bold`}>~</span>
              </div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Gesture Smoothing
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Smooth transitions between signs
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={translation.gestureSmoothing}
              onChange={(e) => {
                translation.updateTranslation({ gestureSmoothing: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
    </div>
  )
  
  const renderAudioTab = () => (
    <div className="space-y-8">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Volume & Feedback
        </h3>
        
        <div className="space-y-6">
          <div>
            <label className={`block font-semibold mb-3 ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
              Volume Level
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.volumeLevel}
                onChange={(e) => {
                  audio.updateAudio({ volumeLevel: parseFloat(e.target.value) })
                  setHasChanges(true)
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                {Math.round(audio.volumeLevel * 100)}%
              </span>
            </div>
            <div className={`flex justify-between mt-2 ${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
              <span>Mute</span>
              <span>Max</span>
            </div>
          </div>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Volume2 className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`} />
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Audio Feedback
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Play sounds for user actions
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={audio.audioFeedback}
              onChange={(e) => {
                audio.updateAudio({ audioFeedback: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
      
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Speech Recognition
        </h3>
        
        <div className="space-y-6">
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🇬🇭</div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Ghanaian Accent Recognition
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Optimize for Ghanaian English pronunciation
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={audio.ghanaianAccent}
              onChange={(e) => {
                audio.updateAudio({ ghanaianAccent: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`}>
                <span className={`${accessibilitySettings.largeText ? 'text-xl' : 'text-lg'} font-bold`}>🔧</span>
              </div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Background Noise Reduction
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Filter out ambient noise for clearer recognition
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={audio.backgroundNoiseReduction}
              onChange={(e) => {
                audio.updateAudio({ backgroundNoiseReduction: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
    </div>
  )
  
  const renderVisualTab = () => (
    <div className="space-y-8">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Display Options
        </h3>
        
        <div className="space-y-6">
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Eye className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`} />
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Show Confidence Score
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Display recognition confidence percentage
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={visual.showConfidence}
              onChange={(e) => {
                visual.updateVisual({ showConfidence: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`}>
                <span className={`${accessibilitySettings.largeText ? 'text-xl' : 'text-lg'} font-bold`}>📍</span>
              </div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Show Landmarks
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Display hand and body tracking guides
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={visual.showLandmarks}
              onChange={(e) => {
                visual.updateVisual({ showLandmarks: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'} flex items-center justify-center ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-600'}`}>
                <span className={`${accessibilitySettings.largeText ? 'text-xl' : 'text-lg'} font-bold`}>📐</span>
              </div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Signing Space Overlay
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Show optimal signing area guidelines
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={visual.signingSpaceOverlay}
              onChange={(e) => {
                visual.updateVisual({ signingSpaceOverlay: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
      
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Animation Quality
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'low', label: 'Low', desc: 'Faster performance' },
            { value: 'medium', label: 'Medium', desc: 'Balanced quality' },
            { value: 'high', label: 'High', desc: 'Best visual quality' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => {
                visual.updateVisual({ animationQuality: option.value as any })
                setHasChanges(true)
              }}
              className={`p-4 rounded-xl border-2 transition-all ${
                visual.animationQuality === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                {option.label}
              </div>
              <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                {option.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
  
  const renderGhanaTab = () => (
    <div className="space-y-8">
      <div className={`p-6 rounded-2xl border-2 ${accessibilitySettings.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-3xl">🇬🇭</div>
          <h3 className={`${getTextSize()} font-bold ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-blue-900'}`}>
            Ghana Sign Language Features
          </h3>
        </div>
        <p className={`${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-blue-800'}`}>
          These settings are specifically designed for Ghanaian users and cultural context.
        </p>
      </div>
      
      <div>
        <h3 className={`${getTextSize()} font-bold mb-6 ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
          Cultural Settings
        </h3>
        
        <div className="space-y-6">
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🗣️</div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Local Dialects
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Support for Ghanaian English variations
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={ghana.localDialects}
              onChange={(e) => {
                ghana.updateGhana({ localDialects: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🌍</div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Cultural Context
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Include Ghanaian cultural references
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={ghana.culturalContext}
              onChange={(e) => {
                ghana.updateGhana({ culturalContext: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🤝</div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Traditional Signs
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Include traditional Ghanaian signs
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={ghana.traditionalSigns}
              onChange={(e) => {
                ghana.updateGhana({ traditionalSigns: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
          
          <label className="flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📚</div>
              <div>
                <div className={`font-semibold ${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Educational Mode
                </div>
                <div className={`${accessibilitySettings.largeText ? 'text-sm' : 'text-xs'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Show learning aids and explanations
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={ghana.educationalMode}
              onChange={(e) => {
                ghana.updateGhana({ educationalMode: e.target.checked })
                setHasChanges(true)
              }}
              className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
    </div>
  )
  
  return (
    <div className={`min-h-screen ${accessibilitySettings.highContrast ? 'bg-black text-yellow-400' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${accessibilitySettings.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} shadow-lg border-b-2`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className={`
                  ${getButtonSize()} rounded-full flex items-center justify-center
                  ${accessibilitySettings.highContrast 
                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border-2 border-yellow-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  transform hover:scale-110 active:scale-95 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-blue-300
                `}
                aria-label="Go back to home"
              >
                <ArrowLeft className={`${accessibilitySettings.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>
              
              <div>
                <h1 className={`${getTextSize()} font-bold ${accessibilitySettings.highContrast ? 'text-yellow-400' : 'text-gray-900'}`}>
                  Settings
                </h1>
                <p className={`${accessibilitySettings.largeText ? 'text-lg' : 'text-base'} ${accessibilitySettings.highContrast ? 'text-yellow-300' : 'text-gray-600'}`}>
                  Customize your experience
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <button
                  onClick={handleSave}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-full font-semibold
                    ${accessibilitySettings.highContrast 
                      ? 'bg-yellow-400 text-black hover:bg-yellow-500' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                    }
                    transform hover:scale-105 active:scale-95 transition-all duration-200
                    focus:outline-none focus:ring-4 focus:ring-green-300
                  `}
                >
                  <Save className={`${accessibilitySettings.largeText ? 'w-6 h-6' : 'w-5 h-5'}`} />
                  <span className={accessibilitySettings.largeText ? 'text-lg' : 'text-base'}>Save</span>
                </button>
              )}
              
              <button
                onClick={handleReset}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-full font-semibold
                  ${accessibilitySettings.highContrast 
                    ? 'bg-gray-800 text-yellow-400 border-2 border-yellow-400 hover:bg-gray-700' 
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                  }
                  transform hover:scale-105 active:scale-95 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-gray-300
                `}
              >
                <RotateCcw className={`${accessibilitySettings.largeText ? 'w-6 h-6' : 'w-5 h-5'}`} />
                <span className={accessibilitySettings.largeText ? 'text-lg' : 'text-base'}>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className={`${accessibilitySettings.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} border-b-2`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 font-semibold whitespace-nowrap transition-all
                    ${activeTab === tab.id
                      ? accessibilitySettings.highContrast
                        ? 'text-yellow-400 border-b-4 border-yellow-400 bg-gray-800'
                        : 'text-blue-600 border-b-4 border-blue-600 bg-blue-50'
                      : accessibilitySettings.highContrast
                        ? 'text-yellow-300 hover:text-yellow-400 hover:bg-gray-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className={`${accessibilitySettings.largeText ? 'w-6 h-6' : 'w-5 h-5'}`} />
                  <span className={accessibilitySettings.largeText ? 'text-lg' : 'text-base'}>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`${accessibilitySettings.highContrast ? 'bg-gray-900 border-yellow-400' : 'bg-white'} rounded-2xl shadow-xl p-8 border-2`}>
          {activeTab === 'accessibility' && renderAccessibilityTab()}
          {activeTab === 'translation' && renderTranslationTab()}
          {activeTab === 'audio' && renderAudioTab()}
          {activeTab === 'visual' && renderVisualTab()}
          {activeTab === 'ghana' && renderGhanaTab()}
        </div>
      </div>
    </div>
  )
}

export default Settings
