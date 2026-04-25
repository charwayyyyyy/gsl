import { useNavigate } from 'react-router-dom'
import DirectionSelection from '@/components/DirectionSelection'
import CommunitySlider from '@/components/CommunitySlider'
import { useAppStore, useAccessibilitySettings, useVisualSettings } from '@/stores/appStore'
import { Sparkles, Shield, Accessibility, Zap, Sun, Moon, Laptop, BookOpen, Info, AlertTriangle, Cpu, Globe, Lock, CheckCircle2 } from 'lucide-react'
import { API_BASE_URL } from '@/config'
import logo from '@/assets/signbridge.png'

export default function Home() {
  const navigate = useNavigate()
  const accessibility = useAccessibilitySettings()
  const { startTranslationSession } = useAppStore.getState()
  const { colorScheme, updateVisual } = useVisualSettings()
  
  const isDark = colorScheme === 'dark' || 
                 (colorScheme === 'default' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = () => {
    if (colorScheme === 'light') updateVisual({ colorScheme: 'dark' })
    else if (colorScheme === 'dark') updateVisual({ colorScheme: 'default' })
    else updateVisual({ colorScheme: 'light' })
  }

  const handleDirectionSelect = (direction: 'sign_to_speech' | 'speech_to_sign' | 'text_to_sign') => {
    startTranslationSession(direction)
    navigate('/interpreter')
  }

  const highlights = [
    {
      title: 'Works Offline',
      desc: 'On-device processing ensures accessibility even without an internet connection.',
      icon: Globe,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Official Dictionary',
      desc: 'Every sign is mapped directly from the authoritative Ghana Sign Language Dictionary.',
      icon: BookOpen,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Privacy First',
      desc: 'No video or audio is ever uploaded to the cloud. Your data stays local.',
      icon: Lock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    }
  ]

  return (
    <div className={`min-h-screen relative overflow-hidden flex flex-col items-center p-4 md:p-8 pt-20 sm:pt-24
      bg-slate-50 dark:bg-[#050505]
      ${accessibility.highContrast ? '!bg-black' : ''}
    `}>
      {/* Background Orbs */}
      {!accessibility.highContrast && (
        <>
          <div className="perf-orb absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 dark:bg-blue-600/10 blur-[100px] rounded-full animate-pulse-slow" />
          <div className="perf-orb absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 dark:bg-indigo-600/10 blur-[100px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
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
        {colorScheme === 'default' 
          ? <Laptop className="w-4 h-4 text-slate-500" />
          : isDark
            ? <Sun className="w-4 h-4 text-amber-400" />
            : <Moon className="w-4 h-4 text-slate-700" />
        }
      </button>
      {/* Theme Toggle moved to Navbar or made less intrusive on Home */}
      <div className="fixed top-20 right-4 z-40 hidden md:block">
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-10 h-10 rounded-full flex items-center justify-center
            bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700
            hover:scale-110 transition-all duration-300 shadow-lg backdrop-blur-md"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center">
        {/* Logo Section */}
        <div className="mt-4 sm:mt-8 mb-6 animate-fade-in flex flex-col items-center">
          <div className="w-32 h-32 sm:w-48 sm:h-48 rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-black p-4 border border-white/10 hover:scale-105 transition-transform duration-500">
            <img src={logo} alt="SignBridge Ghana Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center mt-6 sm:mt-12 mb-10 sm:mb-16 animate-fade-in">
          <h1 className={`font-bold tracking-tight mb-6 leading-[1.1]
              ${accessibility.largeText ? 'text-4xl sm:text-7xl md:text-8xl' : 'text-3xl sm:text-6xl md:text-7xl'}
              ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}
            `}
          >
            SignBridge <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-gradient-x">
              Ghana
            </span>
          </h1>

          <p className={`max-w-3xl mx-auto leading-relaxed mb-10
              ${accessibility.largeText ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'}
              ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-600 dark:text-slate-400'}
            `}
          >
            A privacy-first Ghana Sign Language platform built from the official dictionary with on-device sign interpretation.
          </p>

          {/* Key Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {highlights.map((h, i) => (
              <div key={i} className={`flex flex-col items-center p-6 rounded-3xl border transition-all duration-300
                ${accessibility.highContrast ? 'border-yellow-400 bg-black' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}
              `}>
                <div className={`w-12 h-12 rounded-2xl ${h.bgColor} flex items-center justify-center mb-4`}>
                  <h.icon className={`w-6 h-6 ${h.color}`} />
                </div>
                <h3 className={`font-bold mb-2 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                  {h.title}
                </h3>
                <p className={`text-sm text-center ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
                  {h.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/dictionary')}
              className="px-8 py-4 rounded-2xl bg-blue-600 text-white font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <BookOpen className="w-5 h-5" />
              Open Dictionary
            </button>
            <button
              onClick={() => navigate('/interpreter')}
              className={`px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95
                ${accessibility.highContrast 
                  ? 'bg-yellow-400 text-black border-2 border-black' 
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800'}
              `}
            >
              <Zap className="w-5 h-5" />
              Live Interpreter
            </button>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20 animate-slide-up">
          <div className={`p-8 sm:p-10 rounded-[2.5rem] border
            ${accessibility.highContrast ? 'bg-black border-yellow-400' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}
          `}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Cpu size={24} />
              </div>
              <h2 className={`text-2xl font-black tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                How It Works
              </h2>
            </div>
            
            <div className="space-y-6">
              {[
                { step: '1', title: 'Pose Estimation', desc: 'MediaPipe identifies body and hand landmarks directly in your browser.' },
                { step: '2', title: 'Rule-Based Engine', desc: 'Our deterministic engine maps these landmarks to dictionary-defined patterns.' },
                { step: '3', title: 'Instant Verification', desc: 'Matches are verified against official GSL signs with high precision.' }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                  <div>
                    <h4 className={`font-bold mb-1 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                      {item.title}
                    </h4>
                    <p className={`text-sm ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`p-8 sm:p-10 rounded-[2.5rem] border
            ${accessibility.highContrast ? 'bg-black border-yellow-400' : 'bg-rose-500/5 border-rose-500/20'}
          `}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertTriangle size={24} />
              </div>
              <h2 className={`text-2xl font-black tracking-tight ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                Limitations
              </h2>
            </div>
            
            <div className="space-y-6">
              {[
                { title: 'Dictionary Coverage', desc: 'Currently supports a subset of the 1,700+ official dictionary signs.' },
                { title: 'Environment', desc: 'Accuracy is affected by low lighting or cluttered backgrounds.' },
                { title: 'Positioning', desc: 'Requires clear hand visibility and upper body framing for best results.' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="mt-1">
                    <CheckCircle2 size={18} className="text-rose-500" />
                  </div>
                  <div>
                    <h4 className={`font-bold mb-1 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                      {item.title}
                    </h4>
                    <p className={`text-sm ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Direction Selection */}
        <div className="w-full mb-16">
          <DirectionSelection onDirectionSelect={handleDirectionSelect} />
        </div>

        {/* Community Image Slider */}
        <CommunitySlider />

        {/* Footer */}
        <div className="w-full py-10 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">
              Built for <span className="text-slate-900 dark:text-white font-bold">Inclusion</span> across Ghana
            </p>
          </div>

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-widest uppercase">
            <span className="cursor-pointer hover:text-blue-500 transition-colors" onClick={() => navigate('/privacy')}>Privacy & Technology</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span>Rule-Based Engine</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span>Dictionary-Authoritative</span>
          </div>
        </div>
      </div>
    </div>
  )
}
