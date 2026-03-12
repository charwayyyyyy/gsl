import { useNavigate } from 'react-router-dom'
import DirectionSelection from '@/components/DirectionSelection'
import CommunitySlider from '@/components/CommunitySlider'
import { useAppStore, useAccessibilitySettings } from '@/stores/appStore'
import { BookOpen, Shield, Accessibility, Zap, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { API_BASE_URL } from '@/config'


export default function Home() {
  const navigate = useNavigate()
  const accessibility = useAccessibilitySettings()
  const { startTranslationSession } = useAppStore.getState()
  const { isDark, toggleTheme } = useTheme()

  const handleDirectionSelect = (direction: 'sign_to_speech' | 'speech_to_sign') => {
    startTranslationSession(direction)
    navigate('/interpreter')
  }

  const features = [
    {
      title: 'Real-time',
      desc: 'Instant translation between GSL and speech with low latency.',
      icon: Zap,
      bgClass: 'bg-blue-100 dark:bg-blue-900/30',
      textClass: 'text-blue-600 dark:text-blue-400',
      hcBgClass: 'bg-white',
      hcTextClass: 'text-blue-700',
    },
    {
      title: 'Accessible',
      desc: 'Inclusive design with high contrast and font size options.',
      icon: Accessibility,
      bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
      textClass: 'text-indigo-600 dark:text-indigo-400',
      hcBgClass: 'bg-white',
      hcTextClass: 'text-indigo-700',
    },
    {
      title: 'Reliable',
      desc: 'Built on authentic GSL datasets for maximum accuracy.',
      icon: Shield,
      bgClass: 'bg-purple-100 dark:bg-purple-900/30',
      textClass: 'text-purple-600 dark:text-purple-400',
      hcBgClass: 'bg-white',
      hcTextClass: 'text-purple-700',
    }
  ]

  return (
    // Use pure Tailwind dark: classes — background driven entirely by html.dark class
    <div className={`min-h-screen relative overflow-hidden flex flex-col items-center p-4 md:p-8
      bg-slate-50 dark:bg-[#050505]
      ${accessibility.highContrast ? '!bg-black' : ''}
    `}>

      {/* Background Orbs — hidden on mobile via .perf-orb */}
      {!accessibility.highContrast && (
        <>
          <div className="perf-orb absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 dark:bg-blue-600/10 blur-[100px] rounded-full animate-pulse-slow" />
          <div className="perf-orb absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 dark:bg-indigo-600/10 blur-[100px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="perf-orb absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-600/5 dark:bg-purple-600/5 blur-[80px] rounded-full animate-pulse-slow" style={{ animationDelay: '4s' }} />
        </>
      )}

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center
          bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700
          hover:scale-110 transition-all duration-300 shadow-lg"
      >
        {isDark
          ? <Sun className="w-4 h-4 text-amber-400" />
          : <Moon className="w-4 h-4 text-slate-700" />}
      </button>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center mt-6 sm:mt-12 mb-10 sm:mb-20 animate-fade-in">
          <h1
            style={{
              color: accessibility.highContrast ? '#facc15' : isDark ? '#ffffff' : '#0f172a'
            }}
            className={`font-bold tracking-tight mb-8 leading-[1.1]
              ${accessibility.largeText ? 'text-4xl sm:text-7xl md:text-8xl' : 'text-3xl sm:text-6xl md:text-7xl'}
            `}
          >
            SignBridge <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-gradient-x">
              Ghana
            </span>
          </h1>

          <p
            style={{ color: accessibility.highContrast ? '#fef08a' : isDark ? '#94a3b8' : '#475569' }}
            className={`max-w-3xl mx-auto leading-relaxed mb-12
              ${accessibility.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}
            `}
          >
            Bridging the gap with real-time sign language translation.
            Experience the future of inclusive communication powered by SignBridge AI.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Live Translation
            </div>
            <div className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Authentic GSL
            </div>
            <button
              onClick={() => window.open(`${API_BASE_URL}/api/dictionary-pdf`, '_blank')}
              className={`px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg
                ${accessibility.highContrast 
                  ? 'bg-yellow-400 text-black hover:bg-yellow-300' 
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}
              `}
            >
              <BookOpen className="w-5 h-5" />
              Full GSL Dictionary (PDF)
            </button>
          </div>
        </div>

        {/* Direction Selection */}
        <div className="w-full mb-16">
          <DirectionSelection onDirectionSelect={handleDirectionSelect} />
        </div>

        {/* Community Image Slider */}
        <CommunitySlider />

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-20 w-full relative z-10 animate-slide-up">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`
                group glass-card relative p-6 sm:p-8 lg:p-10 flex flex-col items-center
                hover:shadow-lg transition-all duration-300 hover:-translate-y-2
                ${accessibility.highContrast ? 'bg-black border-4 border-yellow-400' : ''}
              `}
            >
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center mb-6 sm:mb-8 transition-all duration-300 group-hover:scale-110 ${accessibility.highContrast ? feature.hcBgClass : feature.bgClass}`}>
                <feature.icon className={`${accessibility.largeText ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-8 h-8 sm:w-12 sm:h-12'} ${accessibility.highContrast ? feature.hcTextClass : feature.textClass}`} />
              </div>

              <div className="text-center">
                <h3 className={`${accessibility.largeText ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} font-bold mb-3
                  ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                  {feature.title}
                </h3>
                <p className={`${accessibility.largeText ? 'text-sm sm:text-lg' : 'text-xs sm:text-base'} font-medium
                  ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="w-full py-10 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-slate-50 dark:border-[#050505] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">
              Trusted by <span className="text-slate-900 dark:text-white font-bold">1,000+</span> users in Ghana
            </p>
          </div>

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-widest uppercase">
            <span>Privacy Focused</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span>Secure Data</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span>Open Source</span>
          </div>
        </div>
      </div>
    </div>
  )
}
