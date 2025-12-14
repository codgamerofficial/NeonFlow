import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

interface AIChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
}

const AIChat: React.FC<AIChatProps> = ({ messages, onSendMessage, isTyping }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-md border-l border-white/10">
      <div className="p-4 border-b border-white/10 flex items-center gap-2">
        <Sparkles className="text-cyan-400" size={20} />
        <h2 className="font-bold text-white tracking-wider text-sm">NEON AI DJ</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none'
                  : 'bg-white/10 text-gray-200 rounded-bl-none border border-white/5'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
             <div className="bg-white/10 rounded-2xl px-4 py-2 rounded-bl-none">
               <span className="animate-pulse text-gray-400 text-xs">DJ is thinking...</span>
             </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the DJ..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-cyan-500 rounded-full text-black hover:bg-cyan-400 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
