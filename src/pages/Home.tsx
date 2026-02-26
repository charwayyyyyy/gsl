import { useNavigate } from 'react-router-dom'
import DirectionSelection from '@/components/DirectionSelection'
import { useAppStore, useAccessibilitySettings } from '@/stores/appStore'
import { Sparkles, Shield, Accessibility, Zap } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const accessibility = useAccessibilitySettings()
  const { startTranslationSession } = useAppStore.getState()

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
      hoverBorder: 'hover:border-blue-400/50'
    },
    { 
      title: 'Accessible', 
      desc: 'Inclusive design with high contrast and font size options.', 
      icon: Accessibility, 
      bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
      textClass: 'text-indigo-600 dark:text-indigo-400',
      hcBgClass: 'bg-white',
      hcTextClass: 'text-indigo-700',
      hoverBorder: 'hover:border-indigo-400/50'
    },
    { 
      title: 'Reliable', 
      desc: 'Built on authentic GSL datasets for maximum accuracy.', 
      icon: Shield, 
      bgClass: 'bg-purple-100 dark:bg-purple-900/30',
      textClass: 'text-purple-600 dark:text-purple-400',
      hcBgClass: 'bg-white',
      hcTextClass: 'text-purple-700',
      hoverBorder: 'hover:border-purple-400/50'
    }
  ]

  return (
    <div className={`min-h-screen relative overflow-hidden flex flex-col items-center p-4 md:p-8 ${
      accessibility.highContrast ? 'bg-black' : 'bg-[#050505]'
    }`}>
      {/* Background Orbs */}
      {!accessibility.highContrast && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-600/5 blur-[100px] rounded-full animate-pulse-slow" style={{ animationDelay: '4s' }} />
        </>
      )}

      <div className="w-full max-w-7xl relative z-10 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center mt-12 mb-20 animate-fade-in">
          <div className="inline-flex items-center space-x-2 px-4 py-2 mb-8 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-xl shadow-inner">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 text-sm font-semibold tracking-wider uppercase">Next Gen Translation</span>
          </div>
          
          <h1 className={`font-bold tracking-tight text-white mb-8 leading-[1.1] ${
            accessibility.largeText ? 'text-7xl md:text-8xl' : 'text-6xl md:text-7xl'
          }`}>
            Ghana Sign Language <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-gradient-x">
              Interpreter
            </span>
          </h1>
          
          <p className={`max-w-3xl mx-auto text-slate-400 leading-relaxed mb-12 ${
            accessibility.largeText ? 'text-2xl' : 'text-xl'
          }`}>
            Breaking barriers with real-time sign language translation. 
            Experience the future of inclusive communication powered by advanced AI.
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
          </div>
        </div>

        {/* Direction Selection Section */}
        <div className="w-full mb-24">
          <DirectionSelection onDirectionSelect={handleDirectionSelect} />
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-20 w-full relative z-10 animate-slide-up">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className={`
                glass-card flex flex-col items-center justify-center p-8 text-center
                ${feature.hoverBorder} group transition-all duration-500 hover:-translate-y-2
                ${accessibility.highContrast ? 'bg-black border-4 border-yellow-400' : ''}
              `}
            >
              <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${accessibility.highContrast ? feature.hcBgClass : feature.bgClass}`}>
                <feature.icon className={`${accessibility.largeText ? 'w-14 h-14' : 'w-12 h-12'} ${accessibility.highContrast ? feature.hcTextClass : feature.textClass}`} />
              </div>
              
              <div className="text-center">
                <h3 className={`${accessibility.largeText ? 'text-2xl' : 'text-xl'} font-bold mb-3 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                  {feature.title}
                </h3>
                <p className={`${accessibility.largeText ? 'text-lg' : 'text-base'} font-medium ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA / Status */}
        <div className="w-full py-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-6">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#050505] bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-sm font-medium">
              Trusted by <span className="text-white font-bold">1,000+</span> users in Ghana
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-slate-300 text-sm font-bold tracking-widest uppercase">
            <span>Privacy Focused</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>Secure Data</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>Open Source</span>
          </div>
        </div>
      </div>
    </div>
  )
}
