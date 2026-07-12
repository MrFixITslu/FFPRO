
import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, BarChart, Bar, Cell } from 'recharts';
import { Transaction, RecurringExpense, RecurringIncome, InvestmentAccount, MarketPrice, BankConnection, InvestmentGoal, SavingGoal } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Plus,
  ArrowRight,
  PieChart,
  Target,
  BarChart3,
  Calendar,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

interface InstitutionalBalance {
  balance: number;
  type: string;
  available: boolean;
  holdings?: any[];
  isCash?: boolean;
}

interface Props {
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  recurringIncomes: RecurringIncome[];
  savingGoals: SavingGoal[];
  investmentGoals: InvestmentGoal[];
  investments: InvestmentAccount[];
  marketPrices: MarketPrice[];
  bankConnections: BankConnection[];
  targetMargin: number;
  cashOpeningBalance: number;
  categoryBudgets: Record<string, number>;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onPayRecurring: (rec: RecurringExpense, amount: number) => void;
  onReceiveRecurringIncome: (inc: RecurringIncome, amount: number, destination: string) => void;
  onContributeSaving: (goalId: string, amount: number) => void;
  onWithdrawSaving: (goalId: string, amount: number) => void;
  onWithdrawal: (institution: string, amount: number) => void;
  onAddIncome: (amount: number, description: string, notes: string) => void;
  onUpdateCategoryBudget?: (category: string, amount: number) => void;
}

type Timeframe = 'daily' | 'monthly' | 'yearly';

