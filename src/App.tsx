import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Help from "@/pages/Help";
import Interpreter from "@/pages/Interpreter";
import ErrorBoundary from "@/components/ErrorBoundary";
import Dictionary from "@/pages/Dictionary";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { AlertTriangle } from "lucide-react";

const HealthBanner = () => {
  const { isHealthy, isLoading } = useSystemHealth();
  if (isLoading || isHealthy) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] p-4 flex justify-center animate-slide-up">
      <div className="glass px-6 py-3 rounded-2xl flex items-center gap-3 border-red-500/20 shadow-lg shadow-red-500/10">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <AlertTriangle size={18} className="text-red-500" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          System Offline: Backend services are unreachable
        </span>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <HealthBanner />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/interpreter" element={<Interpreter />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
          <Route path="/dictionary" element={<Dictionary />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
