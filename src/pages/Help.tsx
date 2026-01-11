import React, { useState } from 'react';
import { HelpCircle, Video, Mic, Settings, AlertTriangle, BookOpen, Users, Eye, Ear } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

const Help: React.FC = () => {
  const [activeTab, setActiveTab] = useState('getting-started');
  const { accessibility, setAccessibility } = useAppStore();

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
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className={`font-bold text-${accessibility.largeText ? '3xl' : '2xl'} mb-4`}>
                Getting Started with GSL Interpreter
              </h2>
              <p className={`text-${accessibility.largeText ? 'lg' : 'base'} opacity-80`}>
                Follow these simple steps to start communicating with the Ghana Sign Language interpreter
              </p>
            </div>
            <div className="grid gap-6">
              {getStartedSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-white bg-opacity-5 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-2xl">
                    {step.visual}
                  </div>
                  <div>
                    <h3 className={`font-semibold text-${accessibility.largeText ? 'lg' : 'base'} mb-2`}>
                      Step {index + 1}: {step.title}
                    </h3>
                    <p className={`text-${accessibility.largeText ? 'base' : 'sm'} opacity-70`}>
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
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className={`font-bold text-${accessibility.largeText ? '3xl' : '2xl'} mb-4`}>
                Sign Language Recognition Tips
              </h2>
              <p className={`text-${accessibility.largeText ? 'lg' : 'base'} opacity-80`}>
                Optimize your signing for better recognition accuracy
              </p>
            </div>
            <div className="grid gap-6">
              {signLanguageTips.map((tip, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-white bg-opacity-5 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-2xl">
                    {tip.visual}
                  </div>
                  <div>
                    <h3 className={`font-semibold text-${accessibility.largeText ? 'lg' : 'base'} mb-2`}>
                      {tip.title}
                    </h3>
                    <p className={`text-${accessibility.largeText ? 'base' : 'sm'} opacity-70`}>
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
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className={`font-bold text-${accessibility.largeText ? '3xl' : '2xl'} mb-4`}>
                Speech Recognition Tips
              </h2>
              <p className={`text-${accessibility.largeText ? 'lg' : 'base'} opacity-80`}>
                Improve speech recognition accuracy for better translation
              </p>
            </div>
            <div className="grid gap-6">
              {speechTips.map((tip, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-white bg-opacity-5 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-2xl">
                    {tip.visual}
                  </div>
                  <div>
                    <h3 className={`font-semibold text-${accessibility.largeText ? 'lg' : 'base'} mb-2`}>
                      {tip.title}
                    </h3>
                    <p className={`text-${accessibility.largeText ? 'base' : 'sm'} opacity-70`}>
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
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className={`font-bold text-${accessibility.largeText ? '3xl' : '2xl'} mb-4`}>
                Accessibility Features
              </h2>
              <p className={`text-${accessibility.largeText ? 'lg' : 'base'} opacity-80`}>
                Built-in features to make the system accessible to all users
              </p>
            </div>
            <div className="grid gap-6">
              {accessibilityFeatures.map((feature, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-white bg-opacity-5 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-2xl">
                    {feature.visual}
                  </div>
                  <div>
                    <h3 className={`font-semibold text-${accessibility.largeText ? 'lg' : 'base'} mb-2`}>
                      {feature.title}
                    </h3>
                    <p className={`text-${accessibility.largeText ? 'base' : 'sm'} opacity-70`}>
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
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className={`font-bold text-${accessibility.largeText ? '3xl' : '2xl'} mb-4`}>
                Troubleshooting Guide
              </h2>
              <p className={`text-${accessibility.largeText ? 'lg' : 'base'} opacity-80`}>
                Solutions to common issues you might encounter
              </p>
            </div>
            <div className="grid gap-6">
              {troubleshootingSteps.map((issue, index) => (
                <div key={index} className="p-4 bg-white bg-opacity-5 rounded-lg">
                  <h3 className={`font-semibold text-${accessibility.largeText ? 'lg' : 'base'} mb-2 text-red-400`}>
                    {issue.title}
                  </h3>
                  <p className={`text-${accessibility.largeText ? 'base' : 'sm'} opacity-70 mb-2`}>
                    {issue.description}
                  </p>
                  <p className={`text-${accessibility.largeText ? 'base' : 'sm'} text-green-400`}>
                    <strong>Solution:</strong> {issue.solution}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'settings-help':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className={`font-bold text-${accessibility.largeText ? '3xl' : '2xl'} mb-4`}>
                Settings Guide
              </h2>
              <p className={`text-${accessibility.largeText ? 'lg' : 'base'} opacity-80`}>
                Learn how to customize your translation experience
              </p>
            </div>
            <div className="grid gap-6">
              {settingsGuide.map((setting, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-white bg-opacity-5 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-2xl">
                    {setting.visual}
                  </div>
                  <div>
                    <h3 className={`font-semibold text-${accessibility.largeText ? 'lg' : 'base'} mb-2`}>
                      {setting.title}
                    </h3>
                    <p className={`text-${accessibility.largeText ? 'base' : 'sm'} opacity-70`}>
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
    <div className={`min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 ${accessibility.highContrast ? 'contrast-125' : ''}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className={`w-${accessibility.largeText ? '16' : '12'} h-${accessibility.largeText ? '16' : '12'} text-blue-400`} />
          </div>
          <h1 className={`font-bold text-${accessibility.largeText ? '4xl' : '3xl'} text-white mb-2`}>
            Help & Tutorial
          </h1>
          <p className={`text-${accessibility.largeText ? 'lg' : 'base'} text-blue-200 opacity-80`}>
            Learn how to use the Ghana Sign Language interpreter effectively
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white bg-opacity-10 text-blue-200 hover:bg-opacity-20'
                } ${accessibility.largeText ? 'text-lg' : 'text-sm'}`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-xl p-8">
          {renderContent()}
        </div>

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center space-x-2 text-blue-200">
            <Ear className="w-5 h-5" />
            <span className={accessibility.largeText ? 'text-lg' : 'text-sm'}>
              Need additional help? Contact our support team
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;