import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Home from "@/pages/Home";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { AlertTriangle } from "lucide-react";

// Lazy-load heavy pages — only downloaded when first navigated to
const Interpreter = lazy(() => import("@/pages/Interpreter"));
const Settings = lazy(() => import("@/pages/Settings"));
const Help = lazy(() => import("@/pages/Help"));
const Dictionary = lazy(() => import("@/pages/Dictionary"));

// Lightweight spinner shown while a lazy chunk downloads
const PageSkeleton = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
    <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium tracking-wide">Loading…</p>
  </div>
);

const HealthBanner = () => {
  const { isHealthy, isLoading } = useSystemHealth();
  if (isLoading || isHealthy) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] p-3 flex justify-center">
      <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2 border-red-500/20 shadow-lg shadow-red-500/10">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <AlertTriangle size={16} className="text-red-500" />
        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
          System Offline: Backend services are unreachable
        </span>
      </div>
    </div>
  );
};

import Chatbot from "@/components/Chatbot";
import Navbar from "@/components/Navbar";
import { useVisualSettings } from "@/stores/appStore";
import { useEffect } from "react";

export default function App() {
  const { colorScheme } = useVisualSettings();

  useEffect(() => {
    const root = window.document.documentElement;
    if (colorScheme === 'dark' || (colorScheme === 'default' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else if (colorScheme === 'light') {
      root.classList.remove('dark');
    } else {
      // For 'default' if not dark
      root.classList.remove('dark');
    }
  }, [colorScheme]);

  return (
    <Router>
      <Navbar />
      <HealthBanner />
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <div className="pt-0 sm:pt-16 pb-20 sm:pb-0">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/interpreter" element={<Interpreter />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
              <Route path="/dictionary" element={<Dictionary />} />
            </Routes>
          </div>
        </Suspense>
      </ErrorBoundary>
      <Chatbot />
    </Router>
  );
}
