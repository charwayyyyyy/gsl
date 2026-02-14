import React, { useState } from 'react';
import { HelpCircle, Video, Mic, Settings, AlertTriangle, BookOpen, Users, Eye, Ear } from 'lucide-react';
import { useAccessibilitySettings } from '@/stores/appStore';

const Help: React.FC = () => {
  const [activeTab, setActiveTab] = useState('getting-started');
  const accessibility = useAccessibilitySettings();

  const tabs = [
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
    { id: 'sign-language', label: 'Sign Language Guide', icon: Users },
    { id: 'speech-recognition', label: 'Speech Recognition', icon: Mic },
    { id: 'accessibility', label: 'Accessibility Features', icon: Eye },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
    { id: 'settings-help', label: 'Settings Guide', icon: Settings }
  ];

  const getStartedSteps = [
    {
      title: 'Choose Translation Direction',
      description: 'Select whether you want to translate from Sign Language to Speech or Speech to Sign Language',
      visual: '🔄'
    },
    {
      title: 'Allow Camera Access',
      description: 'Grant permission for camera access to capture sign language gestures',
      visual: '📹'
    },
    {
      title: 'Allow Microphone Access',
      description: 'Grant permission for microphone access to capture speech',
      visual: '🎤'
    },
    {
      title: 'Start Communicating',
      description: 'Begin signing or speaking - the system will translate in real-time',
      visual: '💬'
    }
  ];

  const signLanguageTips = [
    {
      title: 'Hand Positioning',
      description: 'Keep hands clearly visible and centered in camera view',
      visual: '✋'
    },
    {
      title: 'Lighting',
      description: 'Ensure good lighting so hand shapes and movements are clearly visible',
      visual: '💡'
    },
    {
      title: 'Background',
      description: 'Use a plain background to help the system focus on your hands',
      visual: '🏠'
    },
    {
      title: 'Movement Speed',
      description: 'Sign at a natural, steady pace for best recognition',
      visual: '⚡'
    }
  ];

  const speechTips = [
    {
      title: 'Speak Clearly',
      description: 'Speak at a normal pace with clear pronunciation',
      visual: '🗣️'
    },
    {
      title: 'Reduce Background Noise',
      description: 'Minimize background noise for better speech recognition',
      visual: '🔇'
    },
    {
      title: 'Microphone Distance',
      description: 'Stay about 6-12 inches from the microphone',
      visual: '📏'
    },
    {
      title: 'Pause Between Sentences',
      description: 'Allow brief pauses between sentences for better translation',
      visual: '⏸️'
    }
  ];

  const accessibilityFeatures = [
    {
      title: 'Large Text Mode',
      description: 'Increases text size for better readability',
      visual: '🔤'
    },
    {
      title: 'High Contrast Mode',
      description: 'Enhances color contrast for better visibility',
      visual: '🌓'
    },
    {
      title: 'Dyslexia-Friendly Font',
      description: 'Uses fonts designed for dyslexic users',
      visual: '📝'
    },
    {
      title: 'Visual Indicators',
      description: 'Provides visual feedback for system status',
      visual: '💡'
    }
  ];

  const troubleshootingSteps = [
    {
      title: 'Camera Not Working',
      description: 'Check camera permissions and ensure no other app is using the camera',
      solution: 'Refresh the page and grant camera permissions again'
    },
    {
      title: 'Microphone Not Detected',
      description: 'Check microphone permissions and device settings',
      solution: 'Ensure microphone is connected and permissions are granted'
    },
    {
      title: 'Translation Delay',
      description: 'Slow internet connection or system performance issues',
      solution: 'Check internet connection and close other applications'
    },
    {
      title: 'Poor Recognition Accuracy',
      description: 'Lighting, positioning, or audio quality issues',
      solution: 'Adjust lighting, positioning, or reduce background noise'
    }
  ];

  const settingsGuide = [
    {
      title: 'Translation Settings',
      description: 'Adjust translation speed and accuracy preferences',
      visual: '⚙️'
    },
    {
      title: 'Audio Settings',
      description: 'Configure microphone sensitivity and output volume',
      visual: '🔊'
    },
    {
      title: 'Visual Settings',
      description: 'Customize display preferences and visual feedback',
      visual: '🖥️'
    },
    {
      title: 'Ghana-Specific Settings',
      description: 'Adjust settings for Ghanaian languages and dialects',
      visual: '🇬🇭'
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'getting-started':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-12">
              <h2 className={`font-bold text-white mb-4 ${accessibility.largeText ? 'text-4xl' : 'text-3xl'}`}>
                Getting Started
              </h2>
              <p className={`text-slate-400 max-w-2xl mx-auto ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                Follow these simple steps to start communicating with the GSL interpreter.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {getStartedSteps.map((step, index) => (
                <div key={index} className="glass-card group p-8 flex items-start space-x-6 hover:shadow-glass-hover transition-all duration-500 hover:-translate-y-1">
                  <div className="flex-shrink-0 w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl shadow-glass border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                    {step.visual}
                  </div>
                  <div>
                    <h3 className={`font-bold text-white mb-3 ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
                      <span className="text-blue-500 mr-2">{index + 1}.</span>
                      {step.title}
                    </h3>
                    <p className={`text-slate-400 leading-relaxed ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'sign-language':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-12">
              <h2 className={`font-bold text-white mb-4 ${accessibility.largeText ? 'text-4xl' : 'text-3xl'}`}>
                Sign Language Guide
              </h2>
              <p className={`text-slate-400 max-w-2xl mx-auto ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                Optimize your signing environment for the highest recognition accuracy.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {signLanguageTips.map((tip, index) => (
                <div key={index} className="glass-card group p-8 flex items-start space-x-6 hover:shadow-glass-hover transition-all duration-500 hover:-translate-y-1">
                  <div className="flex-shrink-0 w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-3xl shadow-glass border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                    {tip.visual}
                  </div>
                  <div>
                    <h3 className={`font-bold text-white mb-3 ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
                      {tip.title}
                    </h3>
                    <p className={`text-slate-400 leading-relaxed ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                      {tip.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'speech-recognition':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-12">
              <h2 className={`font-bold text-white mb-4 ${accessibility.largeText ? 'text-4xl' : 'text-3xl'}`}>
                Speech Recognition
              </h2>
              <p className={`text-slate-400 max-w-2xl mx-auto ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                Ensure your voice is captured clearly for accurate real-time translation.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {speechTips.map((tip, index) => (
                <div key={index} className="glass-card group p-8 flex items-start space-x-6 hover:shadow-glass-hover transition-all duration-500 hover:-translate-y-1">
                  <div className="flex-shrink-0 w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-3xl shadow-glass border border-purple-500/20 group-hover:scale-110 transition-transform duration-500">
                    {tip.visual}
                  </div>
                  <div>
                    <h3 className={`font-bold text-white mb-3 ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
                      {tip.title}
                    </h3>
                    <p className={`text-slate-400 leading-relaxed ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                      {tip.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'accessibility':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-12">
              <h2 className={`font-bold text-white mb-4 ${accessibility.largeText ? 'text-4xl' : 'text-3xl'}`}>
                Accessibility Features
              </h2>
              <p className={`text-slate-400 max-w-2xl mx-auto ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                We believe in inclusive communication for everyone.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {accessibilityFeatures.map((feature, index) => (
                <div key={index} className="glass-card group p-8 flex items-start space-x-6 hover:shadow-glass-hover transition-all duration-500 hover:-translate-y-1">
                  <div className="flex-shrink-0 w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-3xl shadow-glass border border-orange-500/20 group-hover:scale-110 transition-transform duration-500">
                    {feature.visual}
                  </div>
                  <div>
                    <h3 className={`font-bold text-white mb-3 ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
                      {feature.title}
                    </h3>
                    <p className={`text-slate-400 leading-relaxed ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'troubleshooting':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-12">
              <h2 className={`font-bold text-white mb-4 ${accessibility.largeText ? 'text-4xl' : 'text-3xl'}`}>
                Troubleshooting
              </h2>
              <p className={`text-slate-400 max-w-2xl mx-auto ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                Quick fixes for common technical issues.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {troubleshootingSteps.map((issue, index) => (
                <div key={index} className="glass-card group p-8 hover:shadow-glass-hover transition-all duration-500 hover:-translate-y-1 border-l-4 border-l-rose-500/30">
                  <h3 className={`font-bold text-rose-400 mb-4 flex items-center gap-3 ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
                    <AlertTriangle className="w-6 h-6" />
                    {issue.title}
                  </h3>
                  <p className={`text-slate-400 mb-6 leading-relaxed ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                    {issue.description}
                  </p>
                  <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/10 group-hover:bg-emerald-500/10 transition-colors">
                    <p className={`text-emerald-400 ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                      <span className="font-bold mr-2 uppercase text-xs tracking-widest opacity-70">Solution:</span>
                      <br />
                      {issue.solution}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'settings-help':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-12">
              <h2 className={`font-bold text-white mb-4 ${accessibility.largeText ? 'text-4xl' : 'text-3xl'}`}>
                Settings Guide
              </h2>
              <p className={`text-slate-400 max-w-2xl mx-auto ${accessibility.largeText ? 'text-xl' : 'text-lg'}`}>
                Tailor your experience with powerful customization options.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {settingsGuide.map((setting, index) => (
                <div key={index} className="glass-card group p-8 flex items-start space-x-6 hover:shadow-glass-hover transition-all duration-500 hover:-translate-y-1">
                  <div className="flex-shrink-0 w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-3xl shadow-glass border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                    {setting.visual}
                  </div>
                  <div>
                    <h3 className={`font-bold text-white mb-3 ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
                      {setting.title}
                    </h3>
                    <p className={`text-slate-400 leading-relaxed ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                      {setting.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden p-4 md:p-8 ${
      accessibility.highContrast ? 'bg-black' : 'bg-[#050505]'
    }`}>
      {/* Background Orbs */}
      {!accessibility.highContrast && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-600/5 blur-[100px] rounded-full animate-pulse-slow" style={{ animationDelay: '4s' }} />
        </>
      )}

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="mb-16 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-blue-500/10 border border-blue-500/20 mb-8 shadow-glass-hover backdrop-blur-xl relative group">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full group-hover:bg-blue-500/30 transition-all duration-500 opacity-50" />
            <HelpCircle className={`text-blue-400 relative z-10 ${accessibility.largeText ? 'w-14 h-14' : 'w-12 h-12'}`} />
          </div>
          <h1 className={`font-bold text-white mb-6 leading-tight ${accessibility.largeText ? 'text-6xl' : 'text-5xl'}`}>
            Help & <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Tutorial</span>
          </h1>
          <p className={`max-w-2xl mx-auto text-slate-400 leading-relaxed ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
            Master the art of sign language translation with our comprehensive guide and resources.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-16 animate-slide-up">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-3 px-8 py-4 rounded-2xl transition-all duration-500
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] scale-105 z-10' 
                    : 'glass-card text-slate-400 hover:text-white hover:scale-105 hover:bg-white/10'
                  }
                  ${accessibility.largeText ? 'text-2xl' : 'text-lg font-medium'}
                  backdrop-blur-xl
                `}
              >
                <Icon className={accessibility.largeText ? 'w-7 h-7' : 'w-6 h-6'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="glass-card p-10 md:p-16 mb-16 min-h-[500px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] -mr-32 -mt-32 rounded-full" />
          <div className="relative z-10">
            {renderContent()}
          </div>
        </div>

        <div className="text-center animate-fade-in pb-12">
          <button className="glass-card group px-10 py-5 inline-flex items-center space-x-4 hover:shadow-glass-hover hover:bg-white/10 transition-all duration-500 hover:-translate-y-1">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors shadow-inner">
              <Ear className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-left">
              <span className={`block text-white font-bold ${accessibility.largeText ? 'text-2xl' : 'text-xl'}`}>
                Still need help?
              </span>
              <span className={`text-slate-400 group-hover:text-blue-300 transition-colors ${accessibility.largeText ? 'text-lg' : 'text-base'}`}>
                Contact our support team anytime
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Help;