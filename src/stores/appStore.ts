import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AccessibilitySettings {
  highContrast: boolean
  largeText: boolean
  dyslexiaFriendlyFont: boolean
  reducedMotion: boolean
  focusIndicators: boolean
}

export interface TranslationSettings {
  signSpeed: number // 0.5x to 2.0x
  speechSpeed: number // 0.5x to 2.0x
  avatarMode: '3d_avatar' | 'video_clips'
  facialExpressions: boolean
  gestureSmoothing: boolean
}

export interface AudioSettings {
  volumeLevel: number // 0.0 to 1.0
  audioFeedback: boolean
  ghanaianAccent: boolean
  backgroundNoiseReduction: boolean
}

export interface VisualSettings {
  showConfidence: boolean
  showLandmarks: boolean
  animationQuality: 'low' | 'medium' | 'high'
  colorScheme: 'default' | 'high_contrast' | 'dark' | 'light'
  signingSpaceOverlay: boolean
}

export interface GhanaSpecificSettings {
  localDialects: boolean
  culturalContext: boolean
  traditionalSigns: boolean
  educationalMode: boolean
}

export interface AppSettings {
  accessibility: AccessibilitySettings
  translation: TranslationSettings
  audio: AudioSettings
  visual: VisualSettings
  ghana: GhanaSpecificSettings
}

export interface TranslationSession {
  id: string
  direction: 'sign_to_speech' | 'speech_to_sign'
  startTime: number
  endTime?: number
  avgConfidence?: number
  totalEvents: number
}

export interface AppState {
  // Settings
  settings: AppSettings
  
  // Translation state
  currentSession: TranslationSession | null
  isTranslating: boolean
  lastTranslation: {
    input: string
    output: string
    confidence: number
    timestamp: number
  } | null
  
  // Connection state
  isConnected: boolean
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
  
  // UI state
  currentPage: 'home' | 'interpreter' | 'settings' | 'help'
  showAccessibilityPanel: boolean
  
  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void
  startTranslationSession: (direction: 'sign_to_speech' | 'speech_to_sign') => void
  endTranslationSession: () => void
  setTranslating: (isTranslating: boolean) => void
  setLastTranslation: (translation: AppState['lastTranslation']) => void
  setConnectionStatus: (status: AppState['connectionStatus']) => void
  setCurrentPage: (page: AppState['currentPage']) => void
  toggleAccessibilityPanel: () => void
  resetSettings: () => void
}

const defaultSettings: AppSettings = {
  accessibility: {
    highContrast: false,
    largeText: true, // Default to large text for accessibility
    dyslexiaFriendlyFont: false,
    reducedMotion: false,
    focusIndicators: true
  },
  translation: {
    signSpeed: 1.0,
    speechSpeed: 1.0,
    avatarMode: '3d_avatar',
    facialExpressions: true,
    gestureSmoothing: true
  },
  audio: {
    volumeLevel: 0.8,
    audioFeedback: true,
    ghanaianAccent: true, // Default to Ghanaian accent
    backgroundNoiseReduction: true
  },
  visual: {
    showConfidence: true,
    showLandmarks: true,
    animationQuality: 'high',
    colorScheme: 'default',
    signingSpaceOverlay: true
  },
  ghana: {
    localDialects: true,
    culturalContext: true,
    traditionalSigns: true,
    educationalMode: false
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      currentSession: null,
      isTranslating: false,
      lastTranslation: null,
      isConnected: false,
      connectionStatus: 'disconnected',
      currentPage: 'home',
      showAccessibilityPanel: false,

      // Actions
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
            accessibility: {
              ...state.settings.accessibility,
              ...(newSettings.accessibility || {})
            },
            translation: {
              ...state.settings.translation,
              ...(newSettings.translation || {})
            },
            audio: {
              ...state.settings.audio,
              ...(newSettings.audio || {})
            },
            visual: {
              ...state.settings.visual,
              ...(newSettings.visual || {})
            },
            ghana: {
              ...state.settings.ghana,
              ...(newSettings.ghana || {})
            }
          }
        }))
      },

      startTranslationSession: (direction) => {
        const session: TranslationSession = {
          id: `session_${Date.now()}`,
          direction,
          startTime: Date.now(),
          totalEvents: 0
        }
        set({ currentSession: session, isTranslating: true })
      },

      endTranslationSession: () => {
        const session = get().currentSession
        if (session) {
          const updatedSession: TranslationSession = {
            ...session,
            endTime: Date.now()
          }
          set({ currentSession: updatedSession, isTranslating: false })
        }
      },

      setTranslating: (isTranslating) => {
        set({ isTranslating })
      },

      setLastTranslation: (translation) => {
        set({ lastTranslation: translation })
      },

      setConnectionStatus: (status) => {
        set({ 
          connectionStatus: status,
          isConnected: status === 'connected'
        })
      },

      setCurrentPage: (page) => {
        set({ currentPage: page })
      },

      toggleAccessibilityPanel: () => {
        set((state) => ({ showAccessibilityPanel: !state.showAccessibilityPanel }))
      },

      resetSettings: () => {
        set({ settings: defaultSettings })
      }
    }),
    {
      name: 'gsl-interpreter-settings',
      partialize: (state) => ({
        settings: state.settings,
        currentPage: state.currentPage
      })
    }
  )
)

// Helper hooks for specific settings
export const useAccessibilitySettings = () => {
  const settings = useAppStore((state) => state.settings.accessibility)
  const updateSettings = useAppStore((state) => state.updateSettings)
  
  return {
    ...settings,
    updateAccessibility: (accessibility: Partial<AccessibilitySettings>) => {
      updateSettings({ accessibility })
    }
  }
}

export const useTranslationSettings = () => {
  const settings = useAppStore((state) => state.settings.translation)
  const updateSettings = useAppStore((state) => state.updateSettings)
  
  return {
    ...settings,
    updateTranslation: (translation: Partial<TranslationSettings>) => {
      updateSettings({ translation })
    }
  }
}

export const useAudioSettings = () => {
  const settings = useAppStore((state) => state.settings.audio)
  const updateSettings = useAppStore((state) => state.updateSettings)
  
  return {
    ...settings,
    updateAudio: (audio: Partial<AudioSettings>) => {
      updateSettings({ audio })
    }
  }
}

export const useVisualSettings = () => {
  const settings = useAppStore((state) => state.settings.visual)
  const updateSettings = useAppStore((state) => state.updateSettings)
  
  return {
    ...settings,
    updateVisual: (visual: Partial<VisualSettings>) => {
      updateSettings({ visual })
    }
  }
}

export const useGhanaSettings = () => {
  const settings = useAppStore((state) => state.settings.ghana)
  const updateSettings = useAppStore((state) => state.updateSettings)
  
  return {
    ...settings,
    updateGhana: (ghana: Partial<GhanaSpecificSettings>) => {
      updateSettings({ ghana })
    }
  }
}