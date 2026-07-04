import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Transaction, InvestmentAccount, MarketPrice } from '../types';

interface Props {
  transactions: Transaction[];
  investments: InvestmentAccount[];
  marketPrices: MarketPrice[];
  availableFunds: number;
}

const BudgetAssistant: React.FC<Props> = ({ transactions, investments, marketPrices, availableFunds }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: "Hi! I'm your SmartBudget Pro Advisor. I'm currently tracking your Binance and Vanguard portfolios. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const totalInvestments = investments.reduce((acc, inv) => {
        return acc + inv.holdings.reduce((hAcc, h) => {
          const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
          return hAcc + (h.quantity * live);
        }, 0);
      }, 0);

      const context = `
        User Cash Balance: $${availableFunds.toFixed(2)}
        User Investment Portfolio: $${totalInvestments.toFixed(2)}
        Linked Accounts: ${investments.map(i => i.provider).join(', ') || 'None'}
        Top Holdings: ${investments.flatMap(i => i.holdings).map(h => h.symbol).join(', ')}
        Latest Market Tickers: ${marketPrices.map(m => `${m.symbol}: $${m.price.toFixed(2)} (${m.change24h.toFixed(2)}%)`).join('; ')}
        Recent Spend: ${transactions.slice(0, 3).map(t => `${t.description} ($${t.amount})`).join(', ')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Context: ${context}\nUser Question: ${userMsg}`,
        config: {
          systemInstruction: "You are an elite, concise financial advisor. You use the user's specific data to answer questions about their budget and investments. Be encouraging but realistic. Keep responses under 3 sentences."
        }
      });

      setMessages(prev => [...prev, { role: 'ai', text: response.text || "I'm processing your data. Please ask me again in a moment." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Service temporary unavailable. Please check your internet connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      {isOpen ? (
        <div className="w-[340px] md:w-[400px] h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                <i className="fas fa-robot"></i>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest leading-tight">Pro Advisor</p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Live Sync Active</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white px-4 py-3 rounded-2xl border border-slate-100 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Can I afford to invest $200 more?"
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group relative border-4 border-white"
        >
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
          <i className="fas fa-comment-dots text-2xl group-hover:rotate-12 transition-transform"></i>
        </button>
      )}
    </div>
  );
};

export default BudgetAssistant;