import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HealthBanner from "@/components/HealthBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import Navbar from "@/components/Navbar";
import { useVisualSettings } from "@/stores/appStore";
import { useSystemHealth } from "@/hooks/useSystemHealth";

import Home from "@/pages/Home";
const Interpreter = lazy(() => import("@/pages/Interpreter"));
const Settings = lazy(() => import("@/pages/Settings"));
const Help = lazy(() => import("@/pages/Help"));
const Dictionary = lazy(() => import("@/pages/Dictionary"));
const Privacy = lazy(() => import("@/pages/Privacy"));

// Lightweight spinner shown while a lazy chunk downloads
const PageSkeleton = ({ status }: { status?: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-[#050505]">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
      <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
    <div className="flex flex-col items-center gap-2">
      <p className="text-slate-900 dark:text-white text-lg font-black uppercase tracking-[0.2em] animate-pulse">Initializing System</p>
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{status || 'Waking backend services...'}</p>
    </div>
  </div>
);

export default function App() {
  const { colorScheme } = useVisualSettings();
  const { status, isHealthy } = useSystemHealth();

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      const isDark = colorScheme === 'dark' || 
                    (colorScheme === 'default' && mediaQuery.matches);
      
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system changes if set to default
    if (colorScheme === 'default') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [colorScheme]);

  return (
    <Router>
      <Navbar />
      <HealthBanner />
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton status={status === 'loading' ? 'Checking connection...' : 'Preparing assets...'} />}>
          <div className="pt-0 sm:pt-16 pb-20 sm:pb-0">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/interpreter" element={<Interpreter />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/privacy" element={<Privacy />} />
            </Routes>
          </div>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
}
