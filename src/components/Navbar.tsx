import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Book, Settings, HelpCircle } from 'lucide-react';
import logo from '@/assets/signbridge.png';

const Navbar: React.FC = () => {

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/interpreter', icon: MessageSquare, label: 'Interpreter' },
    { to: '/dictionary', icon: Book, label: 'Dictionary' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/help', icon: HelpCircle, label: 'Help' },
  ];

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-[100] sm:top-0 sm:bottom-auto glass border-t sm:border-t-0 sm:border-b border-white/20 px-4 py-2 sm:py-3 transition-all duration-300`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="hidden sm:flex items-center gap-3 group cursor-pointer" onClick={() => window.location.href = '/'}>
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-black flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300 p-1 border border-white/10">
            <img src={logo} alt="SignBridge Ghana Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-serif italic font-bold text-slate-900 dark:text-white tracking-tight text-lg">
            SignBridge Ghana
          </span>
        </div>

        <div className="flex items-center justify-around w-full sm:w-auto sm:gap-6 lg:gap-8">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-1 sm:py-2 rounded-xl transition-all duration-300
                ${isActive 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }
              `}
            >
              <item.icon size={20} className="sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-sm font-bold uppercase tracking-widest sm:tracking-normal sm:capitalize">
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
