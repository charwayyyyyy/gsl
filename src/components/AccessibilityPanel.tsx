import React from 'react'
import { useAppStore } from '../stores/appStore'
import { Settings, Palette, Eye, Volume2 } from 'lucide-react'

const AccessibilityPanel: React.FC = () => {
  const { accessibility, updateAccessibility } = useAppStore()

  const handleToggle = (setting: keyof typeof accessibility) => {
    updateAccessibility({ [setting]: !accessibility[setting] })
  }

  const handleColorBlindChange = (mode: typeof accessibility.colorBlindMode) => {
    updateAccessibility({ colorBlindMode: mode })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center mb-6">
        <Settings className="w-6 h-6 text-blue-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-800">Accessibility Settings</h2>
      </div>

      <div className="space-y-6">
        {/* High Contrast Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Eye className="w-5 h-5 text-gray-600 mr-3" />
            <div>
              <label className="text-lg font-medium text-gray-700">High Contrast</label>
              <p className="text-sm text-gray-500">Increase color contrast for better visibility</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('highContrast')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              accessibility.highContrast ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            aria-pressed={accessibility.highContrast}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                accessibility.highContrast ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Large Text Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="w-5 h-5 text-gray-600 mr-3 text-xl font-bold">A</span>
            <div>
              <label className="text-lg font-medium text-gray-700">Large Text</label>
              <p className="text-sm text-gray-500">Increase text size for better readability</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('largeText')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              accessibility.largeText ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            aria-pressed={accessibility.largeText}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                accessibility.largeText ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Reduced Motion Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Volume2 className="w-5 h-5 text-gray-600 mr-3" />
            <div>
              <label className="text-lg font-medium text-gray-700">Reduced Motion</label>
              <p className="text-sm text-gray-500">Minimize animations and transitions</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle('reducedMotion')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              accessibility.reducedMotion ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            aria-pressed={accessibility.reducedMotion}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                accessibility.reducedMotion ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Color Blind Mode */}
        <div className="space-y-3">
          <div className="flex items-center">
            <Palette className="w-5 h-5 text-gray-600 mr-3" />
            <label className="text-lg font-medium text-gray-700">Color Blind Mode</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'none', label: 'None' },
              { value: 'protanopia', label: 'Red-Blind' },
              { value: 'deuteranopia', label: 'Green-Blind' },
              { value: 'tritanopia', label: 'Blue-Blind' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleColorBlindChange(option.value as any)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  accessibility.colorBlindMode === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccessibilityPanel