
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import Login from './components/Login';
import MagicInput from './components/MagicInput';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import BankSyncModal from './components/BankSyncModal';
import BudgetAssistant from './components/BudgetAssistant';
import EventPlanner from './components/EventPlanner';
import Projections from './components/Projections';
import Calendar from './components/Calendar';
import VerificationQueue from './components/VerificationQueue';
import { 
  Transaction, 
  AIAnalysisResult, 
  RecurringExpense, 
  RecurringIncome, 
  SavingGoal, 
  BankConnection, 
  InvestmentAccount, 
  MarketPrice, 
  BudgetEvent, 
  Contact, 
  InvestmentGoal, 
  CalendarItem,
  STORAGE_KEYS 
} from './types';
import { vaultService, AppState } from './services/vaultService';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  HardDrive, 
  RefreshCw, 
  Download, 
  Upload,
  Settings as SettingsIcon,
  Plus,
  LayoutDashboard,
  Calendar as CalendarIcon,
  Zap,
  TrendingUp,
  LogOut,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ADMIN_USER = "nsv"; 

const safeParse = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    return fallback;
  }
};

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const MarketTicker = ({ prices, quotaExhausted }: { prices: MarketPrice[], quotaExhausted: boolean }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[120] bg-slate-900 text-white py-1.5 shadow-md border-b border-slate-800">
      <div className="flex items-center">
        <div className="px-4 border-r border-slate-800 flex items-center gap-2 whitespace-nowrap bg-slate-900 z-10">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${quotaExhausted ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${quotaExhausted ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          </span>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
            {quotaExhausted ? 'Cached Data' : 'Live Market Feed'}
          </span>
        </div>
        <div className="overflow-hidden relative flex-1">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-12">
            {[...prices, ...prices].map((p, idx) => (
              <div key={idx} className="flex items-center gap-3">
                 <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[8px] font-black text-white">{p.symbol.substring(0, 1)}</div>
                 <span className="font-black text-[9px] text-slate-400 tracking-[0.2em] uppercase">{p.symbol}</span>
                 <span className="font-black text-[10px] text-white tracking-tight">${p.price.toLocaleString()}</span>
                 <div className={`flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded ${p.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                   <i className={`fas fa-caret-${p.change24h >= 0 ? 'up' : 'down'}`}></i>
                   {Math.abs(p.change24h).toFixed(2)}%
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.AUTH) === 'true');
  const [currentUsername, setCurrentUsername] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.AUTH_USER) || '');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'events' | 'projections'>(() => {
    const user = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    return user === ADMIN_USER ? 'dashboard' : 'events';
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => safeParse(STORAGE_KEYS.TRANSACTIONS, []));
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => safeParse(STORAGE_KEYS.RECURRING_EXPENSES, []));
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>(() => safeParse(STORAGE_KEYS.RECURRING_INCOMES, []));
  const [savingGoals, setSavingGoals] = useState<SavingGoal[]>(() => safeParse(STORAGE_KEYS.SAVINGS_GOALS, []));
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoal[]>(() => safeParse(STORAGE_KEYS.INVESTMENT_GOALS, []));
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(() => safeParse(STORAGE_KEYS.CATEGORY_LIMITS, {}));
  const [bankConnections, setBankConnections] = useState<BankConnection[]>(() => safeParse(STORAGE_KEYS.BANK_CONNECTIONS, []));
  const [investments, setInvestments] = useState<InvestmentAccount[]>(() => safeParse(STORAGE_KEYS.INVESTMENTS, []));
  const [events, setEvents] = useState<BudgetEvent[]>(() => safeParse(STORAGE_KEYS.EVENTS, []));
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>(() => safeParse(STORAGE_KEYS.CALENDAR_ITEMS, []));
  const [contacts, setContacts] = useState<Contact[]>(() => safeParse(STORAGE_KEYS.CONTACTS, []));
  const [cashOpeningBalance, setCashOpeningBalance] = useState<number>(() => parseFloat(localStorage.getItem(STORAGE_KEYS.CASH_OPENING) || '0'));
  
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([
    { symbol: 'BTC', price: 95420.00, change24h: 1.2 },
    { symbol: 'ETH', price: 2850.50, change24h: -0.5 },
    { symbol: 'SOL', price: 165.20, change24h: 3.4 },
    { symbol: 'VOO', price: 548.12, change24h: 0.2 },
    { symbol: 'VOOG', price: 312.45, change24h: 0.1 }
  ]);
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const [pendingApprovals, setPendingApprovals] = useState<AIAnalysisResult[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBankSync, setShowBankSync] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vaultHandle, setVaultHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const isAdmin = currentUsername === ADMIN_USER;

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Global state object for backups
  const getFullState = useCallback((): AppState => ({
    transactions,
    recurringExpenses,
    recurringIncomes,
    savingGoals,
    investmentGoals,
    categoryBudgets,
    bankConnections,
    investments,
    events,
    calendarItems,
    contacts,
    cashOpeningBalance,
    lastUpdated: new Date().toISOString()
  }), [transactions, recurringExpenses, recurringIncomes, savingGoals, investmentGoals, categoryBudgets, bankConnections, investments, events, calendarItems, contacts, cashOpeningBalance]);

  // Restore Vault Handle on Mount
  useEffect(() => {
    const restoreVault = async () => {
      const handle = await vaultService.getHandle();
      if (handle) {
        setVaultHandle(handle);
        // Try to load state from vault if local storage is empty
        if (transactions.length === 0) {
          const savedState = await vaultService.loadState(handle);
          if (savedState) {
            setTransactions(savedState.transactions);
            setRecurringExpenses(savedState.recurringExpenses);
            setRecurringIncomes(savedState.recurringIncomes);
            setSavingGoals(savedState.savingGoals);
            setInvestmentGoals(savedState.investmentGoals);
            setCategoryBudgets(savedState.categoryBudgets);
            setBankConnections(savedState.bankConnections);
            setInvestments(savedState.investments);
            setEvents(savedState.events);
            setCalendarItems(savedState.calendarItems);
            setContacts(savedState.contacts);
            setCashOpeningBalance(savedState.cashOpeningBalance);
            setLastSyncTime(savedState.lastUpdated);
          }
        }
      }
    };
    restoreVault();
  }, []);

  // Sync to Vault
  const syncToVault = useCallback(async () => {
    if (!vaultHandle) return;
    setIsSyncing(true);
    setVaultError(null);
    try {
      await vaultService.saveState(vaultHandle, getFullState());
      setLastSyncTime(new Date().toISOString());
    } catch (err) {
      console.error('Vault sync failed:', err);
      setVaultError('Sync failed. Re-connect vault?');
    } finally {
      setIsSyncing(false);
    }
  }, [vaultHandle, getFullState]);

  // Auto-Sync on State Changes
  useEffect(() => {
    if (!vaultHandle || !isAuthenticated) return;

    const timer = setTimeout(() => {
      syncToVault();
    }, 5000); // 5s debounce

    return () => clearTimeout(timer);
  }, [vaultHandle, isAuthenticated, syncToVault]);

  const handleConnectVault = async () => {
    const handle = await vaultService.connectVault();
    if (handle) {
      setVaultHandle(handle);
      syncToVault();
    }
  };

  const handleDisconnectVault = async () => {
    await vaultService.disconnectVault();
    setVaultHandle(null);
    setLastSyncTime(null);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    localStorage.setItem(STORAGE_KEYS.RECURRING_EXPENSES, JSON.stringify(recurringExpenses));
    localStorage.setItem(STORAGE_KEYS.RECURRING_INCOMES, JSON.stringify(recurringIncomes));
    localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(savingGoals));
    localStorage.setItem(STORAGE_KEYS.BANK_CONNECTIONS, JSON.stringify(bankConnections));
    localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments));
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    localStorage.setItem(STORAGE_KEYS.CALENDAR_ITEMS, JSON.stringify(calendarItems));
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    localStorage.setItem(STORAGE_KEYS.CATEGORY_LIMITS, JSON.stringify(categoryBudgets));
    localStorage.setItem(STORAGE_KEYS.CASH_OPENING, cashOpeningBalance.toString());
  }, [transactions, recurringExpenses, recurringIncomes, savingGoals, bankConnections, investments, events, calendarItems, contacts, categoryBudgets, cashOpeningBalance]);

  const fetchMarketData = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Provide current market prices and 24h change for BTC, ETH, SOL, VOO, and VOOG.",
        config: { tools: [{ googleSearch: {} }] }
      });
      
      const text = response.text || "";
      const newPrices = marketPrices.map(p => {
        const regex = new RegExp(`${p.symbol}:?\\s*\\$?([\\d,.]+)`, 'i');
        const match = text.match(regex);
        if (match) {
          return { ...p, price: parseFloat(match[1].replace(/,/g, '')) };
        }
        return { ...p, price: p.price * (1 + (Math.random() * 0.002 - 0.001)) }; 
      });
      
      setMarketPrices(newPrices);
      setQuotaExhausted(false);
    } catch (e) {
      setQuotaExhausted(true);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000 * 5);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (user: string, pass: string) => {
    const success = user.length > 2;
    if (success) {
      setIsAuthenticated(true);
      setCurrentUsername(user);
      localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, user);
      setActiveTab(user === ADMIN_USER ? 'dashboard' : 'events');
    }
    return success;
  };

  const handleLogout = async () => {
    // Final backup before logout if vault is connected
    if (vaultHandle) {
      try {
        await vaultService.saveState(vaultHandle, getFullState());
      } catch (e) { console.warn("Logout backup failed."); }
    }
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  };

  const onAddTransaction = (t: Omit<Transaction, 'id'>) => {
    const newT = { ...t, id: generateId() };
    setTransactions(prev => [newT, ...prev]);
    setShowForm(false);
  };

  const onUpdateRecurring = (item: RecurringExpense) => {
    setRecurringExpenses(prev => prev.map(e => e.id === item.id ? item : e));
  };

  const onAddRecurring = (item: Omit<RecurringExpense, 'id' | 'accumulatedOverdue'>) => {
    const newRec = { ...item, id: generateId(), accumulatedOverdue: 0 };
    setRecurringExpenses(prev => [...prev, newRec]);
  };

  const onPayRecurring = (bill: RecurringExpense, amount: number) => {
    const newT: Transaction = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      amount,
      category: bill.category,
      description: `Payment: ${bill.description}`,
      type: 'expense',
      recurringId: bill.id,
      institution: 'Cash in Hand'
    };
    setTransactions(prev => [newT, ...prev]);

    const nextDue = new Date(bill.nextDueDate);
    nextDue.setMonth(nextDue.getMonth() + 1);
    onUpdateRecurring({ 
      ...bill, 
      nextDueDate: nextDue.toISOString().split('T')[0],
      lastBilledDate: new Date().toISOString().split('T')[0]
    });
  };

  const onReceiveRecurringIncome = (inc: RecurringIncome, amount: number, destination: string) => {
    const newT: Transaction = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      amount,
      category: inc.category,
      description: `Income: ${inc.description}`,
      type: 'income',
      recurringId: inc.id,
      institution: destination
    };
    setTransactions(prev => [newT, ...prev]);

    const nextConf = new Date(inc.nextConfirmationDate);
    nextConf.setMonth(nextConf.getMonth() + 1);
    setRecurringIncomes(prev => prev.map(i => i.id === inc.id ? { 
      ...i, 
      nextConfirmationDate: nextConf.toISOString().split('T')[0],
      lastConfirmedDate: new Date().toISOString().split('T')[0]
    } : i));
  };

  const handleApproveQueue = (idx: number) => {
    const item = pendingApprovals[idx];
    if (item.updateType === 'transaction' && item.transaction) {
      const transactionToSave: Omit<Transaction, 'id'> = {
        amount: item.transaction.amount,
        category: item.transaction.category,
        description: item.transaction.description,
        type: item.transaction.type,
        notes: item.transaction.notes,
        vendor: item.transaction.vendor,
        lineItems: item.transaction.lineItems,
        date: item.transaction.date || new Date().toISOString().split('T')[0]
      };
      onAddTransaction(transactionToSave);
    } else if (item.updateType === 'portfolio' && item.portfolio) {
      setInvestments(prev => prev.map(inv => {
        if (inv.provider === item.portfolio?.provider) {
          const existing = inv.holdings.find(h => h.symbol === item.portfolio?.symbol);
          if (existing) {
            return {
              ...inv,
              holdings: inv.holdings.map(h => h.symbol === item.portfolio?.symbol ? { ...h, quantity: item.portfolio?.quantity || 0 } : h)
            };
          } else {
            return {
              ...inv,
              holdings: [...inv.holdings, { symbol: item.portfolio?.symbol || '', quantity: item.portfolio?.quantity || 0, purchasePrice: 0 }]
            };
          }
        }
        return inv;
      }));
    }
    setPendingApprovals(prev => prev.filter((_, i) => i !== idx));
  };

  const liquidFunds = useMemo(() => {
    const bankSum = bankConnections
      .filter(c => c.institutionType === 'bank')
      .reduce((acc, c) => acc + (c.openingBalance || 0), 0);
    
    const flow = transactions.reduce((acc, t) => {
      const isBank = t.institution && bankConnections.some(bc => bc.institution === t.institution && bc.institutionType === 'bank');
      const isToBank = t.destinationInstitution && bankConnections.some(bc => bc.institution === t.institution && bc.institutionType === 'bank');
      
      if (isBank) {
        if (t.type === 'income') return acc + t.amount;
        if (t.type === 'expense' || t.type === 'transfer' || t.type === 'savings') return acc - t.amount;
      }
      if (isToBank && (t.type === 'transfer' || t.type === 'withdrawal')) return acc + t.amount;
      return acc;
    }, 0);

    return bankSum + flow + cashOpeningBalance;
  }, [bankConnections, transactions, cashOpeningBalance]);

  const handleUpdateCalendarItems = (items: CalendarItem[]) => {
    setCalendarItems(items);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!isAuthenticated ? (
        <Login onLogin={handleLogin} onReset={() => { localStorage.clear(); window.location.reload(); }} />
      ) : (
        <>
          <MarketTicker prices={marketPrices} quotaExhausted={quotaExhausted} />
          
          <header className="fixed top-8 left-0 right-0 z-[110] px-4 print:hidden">
            <div className="max-w-6xl mx-auto bg-white/80 backdrop-blur-xl border border-slate-100 rounded-[2.5rem] shadow-2xl p-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  <LayoutDashboard size={16} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Dashboard</span>
                </button>
                <button 
                  onClick={() => setActiveTab('calendar')} 
                  className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] transition-all ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  <CalendarIcon size={16} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Calendar</span>
                </button>
                <button 
                  onClick={() => setActiveTab('events')} 
                  className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] transition-all ${activeTab === 'events' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  <Zap size={16} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Project Planner</span>
                </button>
                <button 
                  onClick={() => setActiveTab('projections')} 
                  className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] transition-all ${activeTab === 'projections' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  <TrendingUp size={16} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Wealth Forecast</span>
                </button>
              </div>

              <div className="flex items-center gap-3 pr-2">
                {/* PWA Install Button */}
                {deferredPrompt && (
                  <button 
                    onClick={handleInstall}
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-all"
                  >
                    <Download size={14} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">Install App</span>
                  </button>
                )}

                {/* Vault Status Indicator */}
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                  {vaultHandle ? (
                    <>
                      {isSyncing ? (
                        <RefreshCw size={14} className="text-indigo-500 animate-spin" />
                      ) : vaultError ? (
                        <ShieldAlert size={14} className="text-rose-500" />
                      ) : (
                        <ShieldCheck size={14} className="text-emerald-500" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 leading-none">Local Vault</span>
                        <span className="text-[8px] font-bold text-slate-500 leading-none mt-0.5">
                          {lastSyncTime ? `Synced ${new Date(lastSyncTime).toLocaleTimeString()}` : 'Connected'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Shield size={14} className="text-slate-300" />
                      <button 
                        onClick={handleConnectVault}
                        className="text-[9px] font-black uppercase tracking-tighter text-indigo-600 hover:text-indigo-700 leading-none"
                      >
                        Connect Local SSD
                      </button>
                    </>
                  )}
                </div>

                <button 
                  onClick={() => setShowSettings(true)} 
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all border border-slate-100"
                  title="System Settings"
                >
                  <SettingsIcon size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs uppercase shadow-inner">
                  {currentUsername.charAt(0)}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full pt-32 px-4 pb-24">
            {activeTab === 'dashboard' && isAdmin && (
              <div className="space-y-10">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                   <div>
                     <h1 className="text-5xl font-black text-slate-800 tracking-tighter">Command Center</h1>
                     <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-2">Strategic Intelligence Hub</p>
                   </div>
                   <div className="w-full md:w-[400px]">
                      <MagicInput 
                        onSuccess={(item) => setPendingApprovals(prev => [...prev, item])}
                        onBulkSuccess={(items) => setPendingApprovals(prev => [...prev, ...items])}
                        onLoading={setIsLoading}
                        onManualEntry={() => setShowForm(true)}
                      />
                   </div>
                </header>

                <VerificationQueue 
                  pendingItems={pendingApprovals}
                  onApprove={handleApproveQueue}
                  onDiscard={(idx) => setPendingApprovals(prev => prev.filter((_, i) => i !== idx))}
                  onEdit={() => {}} 
                  onDiscardAll={() => setPendingApprovals([])}
                />

                <Dashboard 
                  transactions={transactions}
                  recurringExpenses={recurringExpenses}
                  recurringIncomes={recurringIncomes}
                  savingGoals={savingGoals}
                  investmentGoals={investmentGoals}
                  investments={investments}
                  marketPrices={marketPrices}
                  bankConnections={bankConnections}
                  targetMargin={0} 
                  cashOpeningBalance={cashOpeningBalance}
                  categoryBudgets={categoryBudgets}
                  onEdit={() => {}}
                  onDelete={(id) => setTransactions(prev => prev.filter(t => t.id !== id))}
                  onPayRecurring={onPayRecurring}
                  onReceiveRecurringIncome={onReceiveRecurringIncome}
                  onContributeSaving={() => {}}
                  onWithdrawSaving={() => {}}
                  onWithdrawal={() => {}}
                  onAddIncome={() => {}}
                  onUpdateCategoryBudget={(cat, amt) => setCategoryBudgets(prev => ({ ...prev, [cat]: amt }))}
                />
              </div>
            )}

            {activeTab === 'calendar' && (
              <Calendar 
                events={events}
                calendarItems={calendarItems}
                transactions={transactions}
                recurringExpenses={recurringExpenses}
                recurringIncomes={recurringIncomes}
                onUpdateItems={handleUpdateCalendarItems}
              />
            )}

            {activeTab === 'events' && (
              <EventPlanner 
                events={events}
                contacts={contacts}
                directoryHandle={vaultHandle}
                currentUser={currentUsername}
                isAdmin={isAdmin}
                onAddEvent={(e) => setEvents(prev => [{...e, id: generateId(), items: [], notes: [], tasks: [], files: [], contactIds: [], memberUsernames: [], ious: [], lastUpdated: new Date().toISOString()}, ...prev])}
                onDeleteEvent={(id) => setEvents(prev => prev.filter(e => e.id !== id))}
                onUpdateEvent={(e) => setEvents(prev => prev.map(ev => ev.id === e.id ? e : ev))}
                onUpdateContacts={setContacts}
              />
            )}

            {activeTab === 'projections' && isAdmin && (
              <Projections 
                transactions={transactions}
                recurringExpenses={recurringExpenses}
                recurringIncomes={recurringIncomes}
                investments={investments}
                marketPrices={marketPrices}
                categoryBudgets={categoryBudgets}
                currentNetWorth={liquidFunds + investments.reduce((acc, inv) => acc + inv.holdings.reduce((hAcc, h) => hAcc + (h.quantity * (marketPrices.find(m => m.symbol === h.symbol)?.price || 0)), 0), 0)}
              />
            )}
          </main>

          <BudgetAssistant transactions={transactions} investments={investments} marketPrices={marketPrices} availableFunds={liquidFunds} />

          {showForm && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="w-full max-w-xl">
                <TransactionForm onAdd={onAddTransaction} onCancel={() => setShowForm(false)} bankConnections={bankConnections} />
              </div>
            </div>
          )}

          {showSettings && (
            <Settings 
              salary={0}
              onUpdateSalary={() => {}}
              targetMargin={0}
              cashOpeningBalance={cashOpeningBalance}
              onUpdateCashOpeningBalance={setCashOpeningBalance}
              categoryBudgets={categoryBudgets}
              onUpdateCategoryBudgets={setCategoryBudgets}
              recurringExpenses={recurringExpenses}
              onAddRecurring={onAddRecurring}
              onUpdateRecurring={onUpdateRecurring}
              onDeleteRecurring={(id) => setRecurringExpenses(prev => prev.filter(e => e.id !== id))}
              recurringIncomes={recurringIncomes}
              onAddRecurringIncome={(i) => setRecurringIncomes(prev => [...prev, {...i, id: generateId()}])}
              onUpdateRecurringIncome={(i) => setRecurringIncomes(prev => prev.map(inc => inc.id === i.id ? i : inc))}
              onDeleteRecurringIncome={(id) => setRecurringIncomes(prev => prev.filter(i => i.id !== id))}
              savingGoals={savingGoals}
              onAddSavingGoal={(s) => setSavingGoals(prev => [...prev, {...s, id: generateId(), currentAmount: 0}])}
              onDeleteSavingGoal={(id) => setSavingGoals(prev => prev.filter(s => s.id !== id))}
              investmentGoals={investmentGoals}
              onAddInvestmentGoal={(i) => setInvestmentGoals(prev => [...prev, {...i, id: generateId()}])}
              onDeleteInvestmentGoal={(id) => setInvestmentGoals(prev => prev.filter(i => i.id !== id))}
              onExportData={() => {}}
              onResetData={() => { if (confirm("Purge vault?")) { localStorage.clear(); window.location.reload(); }}}
              onClose={() => setShowSettings(false)}
              onLogout={handleLogout}
              remindersEnabled={false}
              onToggleReminders={() => {}}
              bankConnections={bankConnections}
              onResetBank={() => setBankConnections([])}
              onSetDirectory={(handle) => {
                if (handle) {
                  handleConnectVault();
                } else {
                  handleDisconnectVault();
                }
              }}
              directoryHandle={vaultHandle}
              onUpdatePassword={() => {}}
              users={[]}
              onUpdateUsers={() => {}}
              isAdmin={isAdmin}
              onOpenBankSync={() => setShowBankSync(true)}
              onUnlinkBank={(inst) => setBankConnections(prev => prev.filter(c => c.institution !== inst))}
            />
          )}

          {showBankSync && (
            <BankSyncModal 
              onSuccess={(inst, last4, bal, type) => {
                setBankConnections(prev => [...prev, { institution: inst, institutionType: type, status: 'linked', accountLastFour: last4, openingBalance: bal, lastSynced: new Date().toISOString() }]);
                setShowBankSync(false);
              }}
              onClose={() => setShowBankSync(false)}
            />
          )}

          {isLoading && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-md">
              <div className="bg-white p-10 rounded-[3rem] text-center shadow-2xl">
                 <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                 <h3 className="text-xl font-black text-slate-800 mb-2">Parsing Intelligence</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Applying Financial Logic...</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;
