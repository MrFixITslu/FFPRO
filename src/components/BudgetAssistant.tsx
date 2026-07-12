import React, { useState, useRef, useEffect } from 'react';
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
      // FIX: Call backend endpoint instead of direct Gemini API
      const totalInvestments = investments.reduce((acc, inv) => {
        return acc + inv.holdings.reduce((hAcc, h) => {
          const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
          return hAcc + (h.quantity * live);
        }, 0);
      }, 0);

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMsg,
          context: {
            availableFunds,
            totalInvestments,
            providers: investments.map(i => i.provider),
            holdings: investments.flatMap(i => i.holdings).map(h => h.symbol),
            marketPrices: marketPrices.map(m => ({ symbol: m.symbol, price: m.price, change24h: m.change24h })),
            recentTransactions: transactions.slice(0, 3).map(t => ({ description: t.description, amount: t.amount }))
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'ai', text: data.message || "I'm processing your data. Please ask me again in a moment." }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: "Service temporary unavailable. Please check your internet connection." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Service temporary unavailable. Please check your internet connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      {isOpen ? (
        <div className="w-[320px] md:w-[360px] h-[460px] bg-white rounded-lg shadow-lg border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
          <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-sm">
                <i className="fas fa-robot text-sm"></i>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider leading-tight">Pro Advisor</p>
                <p className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider mt-0.5">Live Sync Active</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition text-slate-400 hover:text-white">
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded text-xs font-semibold leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm' : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white px-3 py-2 rounded border border-slate-200 flex gap-1 items-center shadow-sm">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-white border-t border-slate-200">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Can I afford to invest $200 more?"
                className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="w-8 h-8 bg-indigo-600 text-white rounded flex items-center justify-center shadow-sm hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50"
              >
                <i className="fas fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 bg-slate-900 text-white rounded shadow-md flex items-center justify-center hover:scale-105 transition-transform active:scale-95 group relative border border-slate-800"
        >
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-slate-900 animate-pulse"></span>
          <i className="fas fa-comment-dots text-lg group-hover:rotate-12 transition-transform"></i>
        </button>
      )}
    </div>
  );
};

export default BudgetAssistant;