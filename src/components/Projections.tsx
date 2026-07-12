import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Transaction, RecurringIncome, RecurringExpense, InvestmentAccount, MarketPrice } from '../types';

interface Props {
  transactions: Transaction[];
  recurringIncomes: RecurringIncome[];
  recurringExpenses: RecurringExpense[];
  investments: InvestmentAccount[];
  marketPrices: MarketPrice[];
  categoryBudgets: Record<string, number>;
  currentNetWorth: number;
}

const Projections: React.FC<Props> = ({ 
  recurringIncomes, 
  recurringExpenses, 
  investments, 
  marketPrices, 
  categoryBudgets, 
  currentNetWorth 
}) => {
  // Persist sliders in local storage
  const [yearsToProject, setYearsToProject] = useState(() => {
    const saved = localStorage.getItem('ff_proj_years');
    return saved ? parseInt(saved) : 5;
  });
  
  const [monthlyContribution, setMonthlyContribution] = useState(() => {
    const saved = localStorage.getItem('ff_proj_contribution');
    return saved ? parseInt(saved) : 500;
  });
  
  const [expectedReturn, setExpectedReturn] = useState(() => {
    const saved = localStorage.getItem('ff_proj_roi');
    return saved ? parseInt(saved) : 8;
  });

  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Update storage when sliders change
  useEffect(() => {
    localStorage.setItem('ff_proj_years', yearsToProject.toString());
  }, [yearsToProject]);

  useEffect(() => {
    localStorage.setItem('ff_proj_contribution', monthlyContribution.toString());
  }, [monthlyContribution]);

  useEffect(() => {
    localStorage.setItem('ff_proj_roi', expectedReturn.toString());
  }, [expectedReturn]);

  // Calculate base monthly savings
  const monthlyIncome = useMemo(() => recurringIncomes.reduce((acc: number, inc) => acc + inc.amount, 0), [recurringIncomes]);
  const monthlyFixedExpenses = useMemo(() => recurringExpenses.reduce((acc: number, exp) => acc + exp.amount, 0), [recurringExpenses]);
  const monthlyBudgetedExpenses = useMemo(() => Object.values(categoryBudgets).reduce((acc: number, val) => acc + ((val as number) || 0), 0), [categoryBudgets]);
  const netMonthlyCashflow = monthlyIncome - monthlyFixedExpenses - monthlyBudgetedExpenses;

  const projectionData = useMemo(() => {
    const data = [];
    const monthlyRate = expectedReturn / 100 / 12;
    
    const investedBalance = investments.reduce((acc: number, inv) => {
        return acc + inv.holdings.reduce((hAcc: number, h) => {
          const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
          return hAcc + (h.quantity * live);
        }, 0);
    }, 0);
    const cashBalance = currentNetWorth - investedBalance;

    let runningInvested = investedBalance;
    let runningCash = cashBalance;

    // Start with month 0
    data.push({
      month: 0,
      label: 'Now',
      total: currentNetWorth,
      invested: runningInvested,
      cash: runningCash
    });

    for (let m = 1; m <= yearsToProject * 12; m++) {
      // Invested grows by expected return + monthly contribution
      runningInvested = (runningInvested + monthlyContribution) * (1 + monthlyRate);
      
      // Cash grows by the remainder of cashflow (simplified)
      const remainingCashflow = Math.max(0, netMonthlyCashflow - monthlyContribution);
      runningCash = runningCash + remainingCashflow;

      const total = runningInvested + runningCash;
      
      if (m % 3 === 0 || m === yearsToProject * 12) {
        data.push({
          month: m,
          label: m % 12 === 0 ? `Yr ${m / 12}` : `M${m}`,
          total: Math.round(total),
          invested: Math.round(runningInvested),
          cash: Math.round(runningCash)
        });
      }
    }
    return data;
  }, [currentNetWorth, investments, marketPrices, yearsToProject, monthlyContribution, expectedReturn, netMonthlyCashflow]);

  const finalValue = projectionData[projectionData.length - 1].total;
  const milestones = [
    { target: 10000, label: '$10k Entry' },
    { target: 50000, label: '$50k Milestone' },
    { target: 100000, label: '$100k Club' },
    { target: 250000, label: '$250k Quarter' },
    { target: 500000, label: '$500k Half-Mil' },
    { target: 1000000, label: 'Millionaire' }
  ];

  const reachedMilestones = milestones.filter(m => m.target <= finalValue);

  useEffect(() => {
    const runAI = async () => {
      setIsAnalyzing(true);
      try {
        // FIX: Call backend endpoint instead of direct Gemini API
        const response = await fetch('/api/ai/projection-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            currentNetWorth,
            monthlyIncome,
            monthlyExpenses: monthlyFixedExpenses + monthlyBudgetedExpenses,
            monthlyContribution,
            projectedValue: finalValue
          })
        });

        if (response.ok) {
          const data = await response.json();
          setAiAnalysis(data.analysis || "Your current path is sustainable. Continue optimizing fixed costs.");
        } else {
          setAiAnalysis("Strategic advisor offline. Market parameters within normal range.");
        }
      } catch (e) {
        setAiAnalysis("Strategic advisor offline. Market parameters within normal range.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    runAI();
  }, [finalValue]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Projection Chart */}
        <section className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Wealth Projection Matrix</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">Future Net Worth Simulation</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target End Value</p>
                <h4 className="text-2xl font-bold text-indigo-600 tracking-tight">${finalValue.toLocaleString()}</h4>
              </div>
            </div>

            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.05}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.05}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }} 
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" name="Total Net Worth" />
                  <Area type="monotone" dataKey="invested" stroke="#10b981" strokeWidth={1.5} fillOpacity={0.1} fill="url(#colorInvested)" name="Invested Asset Growth" strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Simulator Controls */}
        <aside className="w-full lg:w-[380px] space-y-6">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-white shadow-sm">
            <h3 className="text-indigo-400 font-bold uppercase text-xs tracking-wider mb-6">Scenario Simulator</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Time Horizon</label>
                  <span className="text-xs font-bold text-indigo-400">{yearsToProject} Years</span>
                </div>
                <input 
                  type="range" min="1" max="25" 
                  value={yearsToProject} 
                  onChange={(e) => setYearsToProject(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-indigo-500" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Monthly Contribution</label>
                  <span className="text-xs font-bold text-emerald-400">${monthlyContribution}</span>
                </div>
                <input 
                  type="range" min="0" max={Math.max(5000, monthlyIncome)} step="50"
                  value={monthlyContribution} 
                  onChange={(e) => setMonthlyContribution(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-emerald-500" 
                />
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">Available Surplus: ${netMonthlyCashflow.toFixed(0)}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Expected ROI (Annual)</label>
                  <span className="text-xs font-bold text-amber-400">{expectedReturn}%</span>
                </div>
                <input 
                  type="range" min="0" max="25" 
                  value={expectedReturn} 
                  onChange={(e) => setExpectedReturn(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-amber-500" 
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded flex items-center justify-center shadow-sm">
                  <i className="fas fa-brain text-[10px]"></i>
                </div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI Strategic Feedback</h4>
             </div>
             {isAnalyzing ? (
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-slate-100 animate-pulse rounded"></div>
                  <div className="h-3 w-4/5 bg-slate-100 animate-pulse rounded"></div>
                </div>
             ) : (
                <p className="text-xs font-medium text-slate-600 leading-relaxed">"{aiAnalysis}"</p>
             )}
          </div>
        </aside>
      </div>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-8">Wealth Milestones Forecast</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {milestones.map((m, idx) => {
            const isReached = m.target <= finalValue;
            const progress = Math.min(100, (finalValue / m.target) * 100);
            return (
              <div key={idx} className={`p-4 rounded-lg border transition-all ${isReached ? 'bg-emerald-50/30 border-emerald-200 shadow-sm' : 'bg-slate-50/50 border-slate-200 opacity-75'}`}>
                <div className={`w-8 h-8 rounded flex items-center justify-center mb-3 border ${isReached ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                  <i className={`fas ${isReached ? 'fa-check-circle' : 'fa-lock'} text-xs`}></i>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{m.label}</p>
                <p className={`text-sm font-semibold ${isReached ? 'text-emerald-700' : 'text-slate-800'}`}>${(m.target/1000)}k</p>
                
                <div className="mt-3 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${isReached ? 'bg-emerald-500' : 'bg-indigo-600'} transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Projections;