import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, BookOpen } from 'lucide-react';
import { fetchAiResponse, DictionarySource } from '@/lib/aiClient';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  sources?: DictionarySource[];
}

export default function Assistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: "Hello! I'm the SignBridge Assistant. I can help you search the Ghana Sign Language (GSL) dictionary or answer questions about signs." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    "How do I sign hello?",
    "Show me signs about family",
    "Where is thank you?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetchAiResponse(userMessage);
      setMessages([...newMessages, { 
        role: 'model', 
        content: response.answer,
        sources: response.sources 
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, { role: 'model', content: "Connection issue. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    handleSend(input);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-[85px] right-4 sm:bottom-6 sm:right-6 z-[100] w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="Open AI Assistant"
      >
        <MessageCircle size={28} />
      </button>

      <div 
        className={`fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[100] w-full sm:w-[380px] h-full sm:h-[550px] sm:max-h-[85vh] bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 sm:origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">SignBridge Assistant</h3>
              <p className="text-[10px] text-blue-100 opacity-90 uppercase tracking-widest font-black">GSL Dictionary AI</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/50 dark:bg-slate-950/50 scroll-smooth">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                {msg.role === 'user' ? <UserIcon size={15} /> : <Bot size={15} />}
              </div>
              <div className={`max-w-[80%] flex flex-col gap-2`}>
                <div 
                  className={`px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm' 
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm markdown-body'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-slate-900 dark:text-white" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Display Dictionary Sources (only on AI responses) */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    {msg.sources.map((src, i) => (
                      <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm flex flex-col gap-1.5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <BookOpen size={14} className="text-blue-500" />
                            {src.gloss}
                          </span>
                          {src.page > 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full">
                              Pg {src.page}
                            </span>
                          )}
                        </div>
                        {src.english && src.english.toUpperCase() !== src.gloss.toUpperCase() && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{src.english}</span>
                        )}
                        <Link onClick={() => setIsOpen(false)} to={`/dictionary?search=${encodeURIComponent(src.gloss)}&source=assistant`} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline mt-1 self-start">
                          Open in Dictionary →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-end gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
                <Bot size={15} />
              </div>
              <div className="px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Chips when empty chat */}
        {messages.length === 1 && !isLoading && (
          <div className="px-4 pb-3 flex flex-wrap gap-2 overflow-x-auto no-scrollbar shrink-0 bg-slate-50/50 dark:bg-slate-950/50">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 dark:hover:border-blue-800 transition-all whitespace-nowrap shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={onSubmit} className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative flex items-center group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a sign..."
              disabled={isLoading}
              className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-2xl text-base sm:text-sm outline-none transition-all dark:text-white shadow-inner"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} className="ml-0.5" />}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
