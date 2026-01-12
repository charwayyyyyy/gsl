import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Help from "@/pages/Help";
import Interpreter from "@/pages/Interpreter";
import ErrorBoundary from "@/components/ErrorBoundary";
import Dictionary from "@/pages/Dictionary";

export default function App() {
  return (
    <Router>
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
