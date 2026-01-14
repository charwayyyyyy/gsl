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
    <div className="bg-red-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top">
      <AlertTriangle size={16} />
      <span>System Offline: Backend services are unreachable. Some features may not work.</span>
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
