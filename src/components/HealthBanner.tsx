import React from 'react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { AlertTriangle } from 'lucide-react';

const HealthBanner: React.FC = () => {
  const { isHealthy, status } = useSystemHealth();
  
  if (status === 'loading' || isHealthy) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] p-3 flex justify-center pointer-events-none">
      <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2 border-red-500/20 shadow-lg shadow-red-500/10 pointer-events-auto">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <AlertTriangle size={16} className="text-red-500" />
        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
          System Offline: Backend services are unreachable
        </span>
      </div>
    </div>
  );
};

export default HealthBanner;
