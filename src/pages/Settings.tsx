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

  const isActive = (tabId: string) => activeTab === tabId

  const getTextSize = () => accessibilitySettings.largeText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'

  const renderToggle = (label: string, desc: string, icon: any, checked: boolean, onChange: (val: boolean) => void, emoji?: string) => {
    const renderIcon = () => {
      if (emoji) return <span className="text-3xl">{emoji}</span>
      if (!icon) return null

      // If it's a React element (like <Palette /> or <span>○</span>)
      if (React.isValidElement(icon)) {
        return React.cloneElement(icon as React.ReactElement, {
          className: `${(icon.props as any).className || ''} ${accessibilitySettings.largeText ? 'w-9 h-9' : 'w-7 h-7'} text-blue-400`
        })
      }

      // If it's a component (like Palette)
      const IconComponent = icon
      return <IconComponent className={`${accessibilitySettings.largeText ? 'w-7 h-7 sm:w-9 sm:h-9' : 'w-6 h-6 sm:w-7 sm:h-7'} text-blue-400`} />
    }

    return (
      <label className={`glass-card p-5 sm:p-8 flex items-center justify-between cursor-pointer border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)] transition-all duration-500 group relative overflow-hidden ${accessibilitySettings.highContrast ? 'bg-black border-4 border-yellow-400' : ''}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] -mr-16 -mt-16 rounded-full group-hover:bg-blue-500/10 transition-all duration-500" />
        <div className="flex items-center gap-4 sm:gap-6 relative z-10 flex-1">
          <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center sm:w-16 sm:h-16 rounded-2xl border group-hover:scale-110 transition-all duration-500 shadow-inner ${accessibilitySettings.highContrast ? 'bg-white border-white' : 'bg-blue-500/10 border-blue-500/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40'}`}>
            {renderIcon()}
          </div>
          <div>
            <div className={`font-bold text-slate-900 dark:text-white mb-1 ${accessibilitySettings.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}`}>
              {label}
            </div>
            <div className={`text-slate-600 dark:text-slate-400 leading-relaxed ${accessibilitySettings.largeText ? 'text-sm sm:text-xl' : 'text-xs sm:text-lg'}`}>
              {desc}
            </div>
          </div>
        </div>
        <div className="relative inline-flex items-center cursor-pointer z-10 ml-4 flex-shrink-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-16 h-8 bg-slate-700/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-7 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
        </div>
      </label>
    )
  }

  const renderSlider = (label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void, unit: string = '') => (
    <div className={`glass-card p-6 sm:p-10 relative overflow-hidden group border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)] transition-all duration-500 ${accessibilitySettings.highContrast ? 'bg-black border-4 border-yellow-400' : ''}`}>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] -mr-16 -mb-16 rounded-full group-hover:bg-blue-500/10 transition-all duration-500" />
      <div className="flex justify-between items-center mb-8 relative z-10">
        <label className={`font-bold text-slate-900 dark:text-white ${accessibilitySettings.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}`}>
          {label}
        </label>
        <span className="px-4 py-2 sm:px-6 sm:py-2 rounded-2xl bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30 backdrop-blur-md shadow-glass text-sm sm:text-base">
          {value}{unit}
        </span>
      </div>
      <div className="relative z-10 px-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2.5 bg-slate-700/50 rounded-full appearance-none cursor-pointer accent-blue-500 transition-all hover:accent-blue-400"
        />
        <div className="flex justify-between mt-6 text-slate-500 dark:text-slate-400 font-bold tracking-wider text-sm uppercase">
          <span>Min</span>
          <span>Max</span>
        </div>
      </div>
    </div>
  )

  const tabs = [
    { id: 'accessibility', label: 'Accessibility', icon: Accessibility, color: 'blue' },
    { id: 'translation', label: 'Translation', icon: Globe, color: 'indigo' },
    { id: 'audio', label: 'Audio', icon: Volume2, color: 'rose' },
    { id: 'visual', label: 'Visual', icon: Eye, color: 'amber' },
    { id: 'ghana', label: 'Ghana', icon: BookOpen, color: 'emerald' }
  ]

  const renderTabButton = (tab: { id: string, label: string, icon: any, color: string }) => {
    const Icon = tab.icon
    const active = isActive(tab.id)

    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`
          flex items-center space-x-2 sm:space-x-3 px-4 py-3 sm:px-8 sm:py-4 rounded-2xl transition-all duration-500 relative overflow-hidden group
          ${active
            ? accessibilitySettings.highContrast
              ? 'bg-blue-600 text-slate-900 dark:text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] scale-105 z-10 border-4 border-yellow-400'
              : `bg-${tab.color}-600 text-slate-900 dark:text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] scale-105 z-10`
            : accessibilitySettings.highContrast
              ? 'glass-card bg-black border-2 border-slate-600 text-slate-300 hover:text-slate-900 dark:text-white hover:scale-105 hover:border-yellow-400'
              : 'glass-card text-slate-400 hover:text-slate-900 dark:text-white hover:scale-105'
          }
          ${accessibilitySettings.largeText ? 'text-xl sm:text-2xl' : 'text-sm sm:text-lg font-bold'}
          backdrop-blur-xl ${!accessibilitySettings.highContrast && 'border-white/10'}
        `}
      >
        <div className={`
          p-1.5 sm:p-2 rounded-xl transition-colors duration-500
          ${active ? 'bg-white/20' : 'bg-slate-800/50 group-hover:bg-slate-700'}
        `}>
          <Icon className={accessibilitySettings.largeText ? 'w-5 h-5 sm:w-7 sm:h-7' : 'w-4 h-4 sm:w-6 sm:h-6'} />
        </div>
        <span className="whitespace-nowrap">{tab.label}</span>
        {active && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/40 animate-pulse" />
        )}
      </button>
    )
  }

  const handleSave = () => {
    setHasChanges(false)
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
    <div className="space-y-8 animate-fade-in">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-blue-500 rounded-full" />
          Visual Accessibility
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderToggle(
            'High Contrast Mode',
            'Increase contrast for better visibility',
            <Palette />,
            accessibilitySettings.highContrast,
            (val) => {
              accessibility.updateAccessibility({ highContrast: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Large Text',
            'Increase text size throughout the app',
            <span className="font-bold">A</span>,
            accessibilitySettings.largeText,
            (val) => {
              accessibility.updateAccessibility({ largeText: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Dyslexia-Friendly Font',
            'Use fonts optimized for dyslexic users',
            <BookOpen />,
            accessibilitySettings.dyslexiaFriendlyFont,
            (val) => {
              accessibility.updateAccessibility({ dyslexiaFriendlyFont: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Focus Indicators',
            'Highlight focused elements clearly',
            <span className="font-bold">○</span>,
            accessibilitySettings.focusIndicators,
            (val) => {
              accessibility.updateAccessibility({ focusIndicators: val })
              setHasChanges(true)
            }
          )}
        </div>
      </div>
    </div>
  )

  const renderTranslationTab = () => (
    <div className="space-y-10 animate-fade-in">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-indigo-500 rounded-full" />
          Translation Speed
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {renderSlider(
            'Sign Language Speed',
            translation.signSpeed,
            0.5,
            2.0,
            0.1,
            (val) => {
              translation.updateTranslation({ signSpeed: val })
              setHasChanges(true)
            },
            'x'
          )}

          {renderSlider(
            'Speech Speed',
            translation.speechSpeed,
            0.5,
            2.0,
            0.1,
            (val) => {
              translation.updateTranslation({ speechSpeed: val })
              setHasChanges(true)
            },
            'x'
          )}
        </div>
      </div>

      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-purple-500 rounded-full" />
          Avatar Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => {
              translation.updateTranslation({ avatarMode: '3d_avatar' })
              setHasChanges(true)
            }}
            className={`p-8 rounded-[2rem] border-2 transition-all duration-500 text-left relative overflow-hidden group ${translation.avatarMode === '3d_avatar'
              ? accessibilitySettings.highContrast
                ? 'bg-blue-600/20 border-yellow-400 shadow-glass-hover bg-black'
                : 'bg-blue-600/20 border-blue-500 shadow-glass-hover'
              : accessibilitySettings.highContrast
                ? 'glass-card bg-black border-slate-600 hover:border-yellow-400'
                : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)]'
              }`}
          >
            <div className="relative z-10">
              <div className={`font-bold text-slate-900 dark:text-white mb-2 ${accessibilitySettings.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}`}>
                3D Avatar
              </div>
              <div className={`text-slate-400 ${accessibilitySettings.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'}`}>
                Realistic 3D signing character
              </div>
            </div>
            {translation.avatarMode === '3d_avatar' && (
              <div className="absolute top-4 right-4 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              translation.updateTranslation({ avatarMode: 'video_clips' })
              setHasChanges(true)
            }}
            className={`p-8 rounded-[2rem] border-2 transition-all duration-500 text-left relative overflow-hidden group ${translation.avatarMode === 'video_clips'
              ? accessibilitySettings.highContrast
                ? 'bg-blue-600/20 border-yellow-400 shadow-glass-hover bg-black'
                : 'bg-blue-600/20 border-blue-500 shadow-glass-hover'
              : accessibilitySettings.highContrast
                ? 'glass-card bg-black border-slate-600 hover:border-yellow-400'
                : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)]'
              }`}
          >
            <div className="relative z-10">
              <div className={`font-bold text-slate-900 dark:text-white mb-2 ${accessibilitySettings.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}`}>
                Video Clips
              </div>
              <div className={`text-slate-400 ${accessibilitySettings.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'}`}>
                Pre-recorded sign videos
              </div>
            </div>
            {translation.avatarMode === 'video_clips' && (
              <div className="absolute top-4 right-4 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderToggle(
            'Facial Expressions',
            'Include facial expressions in avatar',
            <span className="text-2xl">😊</span>,
            translation.facialExpressions,
            (val) => {
              translation.updateTranslation({ facialExpressions: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Gesture Smoothing',
            'Smooth transitions between signs',
            <span className="text-2xl">~</span>,
            translation.gestureSmoothing,
            (val) => {
              translation.updateTranslation({ gestureSmoothing: val })
              setHasChanges(true)
            }
          )}
        </div>
      </div>
    </div>
  )

  const renderAudioTab = () => (
    <div className="space-y-10 animate-fade-in">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-rose-500 rounded-full" />
          Volume & Feedback
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {renderSlider(
            'Volume Level',
            Math.round(audio.volumeLevel * 100),
            0,
            100,
            1,
            (val) => {
              audio.updateAudio({ volumeLevel: val / 100 })
              setHasChanges(true)
            },
            '%'
          )}

          {renderToggle(
            'Audio Feedback',
            'Play sounds for user actions',
            <Volume2 />,
            audio.audioFeedback,
            (val) => {
              audio.updateAudio({ audioFeedback: val })
              setHasChanges(true)
            }
          )}
        </div>
      </div>

      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-emerald-500 rounded-full" />
          Speech Recognition
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderToggle(
            'Ghanaian Accent Recognition',
            'Optimize for Ghanaian English pronunciation',
            <span className="text-2xl">🇬🇭</span>,
            audio.ghanaianAccent,
            (val) => {
              audio.updateAudio({ ghanaianAccent: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Background Noise Reduction',
            'Filter out ambient noise for clearer recognition',
            <span className="text-2xl">🔧</span>,
            audio.backgroundNoiseReduction,
            (val) => {
              audio.updateAudio({ backgroundNoiseReduction: val })
              setHasChanges(true)
            }
          )}
        </div>
      </div>
    </div>
  )

  const renderVisualTab = () => (
    <div className="space-y-10 animate-fade-in">
      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-amber-500 rounded-full" />
          Display Options
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderToggle(
            'Show Confidence Score',
            'Display recognition confidence percentage',
            <Eye />,
            visual.showConfidence,
            (val) => {
              visual.updateVisual({ showConfidence: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Show Landmarks',
            'Display hand and body tracking guides',
            <span className="text-2xl">📍</span>,
            visual.showLandmarks,
            (val) => {
              visual.updateVisual({ showLandmarks: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Signing Space Overlay',
            'Show optimal signing area guidelines',
            <span className="text-2xl">📐</span>,
            visual.signingSpaceOverlay,
            (val) => {
              visual.updateVisual({ signingSpaceOverlay: val })
              setHasChanges(true)
            }
          )}
        </div>
      </div>

      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-cyan-500 rounded-full" />
          Animation Quality
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { value: 'low', label: 'Low', desc: 'Faster performance', color: 'slate' },
            { value: 'medium', label: 'Medium', desc: 'Balanced quality', color: 'blue' },
            { value: 'high', label: 'High', desc: 'Best visual quality', color: 'indigo' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => {
                visual.updateVisual({ animationQuality: option.value as any })
                setHasChanges(true)
              }}
              className={`p-8 rounded-[2rem] border-2 transition-all duration-500 text-left relative overflow-hidden group ${visual.animationQuality === option.value
                ? accessibilitySettings.highContrast
                  ? `bg-${option.color}-600/20 border-yellow-400 shadow-glass-hover bg-black`
                  : `bg-${option.color}-600/20 border-${option.color}-500 shadow-glass-hover`
                : accessibilitySettings.highContrast
                  ? 'glass-card bg-black border-slate-600 hover:border-yellow-400'
                  : 'glass-card border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)]'
                }`}
            >
              <div className="relative z-10">
                <div className={`font-bold text-slate-900 dark:text-white mb-2 ${accessibilitySettings.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}`}>
                  {option.label}
                </div>
                <div className={`text-slate-400 ${accessibilitySettings.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'}`}>
                  {option.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderGhanaTab = () => (
    <div className="space-y-10 animate-fade-in">
      <div className={`glass-card p-6 sm:p-10 relative overflow-hidden group border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)] transition-all duration-500 ${accessibilitySettings.highContrast ? 'bg-black border-4 border-yellow-400' : 'border-blue-500/30'}`}>
        <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors duration-500" />
        <div className="relative z-10 flex items-center gap-8">
          <div className="w-20 h-20 rounded-[1.5rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-5xl shadow-inner backdrop-blur-xl">
            🇬🇭
          </div>
          <div>
            <h3 className={`${getTextSize()} font-bold text-slate-900 dark:text-white mb-2`}>
              Ghana Sign Language Features
            </h3>
            <p className={`text-slate-400 leading-relaxed ${accessibilitySettings.largeText ? 'text-xl' : 'text-lg'}`}>
              These settings are specifically designed for Ghanaian users and cultural context,
              ensuring an authentic and localized experience.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className={`${getTextSize()} font-bold mb-8 text-slate-900 dark:text-white flex items-center gap-3`}>
          <div className="w-2 h-8 bg-red-500 rounded-full" />
          Cultural Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderToggle(
            'Local Dialects',
            'Support for Ghanaian English variations',
            <span className="text-2xl">🗣️</span>,
            ghana.localDialects,
            (val) => {
              ghana.updateGhana({ localDialects: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Cultural Context',
            'Include Ghanaian cultural references',
            <span className="text-2xl">🌍</span>,
            ghana.culturalContext,
            (val) => {
              ghana.updateGhana({ culturalContext: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Traditional Signs',
            'Include traditional Ghanaian signs',
            <span className="text-2xl">🤝</span>,
            ghana.traditionalSigns,
            (val) => {
              ghana.updateGhana({ traditionalSigns: val })
              setHasChanges(true)
            }
          )}

          {renderToggle(
            'Educational Mode',
            'Show learning aids and explanations',
            <span className="text-2xl">📚</span>,
            ghana.educationalMode,
            (val) => {
              ghana.updateGhana({ educationalMode: val })
              setHasChanges(true)
            }
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen relative overflow-hidden p-4 md:p-8 transition-colors duration-500 ${accessibilitySettings.highContrast
      ? 'bg-black'
      : 'bg-slate-50 dark:bg-[#050505]'
      }`}>
      {/* Background Orbs */}
      {!accessibilitySettings.highContrast && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </>
      )}

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-8 animate-fade-in">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center space-x-3 text-slate-400 hover:text-slate-900 dark:text-white transition-all mb-6 group bg-white/5 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-md w-fit"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Go Back</span>
            </button>
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[1rem] sm:rounded-[1.5rem] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-glass backdrop-blur-xl">
                <SettingsIcon className={`text-blue-400 ${accessibilitySettings.largeText ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-6 h-6 sm:w-8 sm:h-8'}`} />
              </div>
              <h1 className={`font-bold text-slate-900 dark:text-white ${accessibilitySettings.largeText ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'}`}>
                Settings
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="flex items-center space-x-3 px-8 py-4 rounded-2xl glass-card text-slate-400 hover:text-white transition-all duration-300 hover:bg-white/10"
            >
              <RotateCcw className="w-5 h-5" />
              <span className={`font-bold ${accessibilitySettings.largeText ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>Reset All</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-16 animate-slide-up">
          {tabs.map(renderTabButton)}
        </div>

        <div className={`glass-card p-6 sm:p-10 md:p-16 mb-16 min-h-[500px] relative overflow-hidden ${accessibilitySettings.highContrast ? 'bg-black border-4 border-yellow-400' : ''}`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] -mr-32 -mt-32 rounded-full" />
          <div className="relative z-10">
            {activeTab === 'accessibility' && renderAccessibilityTab()}
            {activeTab === 'translation' && renderTranslationTab()}
            {activeTab === 'audio' && renderAudioTab()}
            {activeTab === 'visual' && renderVisualTab()}
            {activeTab === 'ghana' && renderGhanaTab()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
