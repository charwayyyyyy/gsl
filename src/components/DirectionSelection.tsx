import React from 'react'
import { Hand, Mic, Settings, HelpCircle, Accessibility, Book } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

interface DirectionSelectionProps {
  onDirectionSelect: (direction: 'sign_to_speech' | 'speech_to_sign') => void
}

const DirectionSelection: React.FC<DirectionSelectionProps> = ({ onDirectionSelect }) => {
  const { showAccessibilityPanel, toggleAccessibilityPanel } = useAppStore()
  const { accessibility } = useAppStore(state => state.settings)
  
  const textSizeClass = accessibility.largeText ? 'text-2xl' : 'text-xl'
  const buttonSizeClass = accessibility.largeText ? 'w-80 h-80' : 'w-64 h-64'
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-yellow-600 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className={`${textSizeClass} font-bold text-white mb-4`}>
          Ghana Sign Language Interpreter
        </h1>
        <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} text-blue-100 max-w-2xl mx-auto`}>
          Real-time bidirectional translation between Ghana Sign Language and spoken English
        </p>
      </div>

      {/* Main Direction Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
        {/* Sign to Speech */}
        <button
          onClick={() => onDirectionSelect('sign_to_speech')}
          className={`
            ${buttonSizeClass} rounded-full flex flex-col items-center justify-center
            bg-white hover:bg-blue-50 active:bg-blue-100
            border-4 border-white hover:border-blue-200
            shadow-2xl hover:shadow-3xl transform hover:scale-105 active:scale-95
            transition-all duration-300 ease-in-out
            focus:outline-none focus:ring-8 focus:ring-blue-300
            ${accessibility.highContrast ? 'bg-black border-yellow-400' : ''}
          `}
          aria-label="Sign Language to Speech - I am Deaf/Hard of Hearing"
        >
          <Hand className={`${accessibility.largeText ? 'w-24 h-24' : 'w-20 h-20'} text-blue-600 mb-6`} />
          <div className="text-center">
            <h2 className={`${textSizeClass} font-bold text-gray-800 mb-2`}>
              Sign → Speech
            </h2>
            <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} text-gray-600`}>
              I am Deaf/Hard of Hearing
            </p>
          </div>
        </button>

        {/* Speech to Sign */}
        <button
          onClick={() => onDirectionSelect('speech_to_sign')}
          className={`
            ${buttonSizeClass} rounded-full flex flex-col items-center justify-center
            bg-white hover:bg-green-50 active:bg-green-100
            border-4 border-white hover:border-green-200
            shadow-2xl hover:shadow-3xl transform hover:scale-105 active:scale-95
            transition-all duration-300 ease-in-out
            focus:outline-none focus:ring-8 focus:ring-green-300
            ${accessibility.highContrast ? 'bg-black border-yellow-400' : ''}
          `}
          aria-label="Speech to Sign Language - I am Hearing"
        >
          <Mic className={`${accessibility.largeText ? 'w-24 h-24' : 'w-20 h-20'} text-green-600 mb-6`} />
          <div className="text-center">
            <h2 className={`${textSizeClass} font-bold text-gray-800 mb-2`}>
              Speech → Sign
            </h2>
            <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} text-gray-600`}>
              I am Hearing
            </p>
          </div>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-6 justify-center mb-12">
        <button
          onClick={() => window.location.href = '/dictionary'}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-full
            bg-white hover:bg-gray-50 active:bg-gray-100
            border-2 border-white hover:border-gray-200
            shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-4 focus:ring-blue-300
            ${accessibility.highContrast ? 'bg-black border-yellow-400 text-yellow-400' : 'text-gray-700'}
          `}
          aria-label="Text to Sign Search"
        >
          <Book className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          <span className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-semibold`}>
            Text → Sign
          </span>
        </button>
        <button
          onClick={toggleAccessibilityPanel}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-full
            bg-white hover:bg-gray-50 active:bg-gray-100
            border-2 border-white hover:border-gray-200
            shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-4 focus:ring-blue-300
            ${accessibility.highContrast ? 'bg-black border-yellow-400 text-yellow-400' : 'text-gray-700'}
          `}
          aria-label="Accessibility Settings"
        >
          <Accessibility className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          <span className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-semibold`}>
            Accessibility
          </span>
        </button>

        <button
          onClick={() => window.location.href = '/settings'}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-full
            bg-white hover:bg-gray-50 active:bg-gray-100
            border-2 border-white hover:border-gray-200
            shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-4 focus:ring-blue-300
            ${accessibility.highContrast ? 'bg-black border-yellow-400 text-yellow-400' : 'text-gray-700'}
          `}
          aria-label="Settings"
        >
          <Settings className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          <span className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-semibold`}>
            Settings
          </span>
        </button>

        <button
          onClick={() => window.location.href = '/help'}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-full
            bg-white hover:bg-gray-50 active:bg-gray-100
            border-2 border-white hover:border-gray-200
            shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-4 focus:ring-blue-300
            ${accessibility.highContrast ? 'bg-black border-yellow-400 text-yellow-400' : 'text-gray-700'}
          `}
          aria-label="Help and Tutorial"
        >
          <HelpCircle className={`${accessibility.largeText ? 'w-8 h-8' : 'w-6 h-6'}`} />
          <span className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} font-semibold`}>
            Help
          </span>
        </button>
      </div>

      {/* Accessibility Panel */}
      {showAccessibilityPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`
            bg-white rounded-2xl p-8 max-w-md w-full
            ${accessibility.highContrast ? 'bg-black border-4 border-yellow-400' : ''}
          `}>
            <h3 className={`${textSizeClass} font-bold mb-6 text-gray-800 ${accessibility.highContrast ? 'text-yellow-400' : ''}`}>
              Accessibility Options
            </h3>
            
            <div className="space-y-6">
              <label className="flex items-center justify-between">
                <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-700'}`}>
                  High Contrast Mode
                </span>
                <input
                  type="checkbox"
                  checked={accessibility.highContrast}
                  onChange={(e) => useAppStore.getState().updateSettings({
                    accessibility: { ...accessibility, highContrast: e.target.checked }
                  })}
                  className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-700'}`}>
                  Large Text
                </span>
                <input
                  type="checkbox"
                  checked={accessibility.largeText}
                  onChange={(e) => useAppStore.getState().updateSettings({
                    accessibility: { ...accessibility, largeText: e.target.checked }
                  })}
                  className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-400' : 'text-gray-700'}`}>
                  Dyslexia-Friendly Font
                </span>
                <input
                  type="checkbox"
                  checked={accessibility.dyslexiaFriendlyFont}
                  onChange={(e) => useAppStore.getState().updateSettings({
                    accessibility: { ...accessibility, dyslexiaFriendlyFont: e.target.checked }
                  })}
                  className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            </div>

            <button
              onClick={toggleAccessibilityPanel}
              className={`
                w-full mt-8 py-4 rounded-full font-semibold
                bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white
                transform hover:scale-105 active:scale-95 transition-all duration-200
                focus:outline-none focus:ring-4 focus:ring-blue-300
                ${accessibility.highContrast ? 'bg-yellow-400 text-black hover:bg-yellow-500' : ''}
              `}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-blue-100">
        <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} mb-2`}>
          🇬🇭 Built for Ghana's Deaf Community
        </p>
        <p className={`${accessibility.largeText ? 'text-base' : 'text-sm'} opacity-80`}>
          Powered by AI • Designed for Accessibility
        </p>
      </div>
    </div>
  )
}

export default DirectionSelection
