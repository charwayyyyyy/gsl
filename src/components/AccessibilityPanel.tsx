import React from 'react'
import { useAccessibilitySettings } from '../stores/appStore'
import { Settings, Palette, Eye, Volume2 } from 'lucide-react'

const AccessibilityPanel: React.FC = () => {
  const { updateAccessibility, ...accessibility } = useAccessibilitySettings()

  const handleToggle = (setting: keyof typeof accessibility) => {
    if (typeof accessibility[setting] === 'boolean') {
      updateAccessibility({ [setting]: !accessibility[setting] })
    }
  }

  const handleColorBlindChange = (mode: any) => {
    updateAccessibility({ colorBlindMode: mode })
  }

  return (
    <div className="glass-card p-8 max-w-md mx-auto animate-fade-in shadow-2xl">
      <div className="flex items-center mb-8 pb-6 border-b border-white/10">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mr-4 shadow-glass border border-blue-500/20">
          <Settings className="w-6 h-6 text-blue-500" />
        </div>
        <h2 className={`font-bold text-slate-900 dark:text-white ${accessibility.largeText ? 'text-3xl' : 'text-2xl'}`}>
          Accessibility
        </h2>
      </div>

      <div className="space-y-8">
        {/* High Contrast Toggle */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mr-4 transition-colors group-hover:bg-blue-500/10">
              <Eye className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-blue-500" />
            </div>
            <div>
              <label className={`font-semibold text-slate-800 dark:text-slate-200 ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                High Contrast
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">Enhance visual clarity</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('highContrast')}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              accessibility.highContrast ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
            }`}
            aria-pressed={accessibility.highContrast}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                accessibility.highContrast ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Large Text Toggle */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mr-4 transition-colors group-hover:bg-blue-500/10">
              <span className="text-xl font-bold text-slate-600 dark:text-slate-400 group-hover:text-blue-500">A</span>
            </div>
            <div>
              <label className={`font-semibold text-slate-800 dark:text-slate-200 ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                Large Text
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">Better readability</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('largeText')}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              accessibility.largeText ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
            }`}
            aria-pressed={accessibility.largeText}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                accessibility.largeText ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Reduced Motion Toggle */}
        <div className="flex items-center justify-between group">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mr-4 transition-colors group-hover:bg-blue-500/10">
              <Volume2 className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-blue-500" />
            </div>
            <div>
              <label className={`font-semibold text-slate-800 dark:text-slate-200 ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                Reduced Motion
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">Minimize animations</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('reducedMotion')}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              accessibility.reducedMotion ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
            }`}
            aria-pressed={accessibility.reducedMotion}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                accessibility.reducedMotion ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Color Blind Mode */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mr-4">
              <Palette className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <label className={`font-semibold text-slate-800 dark:text-slate-200 ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
              Color Filter
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['none', 'protanopia', 'deuteranopia', 'tritanopia'].map((mode) => (
              <button
                key={mode}
                onClick={() => handleColorBlindChange(mode)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all duration-300 ${
                  accessibility.colorBlindMode === mode
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccessibilityPanel