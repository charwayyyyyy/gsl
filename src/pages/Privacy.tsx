import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, Eye, Book, Cpu, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAccessibilitySettings } from '@/stores/appStore'

const Privacy: React.FC = () => {
  const navigate = useNavigate()
  const accessibility = useAccessibilitySettings()

  const sections = [
    {
      title: 'Local Processing',
      desc: 'All sign recognition and pose estimation happens directly in your browser using MediaPipe. No video data is ever sent to our servers.',
      icon: Cpu,
      color: 'text-blue-500'
    },
    {
      title: 'Privacy by Design',
      desc: 'We do not store your camera feed or audio recordings. The system analyzes landmarks in real-time and discards the frames immediately.',
      icon: Shield,
      color: 'text-emerald-500'
    },
    {
      title: 'Rule-Based Engine',
      desc: 'Unlike "black-box" AI, our system uses a deterministic rule-based matching engine built from the official Ghana Sign Language Dictionary.',
      icon: Book,
      color: 'text-indigo-500'
    },
    {
      title: 'Zero Tracking',
      desc: 'We do not use invasive tracking cookies or third-party analytics that could compromise your identity.',
      icon: Lock,
      color: 'text-purple-500'
    }
  ]

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-[#050505] p-6 sm:p-12 pt-20 sm:pt-24 ${accessibility.highContrast ? '!bg-black' : ''}`}>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-500 transition-colors mb-12 font-bold uppercase tracking-widest text-xs"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mb-16">
          <h1 className={`text-4xl sm:text-6xl font-black mb-6 tracking-tighter ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
            Privacy & <br />
            <span className="text-blue-500">Technology</span>
          </h1>
          <p className={`text-lg sm:text-xl leading-relaxed max-w-2xl ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-600 dark:text-slate-400'}`}>
            SignBridge Ghana is built on the principle of absolute privacy. We believe accessibility should not come at the cost of your personal data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {sections.map((s, i) => (
            <div key={i} className={`p-8 rounded-[2rem] border transition-all duration-500 ${accessibility.highContrast ? 'border-yellow-400 bg-black' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:shadow-xl'}`}>
              <div className={`w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 ${s.color}`}>
                <s.icon size={24} />
              </div>
              <h3 className={`text-xl font-bold mb-4 ${accessibility.highContrast ? 'text-yellow-400' : 'text-slate-900 dark:text-white'}`}>
                {s.title}
              </h3>
              <p className={`leading-relaxed ${accessibility.highContrast ? 'text-yellow-200' : 'text-slate-500 dark:text-slate-400'}`}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <div className={`p-10 rounded-[2.5rem] border ${accessibility.highContrast ? 'border-yellow-400 bg-black' : 'bg-blue-600 text-white border-transparent shadow-2xl shadow-blue-500/20'}`}>
          <div className="flex items-center gap-4 mb-6">
            <CheckCircle2 size={32} />
            <h2 className="text-2xl font-black tracking-tight uppercase">Authoritative System</h2>
          </div>
          <p className="text-lg leading-relaxed opacity-90 mb-8">
            Every recognition pattern in our engine is meticulously mapped from the <strong>Ghana Sign Language Dictionary</strong>. This ensures that the system is not just technologically advanced, but linguistically accurate and culturally respectful.
          </p>
          <div className="flex flex-wrap gap-4">
            <span className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-widest">Official Dictionary</span>
            <span className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-widest">Rule-Based</span>
            <span className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-widest">Offline-Ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Privacy