const Dashboard: React.FC<Props> = ({ 
  transactions, investments, marketPrices, bankConnections, recurringExpenses, recurringIncomes, categoryBudgets, cashOpeningBalance, savingGoals, investmentGoals, onPayRecurring, onReceiveRecurringIncome, onUpdateCategoryBudget
}) => {
  const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editBudgetVal, setEditBudgetVal] = useState<string>("");

  const cycleStartDate = useMemo(() => {
    const now = new Date();
    // Default to the 25th of the current month at 00:00:00
    let start = new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0, 0);
    
    // If today is before the 25th, the cycle actually started on the 25th of LAST month
    if (now.getDate() < 25) {
      start.setMonth(start.getMonth() - 1);
    }
    
    // Hard override for the requested start on Feb 25, 2025
    const feb25_2025 = new Date(2025, 1, 25, 0, 0, 0, 0);
    if (start < feb25_2025) return feb25_2025;
    
    return start;
  }, []);

  const daysPassedInCycle = useMemo(() => {
    const now = new Date();
    const diff = now.getTime() - cycleStartDate.getTime();
    // Ensure at least 1 day for calculations to avoid division by zero
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [cycleStartDate]);

  const daysUntilNextCycle = useMemo(() => {
    const now = new Date();
    let nextCycle = new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0, 0);
    if (now.getDate() >= 25) {
      nextCycle.setMonth(nextCycle.getMonth() + 1);
    }
    const diff = nextCycle.getTime() - now.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  const { totalActualIncome, totalActualExpenses } = useMemo(() => {
    const current = transactions.filter(t => new Date(t.date + 'T00:00:00') >= cycleStartDate);
    return {
      totalActualIncome: current.filter(t => t.type === 'income').reduce((acc: number, t) => acc + t.amount, 0),
      totalActualExpenses: current.filter(t => t.type === 'expense').reduce((acc: number, t) => acc + t.amount, 0),
    };
  }, [transactions, cycleStartDate]);

  const netMargin = totalActualIncome - totalActualExpenses;

  const institutionalBalances = useMemo<Record<string, InstitutionalBalance>>(() => {
    const balances: Record<string, InstitutionalBalance> = {};
    bankConnections.forEach(conn => {
      const history = transactions.filter(t => t.institution === conn.institution || t.destinationInstitution === conn.institution);
      const flow = history.reduce((acc: number, t) => {
        if (t.destinationInstitution === conn.institution && (t.type === 'transfer' || t.type === 'withdrawal')) return acc + t.amount;
        if (t.institution === conn.institution) {
          if (t.type === 'income' || t.type === 'savings') return acc + t.amount; 
          if (t.type === 'expense' || t.type === 'transfer' || t.type === 'withdrawal') return acc - t.amount;
        }
        return acc;
      }, 0);
      balances[conn.institution] = { balance: (conn.openingBalance || 0) + flow, type: conn.institutionType, available: conn.institution.includes('1st National') };
    });

    const cashFlow = transactions.filter(t => t.institution === 'Cash in Hand' || t.destinationInstitution === 'Cash in Hand').reduce((acc: number, t) => {
      if (t.destinationInstitution === 'Cash in Hand' && (t.type === 'transfer' || t.type === 'withdrawal')) return acc + t.amount;
      if (t.institution === 'Cash in Hand') {
        if (t.type === 'income') return acc + t.amount;
        if (t.type === 'expense' || t.type === 'transfer' || t.type === 'withdrawal' || t.type === 'savings') return acc - t.amount;
      }
      return acc;
    }, cashOpeningBalance);
    balances['Cash in Hand'] = { balance: cashFlow, type: 'cash', available: true, isCash: true };

    investments.forEach(inv => {
      const liveVal = inv.holdings.reduce((hAcc: number, h) => {
        const live = marketPrices.find(m => m.symbol === h.symbol)?.price || h.purchasePrice;
        return hAcc + (h.quantity * live);
      }, 0);
      const withdrawFlow = transactions.filter(t => t.institution === inv.provider && (t.type === 'withdrawal' || t.type === 'transfer' || t.type === 'expense')).reduce((acc: number, t) => acc + t.amount, 0);
      const depositFlow = transactions.filter(t => t.destinationInstitution === inv.provider && (t.type === 'transfer' || t.type === 'income')).reduce((acc: number, t) => acc + t.amount, 0);
      balances[inv.provider] = { balance: liveVal - withdrawFlow + depositFlow, type: 'investment', available: false, holdings: inv.holdings };
    });
    return balances;
  }, [bankConnections, investments, transactions, marketPrices, cashOpeningBalance]);

  const { bankTotal, cuTotal, cryptoTotal, vanguardTotal } = useMemo(() => {
    let b = 0, c = 0, cr = 0, v = 0;
    (Object.entries(institutionalBalances) as Array<[string, InstitutionalBalance]>).forEach(([name, data]) => {
      if (data.type === 'bank') b += data.balance;
      if (data.type === 'credit_union') c += data.balance;
      if (data.type === 'investment') {
        if (name === 'Binance') cr += data.balance;
        else v += data.balance;
      }
    });
    return { bankTotal: b, cuTotal: c, cryptoTotal: cr, vanguardTotal: v };
  }, [institutionalBalances]);

  const liquidFunds = useMemo<number>(() => {
    const bankSum = (Object.values(institutionalBalances) as InstitutionalBalance[])
      .filter(b => b.type === 'bank')
      .reduce((acc, b) => acc + b.balance, 0);
    const cash = Number(institutionalBalances['Cash in Hand']?.balance || 0);
    return bankSum + cash;
  }, [institutionalBalances]);

  const netWorth: number = (Object.values(institutionalBalances) as InstitutionalBalance[]).reduce((acc: number, b) => acc + b.balance, 0);

  const cycleRollover = useMemo(() => {
    const pastTransactions = transactions.filter(t => new Date(t.date + 'T00:00:00').getTime() < cycleStartDate.getTime());
    const openingBalancesTotal = bankConnections.reduce((acc: number, conn) => acc + conn.openingBalance, 0) + cashOpeningBalance;
    
    const historicalCashflow = pastTransactions.reduce((acc: number, t) => {
      if (t.institution === '1st National Bank St. Lucia' || t.institution === 'Cash in Hand') {
        if (t.type === 'income') return acc + t.amount;
        if (t.type === 'expense' || t.type === 'savings' || t.type === 'withdrawal') return acc - t.amount;
      }
      if (t.destinationInstitution === '1st National Bank St. Lucia' || t.destinationInstitution === 'Cash in Hand') {
        if (t.type === 'transfer' || t.type === 'withdrawal') return acc + t.amount;
      }
      return acc;
    }, 0);

    return openingBalancesTotal + historicalCashflow;
  }, [transactions, cycleStartDate, bankConnections, cashOpeningBalance]);

  const categorySpendData = useMemo(() => {
    const spent: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense' && new Date(t.date + 'T00:00:00') >= cycleStartDate)
      .forEach(t => {
        spent[t.category] = (spent[t.category] || 0) + t.amount;
      });

    // Ensure all budgeted categories are included even if spent amount is 0
    const budgetedCategories = Object.keys(categoryBudgets);
    const spentCategories = Object.keys(spent);
    const allCategories = Array.from(new Set([...budgetedCategories, ...spentCategories]))
      .filter(c => !['Income', 'Transfer', 'Savings', 'Investments'].includes(c));

    return allCategories.map(name => {
      const amount = spent[name] || 0;
      const budget = categoryBudgets[name] || 0;
      const progress = budget > 0 ? (amount / budget) * 100 : 0;
      const dailyAvg = amount / daysPassedInCycle;
      return { name, amount, budget, progress, dailyAvg };
    }).sort((a, b) => b.amount - a.amount || b.budget - a.budget);
  }, [transactions, cycleStartDate, categoryBudgets, daysPassedInCycle]);

  const cashflowTrends = useMemo(() => {
    const grouped: Record<string, { income: number; expense: number }> = {};
    const filtered = transactions.filter(t => t.type === 'income' || t.type === 'expense');

    filtered.forEach(t => {
      const date = new Date(t.date);
      let label = "";
      
      if (trendTimeframe === 'daily') {
        label = t.date;
      } else if (trendTimeframe === 'monthly') {
        label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        label = `${date.getFullYear()}`;
      }

      if (!grouped[label]) grouped[label] = { income: 0, expense: 0 };
      if (t.type === 'income') grouped[label].income += t.amount;
      else grouped[label].expense += t.amount;
    });

    const sortedData = Object.entries(grouped)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (trendTimeframe === 'daily') return sortedData.slice(-30);
    if (trendTimeframe === 'monthly') return sortedData.slice(-12);
    return sortedData;
  }, [transactions, trendTimeframe]);

  const unpaidBills = useMemo(() => {
    return recurringExpenses.map(bill => {
      const totalPaid = transactions
        .filter(t => t.recurringId === bill.id && new Date(t.date + 'T00:00:00') >= cycleStartDate)
        .reduce((sum: number, t) => sum + t.amount, 0);
      return { ...bill, remainingAmount: Math.max(0, bill.amount - totalPaid), paidAmount: totalPaid };
    }).filter(bill => bill.remainingAmount > 0.01);
  }, [recurringExpenses, transactions, cycleStartDate]);

  const unconfirmedIncomes = useMemo(() => {
    return recurringIncomes.map(inc => {
      const totalReceived = transactions
        .filter(t => t.recurringId === inc.id && t.type === 'income' && new Date(t.date + 'T00:00:00') >= cycleStartDate)
        .reduce((sum: number, t) => sum + t.amount, 0);
      return { ...inc, remainingAmount: Math.max(0, inc.amount - totalReceived), receivedAmount: totalReceived };
    }).filter(inc => inc.remainingAmount > 0.01);
  }, [recurringIncomes, transactions, cycleStartDate]);

  const criticalNotifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const notifications = [];

    unpaidBills.forEach(bill => {
      const dueDate = new Date(bill.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        notifications.push({
          id: `notif-bill-${bill.id}`,
          type: 'bill',
          title: bill.description,
          amount: bill.remainingAmount,
          dueDate: bill.nextDueDate,
          days: diffDays,
          item: bill,
          isIncome: false
        });
      }
    });

    unconfirmedIncomes.forEach(inc => {
      const confDate = new Date(inc.nextConfirmationDate);
      confDate.setHours(0, 0, 0, 0);
      const diffTime = confDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        notifications.push({
          id: `notif-inc-${inc.id}`,
          type: 'income',
          title: inc.description,
          amount: inc.remainingAmount,
          dueDate: inc.nextConfirmationDate,
          days: diffDays,
          item: inc,
          isIncome: true
        });
      }
    });

    return notifications.sort((a, b) => a.days - b.days);
  }, [unpaidBills, unconfirmedIncomes]);

  const dailySafeSpend = useMemo(() => {
    return Math.max(0, liquidFunds / daysUntilNextCycle);
  }, [liquidFunds, daysUntilNextCycle]);

  useEffect(() => {
    const generateSummary = async () => {
      if (transactions.length < 1) { setAiInsight("Welcome! Log spend to unlock insights."); return; }
      setIsGeneratingInsight(true);
      try {
        // FIX: Call backend endpoint instead of direct Gemini API
        const response = await fetch('/api/ai/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            totalIncome: totalActualIncome,
            totalExpenses: totalActualExpenses,
            netWorth: netWorth,
            cycleRollover: cycleRollover,
            dailySafeSpend: dailySafeSpend,
            netMargin: netMargin
          })
        });

        if (response.ok) {
          const data = await response.json();
          setAiInsight(data.insight || "Portfolio stable.");
        } else {
          setAiInsight("Gemini Advisor on standby.");
        }
      } catch (e) { 
        setAiInsight("Gemini Advisor on standby."); 
      } finally { 
        setIsGeneratingInsight(false); 
      }
    };
    generateSummary();
  }, [totalActualIncome, totalActualExpenses, netWorth, transactions.length, cycleRollover, dailySafeSpend, netMargin]);

  const handleQuickPaymentAction = (item: any, isIncome: boolean) => {
    const amt = parseFloat(partialAmount) || item.remainingAmount;
    if (isIncome) {
      const destination = selectedDestination || 'Cash in Hand';
      onReceiveRecurringIncome(item, amt, destination);
    } else {
      onPayRecurring(item, amt);
    }
    setActivePaymentId(null);
    setPartialAmount("");
    setSelectedDestination(null);
  };

  const startRecordCommitment = (item: any, isIncome: boolean) => {
    setActivePaymentId(item.id);
    setPartialAmount(item.remainingAmount.toFixed(2));
    
    if (isIncome) {
      const isSalary = item.description.toLowerCase().includes('salary');
      if (isSalary) {
        setSelectedDestination(bankConnections[0]?.institution || 'Cash in Hand');
      } else {
        setSelectedDestination('Cash in Hand');
      }
    }
  };

  const startEditCategoryBudget = (name: string, currentBudget: number) => {
    setEditingCategory(name);
    setEditBudgetVal(currentBudget > 0 ? currentBudget.toString() : "");
  };

  const saveCategoryBudget = () => {
    if (editingCategory && onUpdateCategoryBudget) {
      onUpdateCategoryBudget(editingCategory, parseFloat(editBudgetVal) || 0);
      setEditingCategory(null);
      setEditBudgetVal("");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 print:p-0">
      <div className="hidden print:block border-b-2 border-slate-900 pb-6 mb-8">
        <h1 className="text-2xl font-light text-slate-900 uppercase tracking-wider">Financial Audit Statement</h1>
      </div>

      {criticalNotifications.length > 0 && (
        <section className="animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
            <div>
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Priority Reminders</h3>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {criticalNotifications.map((notif) => {
              const d = new Date(notif.dueDate);
              const formattedDate = d.toLocaleDateString('default', { day: 'numeric', month: 'short' });
              return (
                <div 
                  key={notif.id}
                  className={`min-w-[280px] p-4 rounded-xl border transition-all flex flex-col justify-between shadow-sm bg-white ${notif.isIncome ? 'border-emerald-200 text-slate-900' : 'border-slate-200 text-slate-900'}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${notif.isIncome ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                        {notif.days < 0 ? 'Overdue' : notif.days === 0 ? 'Due Today' : `Due ${formattedDate}`}
                      </span>
                      <i className={`fas ${notif.isIncome ? 'fa-arrow-trend-up' : 'fa-receipt'} opacity-30 text-slate-400`}></i>
                    </div>
                    <h4 className="font-bold text-sm tracking-tight text-slate-800 mb-1 truncate">{notif.title}</h4>
                    <p className="text-base font-semibold text-slate-900">${notif.amount.toLocaleString()}</p>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-1">Scheduled: {formattedDate}</p>
                  </div>
                  <button 
                    onClick={() => startRecordCommitment(notif.item, notif.isIncome)}
                    className={`mt-4 py-1.5 w-full rounded text-[10px] font-bold uppercase tracking-wider transition-all ${notif.isIncome ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    Clear Commitment
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Strategic Advisor Insight styled beautifully as white card with slate borders */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group print:rounded-none">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-1.5 w-1.5 relative print:hidden">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Strategic Advisor Insight</p>
            </div>
            {isGeneratingInsight ? (
              <div className="h-6 w-3/4 bg-slate-100 animate-pulse rounded"></div>
            ) : (
              <h2 className="text-slate-800 text-base font-light italic">"{aiInsight}"</h2>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1 text-center">Rollover</p>
           <h3 className="text-xs font-bold text-slate-600 text-center">${cycleRollover.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1 text-center">Inflow</p>
           <h3 className="text-xs font-bold text-emerald-600 text-center">+${totalActualIncome.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1 text-center">Outflow</p>
           <h3 className="text-xs font-bold text-rose-600 text-center">-${totalActualExpenses.toLocaleString()}</h3>
        </div>
        <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-center ${netMargin >= 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'}`}>
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1 text-center">Net Margin</p>
           <h3 className={`text-xs font-bold text-center ${netMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
             {netMargin >= 0 ? '+' : ''}${netMargin.toLocaleString()}
           </h3>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1 text-center">Cash On Hand</p>
           <h3 className="text-xs font-bold text-indigo-600 text-center">${liquidFunds.toLocaleString()}</h3>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-sm flex flex-col justify-center text-center">
           <p className="text-emerald-600/80 text-[8px] font-bold uppercase tracking-wider mb-1">Safe Spend</p>
           <h3 className="text-sm font-bold text-emerald-700">${dailySafeSpend.toFixed(0)}<span className="text-[8px] text-emerald-600/60 uppercase">/Day</span></h3>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl shadow-sm flex flex-col justify-center text-center">
           <p className="text-indigo-600/80 text-[8px] font-bold uppercase tracking-wider mb-1">Days left</p>
           <h3 className="text-sm font-bold text-indigo-700">{daysUntilNextCycle} <span className="text-[8px] text-indigo-600/60 uppercase">Days</span></h3>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm text-white flex flex-col justify-center text-center">
           <p className="text-white/50 text-[8px] font-bold uppercase tracking-wider mb-1">Net Worth</p>
           <h3 className="text-xs font-semibold text-white">${netWorth.toLocaleString()}</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1">Traditional Bank</p>
           <h3 className="text-sm font-semibold text-slate-800">${bankTotal.toLocaleString()}</h3>
           <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-600" style={{ width: `${netWorth > 0 ? (bankTotal / netWorth) * 100 : 0}%` }}></div>
           </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1">Credit Union</p>
           <h3 className="text-sm font-semibold text-slate-800">${cuTotal.toLocaleString()}</h3>
           <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-600" style={{ width: `${netWorth > 0 ? (cuTotal / netWorth) * 100 : 0}%` }}></div>
           </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1">Crypto (Digital)</p>
           <h3 className="text-sm font-semibold text-slate-800">${cryptoTotal.toLocaleString()}</h3>
           <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-600" style={{ width: `${netWorth > 0 ? (cryptoTotal / netWorth) * 100 : 0}%` }}></div>
           </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mb-1">Other Investments</p>
           <h3 className="text-sm font-semibold text-slate-800">${vanguardTotal.toLocaleString()}</h3>
           <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-600" style={{ width: `${netWorth > 0 ? (vanguardTotal / netWorth) * 100 : 0}%` }}></div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[450px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Cashflow Trajectory</h3>
            <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-150">
              {(['daily', 'monthly', 'yearly'] as Timeframe[]).map(tf => (
                <button key={tf} onClick={() => setTrendTimeframe(tf)} className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${trendTimeframe === tf ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-700'}`}>{tf}</button>
              ))}
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowTrends}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.05}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.05}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" name="Inflow" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" name="Outflow" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Category Spend Matrix</h3>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Active Cycle</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-2">
            {categorySpendData.map((cat, idx) => {
              const isEditing = editingCategory === cat.name;
              return (
                <div key={idx} className="space-y-1.5 group">
                  <div className="flex justify-between items-end px-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black text-slate-800">{cat.name}</p>
                        {!isEditing && onUpdateCategoryBudget && (
                          <button 
                            onClick={() => startEditCategoryBudget(cat.name, cat.budget)}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-indigo-600 transition-all"
                          >
                            <i className="fas fa-pencil-alt"></i>
                          </button>
                        )}
                      </div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Avg: ${cat.dailyAvg.toFixed(2)}/day</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black text-slate-900">${cat.amount.toLocaleString()}</p>
                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1 animate-in fade-in slide-in-from-right-1">
                          <input 
                            type="number"
                            autoFocus
                            value={editBudgetVal}
                            onChange={(e) => setEditBudgetVal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveCategoryBudget()}
                            className="w-16 h-5 bg-slate-50 border border-indigo-200 rounded text-[9px] font-black px-1 outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Limit"
                          />
                          <button onClick={saveCategoryBudget} className="w-5 h-5 bg-indigo-600 text-white rounded flex items-center justify-center text-[8px]"><i className="fas fa-check"></i></button>
                          <button onClick={() => setEditingCategory(null)} className="w-5 h-5 bg-slate-100 text-slate-400 rounded flex items-center justify-center text-[8px]"><i className="fas fa-times"></i></button>
                        </div>
                      ) : (
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          {cat.budget > 0 ? `${cat.progress.toFixed(0)}% of $${cat.budget}` : 'Uncapped'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${cat.progress > 90 ? 'bg-rose-500' : cat.progress > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                      style={{ width: `${Math.min(100, cat.budget > 0 ? cat.progress : 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-6">Upcoming Commitments</h3>
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {unpaidBills.concat(unconfirmedIncomes as any).length > 0 ? unpaidBills.concat(unconfirmedIncomes as any).slice(0, 10).map((bill: any) => {
              const isIncome = 'nextConfirmationDate' in bill;
              const isActive = activePaymentId === bill.id;
              const progress = (bill.paidAmount || bill.receivedAmount || 0) / bill.amount * 100;
              const hasPaidSomething = progress > 0;
              const isSalary = isIncome && bill.description.toLowerCase().includes('salary');

              return (
                <div key={bill.id} className="p-4 bg-slate-50/50 border border-slate-200 rounded-lg transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center shadow-sm border ${isIncome ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                        <i className={`fas ${isIncome ? 'fa-hand-holding-dollar' : 'fa-file-invoice'} text-xs`}></i>
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-slate-800">{bill.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {isIncome ? 'Expect' : 'Bill'}: ${bill.amount}
                          </p>
                          {hasPaidSomething && (
                            <span className="px-1 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[8px] font-bold uppercase rounded">Partial</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-bold text-indigo-600">${bill.remainingAmount.toFixed(2)}</p>
                       <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Due: {new Date(isIncome ? bill.nextConfirmationDate : bill.nextDueDate).toLocaleDateString('default', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>

                  {isActive && isIncome && (
                    <div className="mt-3 p-3 bg-white rounded border border-indigo-100 space-y-2 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Destination</p>
                      <div className="flex flex-wrap gap-1.5">
                        {!isSalary && (
                          <button 
                            onClick={() => setSelectedDestination('Cash in Hand')}
                            className={`px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${selectedDestination === 'Cash in Hand' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                          >
                            Cash In Hand
                          </button>
                        )}
                        {bankConnections.map(conn => (
                          <button 
                            key={conn.institution}
                            onClick={() => setSelectedDestination(conn.institution)}
                            className={`px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${selectedDestination === conn.institution ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                          >
                            {conn.institution}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200/55">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                      Sched: {new Date(isIncome ? bill.nextConfirmationDate : bill.nextDueDate).toLocaleDateString()}
                    </p>
                    {isActive ? (
                      <div className="flex gap-1.5 items-center animate-in slide-in-from-right-2">
                        <input 
                          type="number" 
                          autoFocus
                          placeholder={bill.remainingAmount.toFixed(2)}
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          className="w-20 px-2.5 py-1.5 bg-white border border-indigo-300 rounded text-[10px] font-semibold outline-none shadow-sm focus:border-indigo-500"
                        />
                        <button 
                          onClick={() => handleQuickPaymentAction(bill, isIncome)} 
                          disabled={isIncome && !selectedDestination}
                          className={`w-7 h-7 bg-indigo-600 text-white rounded flex items-center justify-center text-[9px] disabled:opacity-30 disabled:grayscale hover:bg-indigo-700 transition-colors shadow-sm`}
                        >
                          <i className="fas fa-check"></i>
                        </button>
                        <button onClick={() => { setActivePaymentId(null); setPartialAmount(""); setSelectedDestination(null); }} className="w-7 h-7 bg-slate-100 text-slate-400 rounded flex items-center justify-center text-[9px] hover:bg-slate-200 border border-slate-200 transition-colors"><i className="fas fa-times"></i></button>
                      </div>
                    ) : (
                      <button onClick={() => startRecordCommitment(bill, isIncome)} className="px-3 py-1 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider rounded hover:bg-indigo-600 transition-all shadow-sm">Record</button>
                    )}
                  </div>
                </div>
              );
            }) : <p className="py-10 text-center text-slate-300 font-bold uppercase text-[9px] tracking-wider">All clear</p>}
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-6">Financial Objectives</h3>
          <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {savingGoals.length > 0 || investmentGoals.length > 0 ? (
              <>
                {savingGoals.map(goal => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex justify-between items-end px-1">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{goal.name}</p>
                        <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-wider">{goal.institution}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Savings Target</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
                {investmentGoals.map(goal => {
                  const currentVal = institutionalBalances[goal.provider]?.balance || 0;
                  const progress = (currentVal / goal.targetAmount) * 100;
                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex justify-between items-end px-1">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{goal.name}</p>
                          <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider">{goal.provider} Portfolio</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-900">${currentVal.toLocaleString()} / ${goal.targetAmount.toLocaleString()}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Asset Target</p>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-1000" 
                          style={{ width: `${Math.min(100, progress)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="py-10 text-center text-slate-300 font-bold uppercase text-[9px] tracking-wider">No Active Objectives</p>
            )}
          </div>
        </section>

        <section className="bg-slate-900 p-6 rounded-xl text-white shadow-sm overflow-hidden flex flex-col">
          <h3 className="font-bold uppercase text-xs tracking-wider text-indigo-400 mb-6">Market Pulse</h3>
          <div className="grid grid-cols-2 gap-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {marketPrices.slice(0, 4).map(p => (
              <div key={p.symbol} className="p-3.5 bg-white/5 border border-white/10 rounded-lg flex flex-col justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{p.symbol}</span>
                <h4 className="text-sm font-semibold mt-1.5">${p.price.toLocaleString()}</h4>
                <div className={`text-[9px] font-bold mt-1 ${p.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {p.change24h > 0 ? '+' : ''}{p.change24h.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
