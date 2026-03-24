import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, MessageSquare, Sliders, RotateCcw, Globe, Send, Image, Bot } from 'lucide-react';
import { countTokens } from '../api/openrouter';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIPromptLayoutProps {
  onSend: (msg: string) => void;
  userName?: string;
  isLoading?: boolean;
  messages?: Message[];
}

export default function AIPromptLayout({
  onSend,
  userName = "John",
  isLoading = false,
  messages = []
}: AIPromptLayoutProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const prompts = [
    { title: "Write a to-do list for a personal project or task", icon: <User className="size-5" /> },
    { title: "Generate an email to reply to a job offer", icon: <Mail className="size-5" /> },
    { title: "Summarise this article or text for me in one paragraph", icon: <MessageSquare className="size-5" /> },
    { title: "How does AI work in a technical capacity", icon: <Sliders className="size-5" /> },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2fbfe] relative">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 py-12 flex flex-col items-center"
      >
        <div className="w-full max-w-4xl space-y-12">
          {messages.length === 0 ? (
            /* Welcome Section */
            <div className="text-center space-y-2 mt-12 mb-8">
              <h1 className="text-6xl font-black tracking-tight text-[#141d1f]">
                Hi there, <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">{userName}</span>
              </h1>
              <h2 className="text-5xl font-black tracking-tight text-slate-800 opacity-90">
                What would like to know?
              </h2>
              <p className="text-slate-400 font-medium text-xl mt-4">
                Use one of the most common prompts below or use your own to begin
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
                {prompts.map((p, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSend(p.title)}
                    className="flex flex-col items-start p-6 liquid-glass text-left gap-12 transition-shadow"
                  >
                    <p className="text-sm font-semibold text-slate-700 leading-tight flex-grow">{p.title}</p>
                    <div className="text-slate-400">{p.icon}</div>
                  </motion.button>
                ))}
              </div>

              <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-lg mt-8 mx-auto transition-colors">
                <RotateCcw className="size-5" />
                Refresh Prompts
              </button>
            </div>
          ) : (
            /* Conversation Section */
            <div className="space-y-8 pb-32">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-[#5c4ce3] text-white' : 'bg-white text-slate-600 border border-slate-100'}`}>
                      {msg.role === 'user' ? <User className="size-5" /> : <Bot className="size-5" />}
                    </div>
                    <div className={`p-6 liquid-glass text-lg font-medium leading-relaxed ${msg.role === 'user' ? 'bg-[#5c4ce3]/80 text-white rounded-tr-sm' : 'text-slate-800 rounded-tl-sm'}`}>
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <ReactMarkdown 
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-black mt-4 mb-2" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-4 mb-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-3 mb-1" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-8 ml-14 shadow-sm border border-white/20">
                    <div className="uiverse-loader scale-75"></div>
                    <p className="text-[10px] font-black text-[#006d77] uppercase tracking-[0.2em] text-center mt-4">AI is thinking...</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Persistent Bottom Input */}
      <div className="absolute bottom-0 left-0 right-0 p-8 pt-0 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className="liquid-glass p-6 space-y-4 group">
            <div className="flex items-center justify-between gap-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask whatever you want...."
                className="w-full resize-none bg-transparent border-none focus:ring-0 text-xl font-semibold text-slate-800 placeholder:text-slate-300 min-h-[40px] py-1 custom-scrollbar"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={isLoading}
              />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-4 py-1.5 cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                <Globe className="size-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">All Web</span>
                <Sliders className="size-3 text-slate-400 ml-1 rotate-90" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <div className="size-6 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-black">+</div>
                  <span className="text-sm font-bold uppercase tracking-tight">Add Attachment</span>
                </button>
                <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <Image className="size-4" />
                  <span className="text-sm font-bold uppercase tracking-tight">Use Image</span>
                </button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-slate-300 text-sm font-bold tracking-tighter">
                  {countTokens(input)} tokens / {input.length} chars
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                  className="size-12 bg-[#5c4ce3] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  <Send className="size-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
