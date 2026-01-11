import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Help from "@/pages/Help";
import Interpreter from "@/pages/Interpreter";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/interpreter" element={<Interpreter />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </Router>
  );
}
