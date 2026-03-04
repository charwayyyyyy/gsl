import React from 'react'
import { Hand, Mic, Settings, HelpCircle, Accessibility, Book, Keyboard } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

interface DirectionSelectionProps {
  onDirectionSelect: (direction: 'sign_to_speech' | 'speech_to_sign' | 'text_to_sign') => void
}

const DirectionSelection: React.FC<DirectionSelectionProps> = ({ onDirectionSelect }) => {
  const { showAccessibilityPanel, toggleAccessibilityPanel } = useAppStore()
  const { accessibility } = useAppStore(state => state.settings)
  
  const textSizeClass = accessibility.largeText ? 'text-xl sm:text-3xl' : 'text-lg sm:text-2xl'
  const buttonSizeClass = accessibility.largeText ? 'w-full min-h-[14rem] sm:h-72 lg:h-80' : 'w-full min-h-[12rem] sm:h-64'
  
  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Background Orbs for iOS feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 blur-[120px] rounded-full animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 blur-[120px] rounded-full animate-pulse-slow" />
      
      {/* Header */}
      <div className="text-center mb-16 relative z-10 animate-fade-in">
        <h1 className={`${accessibility.largeText ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'} font-bold tracking-tight text-white mb-6`}>
          (Preservation of Ghanaian Sign Language)
        </h1>
        <p className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} text-slate-300 max-w-2xl mx-auto leading-relaxed`}>
          Empowering communication through real-time bidirectional translation.
        </p>
      </div>

      {/* Main Direction Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-16 w-full max-w-6xl relative z-10">
        {/* Sign to Speech */}
        <button
          onClick={() => onDirectionSelect('sign_to_speech')}
          className={`
            ${buttonSizeClass} group glass-card relative flex flex-col items-center justify-center p-8 text-center
            border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)]
            hover:-translate-y-2 transition-all duration-500
            ${accessibility.highContrast ? 'bg-black border-4 border-yellow-400' : ''}
          `}
          aria-label="Sign Language to Speech - I am Deaf/Hard of Hearing"
        >
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${accessibility.highContrast ? 'bg-white' : 'bg-blue-100 dark:bg-blue-900/30 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40'}`}>
            <Hand className={`${accessibility.largeText ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-8 h-8 sm:w-12 sm:h-12'} ${accessibility.highContrast ? 'text-blue-700' : 'text-blue-600 dark:text-blue-400 group-hover:text-amber-600 dark:group-hover:text-amber-400'}`} />
          </div>
          <div className="text-center">
            <h2 className={`${textSizeClass} font-bold mb-3 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
              Sign → Speech
            </h2>
            <p className={`${accessibility.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
              I am Deaf/Hard of Hearing
            </p>
          </div>
        </button>

        {/* Speech to Sign */}
        <button
          onClick={() => onDirectionSelect('speech_to_sign')}
          className={`
            ${buttonSizeClass} group glass-card relative flex flex-col items-center justify-center p-8 text-center
            border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)]
            hover:-translate-y-2 transition-all duration-500
            ${accessibility.highContrast ? 'bg-black border-4 border-yellow-400' : ''}
          `}
          aria-label="Speech to Sign Language - I am Hearing"
        >
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 group-hover:scale-110 group-hover:rotate-[-3deg] ${accessibility.highContrast ? 'bg-white' : 'bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40'}`}>
            <Mic className={`${accessibility.largeText ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-8 h-8 sm:w-12 sm:h-12'} ${accessibility.highContrast ? 'text-emerald-700' : 'text-emerald-600 dark:text-emerald-400 group-hover:text-amber-600 dark:group-hover:text-amber-400'}`} />
          </div>
          <div className="text-center">
            <h2 className={`${textSizeClass} font-bold mb-3 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
              Speech → Sign
            </h2>
            <p className={`${accessibility.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
              I am Hearing
            </p>
          </div>
        </button>
        {/* Text to Sign */}
        <button
          onClick={() => onDirectionSelect('text_to_sign')}
          className={`
            ${buttonSizeClass} group glass-card relative flex flex-col items-center justify-center p-8 text-center
            border-amber-500/30 hover:border-amber-400/80 hover:shadow-[0_0_40px_rgba(251,191,36,0.2)]
            hover:-translate-y-2 transition-all duration-500
            ${accessibility.highContrast ? 'bg-black border-4 border-yellow-400' : ''}
          `}
          aria-label="Text to Sign Language - Type to Translate"
        >
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${accessibility.highContrast ? 'bg-white' : 'bg-purple-100 dark:bg-purple-900/30 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40'}`}>
            <Keyboard className={`${accessibility.largeText ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-8 h-8 sm:w-12 sm:h-12'} ${accessibility.highContrast ? 'text-purple-700' : 'text-purple-600 dark:text-purple-400 group-hover:text-amber-600 dark:group-hover:text-amber-400'}`} />
          </div>
          <div className="text-center">
            <h2 className={`${textSizeClass} font-bold mb-3 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
              Text → Sign
            </h2>
            <p className={`${accessibility.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
              Type to Translate
            </p>
          </div>
        </button>
      </div>

      {/* Quick Actions Bar */}
      <div className="glass p-2 sm:p-3 rounded-[2rem] sm:rounded-[2.5rem] flex flex-wrap gap-2 justify-center mb-16 relative z-10 max-w-4xl mx-auto w-full">
        <button
          onClick={() => window.location.href = '/dictionary'}
          className="ios-button-secondary flex items-center gap-2 sm:gap-3 !px-4 sm:!px-8 !py-3 sm:!py-4 text-sm sm:text-base flex-1 sm:flex-none justify-center min-w-[140px]"
        >
          <Book className="w-4 sm:w-5 h-4 sm:h-5 text-blue-500" />
          <span className="font-semibold">Dictionary</span>
        </button>
        
        <button
          onClick={toggleAccessibilityPanel}
          className="ios-button-secondary flex items-center gap-2 sm:gap-3 !px-4 sm:!px-8 !py-3 sm:!py-4 text-sm sm:text-base flex-1 sm:flex-none justify-center min-w-[140px]"
        >
          <Accessibility className="w-4 sm:w-5 h-4 sm:h-5 text-purple-500" />
          <span className="font-semibold">Accessibility</span>
        </button>

        <button
          onClick={() => window.location.href = '/settings'}
          className="ios-button-secondary flex items-center gap-2 sm:gap-3 !px-4 sm:!px-8 !py-3 sm:!py-4 text-sm sm:text-base flex-1 sm:flex-none justify-center min-w-[140px]"
        >
          <Settings className="w-4 sm:w-5 h-4 sm:h-5 text-slate-500" />
          <span className="font-semibold">Settings</span>
        </button>

        <button
          onClick={() => window.location.href = '/help'}
          className="ios-button-secondary flex items-center gap-2 sm:gap-3 !px-4 sm:!px-8 !py-3 sm:!py-4 text-sm sm:text-base flex-1 sm:flex-none justify-center min-w-[140px]"
        >
          <HelpCircle className="w-4 sm:w-5 h-4 sm:h-5 text-orange-500" />
          <span className="font-semibold">Help</span>
        </button>
      </div>

      {/* Accessibility Panel */}
      {showAccessibilityPanel && (
        <div className="dark fixed inset-0 bg-slate-900/20 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className={`
            glass rounded-[2.5rem] p-6 sm:p-10 max-w-md w-full shadow-2xl mx-4
            ${accessibility.highContrast ? 'bg-black border-4 border-yellow-400' : ''}
          `}>
            <h3 className={`${textSizeClass} font-bold mb-8 text-slate-900 dark:text-white`}>
              Accessibility Options
            </h3>
            
            <div className="space-y-4">
              {[
                { label: 'High Contrast Mode', key: 'highContrast' },
                { label: 'Large Text', key: 'largeText' },
                { label: 'Dyslexia Font', key: 'dyslexiaFriendlyFont' }
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                  <span className={`font-medium text-slate-700 dark:text-slate-200 ${accessibility.largeText ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={accessibility[item.key as keyof typeof accessibility] as boolean}
                    onChange={(e) => useAppStore.getState().updateSettings({
                      accessibility: { ...accessibility, [item.key]: e.target.checked }
                    })}
                    className="w-6 h-6 rounded-full text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600"
                  />
                </label>
              ))}
            </div>

            <button
              onClick={toggleAccessibilityPanel}
              className="w-full mt-10 ios-button-primary"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center relative z-10 animate-fade-in opacity-70 hover:opacity-100 transition-opacity">
        <p className="text-slate-600 dark:text-slate-400 font-medium mb-1">
          🇬🇭 Ghanaian Sign Language Interpreter
        </p>
        <p className="text-xs tracking-widest uppercase text-slate-400">
          Powered by AI • Designed for Inclusion
        </p>
      </div>
    </div>
  )
}

export default DirectionSelection
