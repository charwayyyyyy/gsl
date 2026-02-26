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
      color: 'blue',
      gradient: 'from-blue-500/20 to-indigo-500/20'
    },
    { 
      title: 'Accessible', 
      desc: 'Inclusive design with high contrast and font size options.', 
      icon: Accessibility, 
      color: 'indigo',
      gradient: 'from-indigo-500/20 to-purple-500/20'
    },
    { 
      title: 'Reliable', 
      desc: 'Built on authentic GSL datasets for maximum accuracy.', 
      icon: Shield, 
      color: 'purple',
      gradient: 'from-purple-500/20 to-pink-500/20'
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full animate-slide-up mb-20">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="glass-card group p-10 flex flex-col items-center text-center hover:shadow-glass-hover transition-all duration-700 hover:-translate-y-3 relative overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
              
              <div className={`relative z-10 w-20 h-20 mb-8 rounded-[2rem] bg-${feature.color}-500/10 flex items-center justify-center border border-${feature.color}-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-glass`}>
                <feature.icon className={`w-10 h-10 text-${feature.color}-400`} />
              </div>
              
              <h3 className={`relative z-10 font-bold text-slate-900 dark:text-white mb-4 ${accessibility.largeText ? 'text-3xl' : 'text-2xl'}`}>
                {feature.title}
              </h3>
              
              <p className={`relative z-10 text-slate-700 dark:text-slate-200 leading-relaxed mb-0 ${accessibility.largeText ? 'text-xl' : 'text-base'}`}>
                {feature.desc}
              </p>

              <div className="mt-8 pt-8 border-t border-slate-200 dark:border-white/10 w-full relative z-10">
                <span className="text-xs font-bold tracking-[0.2em] text-blue-600 dark:text-blue-400 uppercase group-hover:text-blue-500 dark:group-hover:text-blue-300 transition-colors">
                  Enterprise Grade
                </span>
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
