
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Login from './components/Login';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import BankSyncModal from './components/BankSyncModal';
import EventPlanner from './components/EventPlanner';
import Projections from './components/Projections';
import Calendar from './components/Calendar';
import { 
  Transaction, 
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
import { authService, AuthUser } from './services/authService';
import { dataSyncService, SyncConflictError } from './services/dataSyncService';
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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const isAuthenticated = !!authUser;
  const currentUsername = authUser?.username || authUser?.displayName || (authUser?.email ? authUser.email.split('@')[0] : '');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'events' | 'projections'>('dashboard');

  // Restore session (cookie-based) from the backend on load, including right after
  // an OAuth provider redirects back here.
  useEffect(() => {
    let cancelled = false;
    authService.me()
      .then((user) => {
        if (cancelled) return;
        setAuthUser(user);
        if (user) {
          setActiveTab('dashboard');
        }
      })
      .catch(() => { if (!cancelled) setAuthUser(null); })
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Fetch and poll real-time market prices from our public endpoint
  useEffect(() => {
    let active = true;
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/ai/market-data');
        if (res.ok && active) {
          const data = await res.json();
          if (data && Array.isArray(data.prices) && data.prices.length > 0) {
            setMarketPrices(data.prices);
            setQuotaExhausted(!!data.quotaExhausted);
          }
        }
      } catch (err) {
        console.error('Failed to fetch real-time market prices:', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // refresh every 30 seconds
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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
    { symbol: 'BTC', price: 64000.00, change24h: 1.2 },
    { symbol: 'ETH', price: 1820.00, change24h: -0.5 },
    { symbol: 'SOL', price: 77.00, change24h: 3.4 },
    { symbol: 'VOO', price: 693.86, change24h: 0.2 },
    { symbol: 'VOOG', price: 83.31, change24h: 0.1 }
  ]);
  // Market prices are fully real-time and auto-refresh every 30 seconds via the public Kraken/Yahoo endpoint.
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBankSync, setShowBankSync] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vaultHandle, setVaultHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // --- Per-account cloud sync state ---
  const [cloudLoaded, setCloudLoaded] = useState(false); // has the initial pull for THIS account finished?
  const [cloudVersion, setCloudVersion] = useState(0);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudLastSyncTime, setCloudLastSyncTime] = useState<string | null>(null);

  const isAdmin = true;

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

  // Loads a full AppState (from the cloud or a vault backup) into local state.
  const applyRemoteState = useCallback((state: AppState) => {
    setTransactions(state.transactions || []);
    setRecurringExpenses(state.recurringExpenses || []);
    setRecurringIncomes(state.recurringIncomes || []);
    setSavingGoals(state.savingGoals || []);
    setInvestmentGoals(state.investmentGoals || []);
    setCategoryBudgets(state.categoryBudgets || {});
    setBankConnections(state.bankConnections || []);
    setInvestments(state.investments || []);
    setEvents(state.events || []);
    setCalendarItems(state.calendarItems || []);
    setContacts(state.contacts || []);
    setCashOpeningBalance(state.cashOpeningBalance || 0);
  }, []);

  // Wipes everything local — used when switching accounts on a shared browser
  // and on logout/purge, so one account's financial data can never bleed into
  // another session on the same device.
  const clearLocalData = useCallback(() => {
    setTransactions([]);
    setRecurringExpenses([]);
    setRecurringIncomes([]);
    setSavingGoals([]);
    setInvestmentGoals([]);
    setCategoryBudgets({});
    setBankConnections([]);
    setInvestments([]);
    setEvents([]);
    setCalendarItems([]);
    setContacts([]);
    setCashOpeningBalance(0);
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }, []);

  // --- Per-account cloud sync: initial load ---------------------------------
  // Runs whenever we get a confirmed logged-in user (fresh login, OAuth
  // redirect, or restored session on page load).
  useEffect(() => {
    if (!authChecked || !authUser) return;

    let cancelled = false;

    (async () => {
      // If this browser's local cache belongs to a DIFFERENT account (e.g. the
      // previous user closed the tab instead of logging out), wipe it first —
      // otherwise we'd either leak their data into this session or upload it
      // as if it were this account's data.
      const cachedOwner = localStorage.getItem(STORAGE_KEYS.DATA_OWNER);
      if (cachedOwner && cachedOwner !== authUser.id) {
        clearLocalData();
      }
      localStorage.setItem(STORAGE_KEYS.DATA_OWNER, authUser.id);

      setCloudError(null);
      setCloudSyncing(true);
      try {
        const remote = await dataSyncService.fetch();
        if (cancelled) return;
        if (remote.data) {
          applyRemoteState(remote.data);
          setCloudVersion(remote.version);
          setCloudLastSyncTime(remote.updatedAt);
        } else {
          // Nothing synced yet for this account — treat whatever's in this
          // (now confirmed same-owner, or freshly cleared) browser as the
          // starting point and push it up as version 1.
          const initial = getFullState();
          const result = await dataSyncService.save(initial, 0);
          if (cancelled) return;
          setCloudVersion(result.version);
          setCloudLastSyncTime(new Date().toISOString());
        }
      } catch (err: any) {
        const isAuthError = err?.message?.includes('Not authenticated') || err?.message?.includes('authentication') || err?.message?.includes('unauthorized') || String(err).includes('Not authenticated');
        if (isAuthError) {
          console.warn('Session expired or invalid during initial cloud sync. Resetting session.');
          if (!cancelled) {
            setAuthUser(null);
          }
        } else {
          console.error('Initial cloud sync failed:', err);
          if (!cancelled) setCloudError('Could not reach the cloud. Working locally until reconnected.');
        }
      } finally {
        if (!cancelled) {
          setCloudSyncing(false);
          setCloudLoaded(true);
        }
      }
    })();

    return () => { cancelled = true; };
    // Intentionally only re-runs when the authenticated user identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, authUser?.id]);

  // --- Per-account cloud sync: debounced autosave ---------------------------
  const pushToCloud = useCallback(async () => {
    if (!cloudLoaded) return;
    setCloudSyncing(true);
    setCloudError(null);
    try {
      const result = await dataSyncService.save(getFullState(), cloudVersion);
      setCloudVersion(result.version);
      setCloudLastSyncTime(new Date().toISOString());
    } catch (err) {
      if (err instanceof SyncConflictError) {
        // Someone else (another device/tab on this account) saved more
        // recently. Pull their copy rather than clobbering it — we surface
        // this so the user knows a just-made local edit may not have stuck.
        try {
          const remote = await dataSyncService.fetch();
          if (remote.data) {
            applyRemoteState(remote.data);
            setCloudVersion(remote.version);
            setCloudLastSyncTime(remote.updatedAt);
          }
          setCloudError('Data was updated on another device. The latest version has been loaded — please redo any change you just made here.');
        } catch (fetchErr) {
          console.error('Conflict recovery fetch failed:', fetchErr);
          setCloudError('Sync conflict detected, and reloading the latest data failed. Refresh the page.');
        }
      } else {
        const isAuthError = err?.message?.includes('Not authenticated') || err?.message?.includes('authentication') || err?.message?.includes('unauthorized') || String(err).includes('Not authenticated');
        if (isAuthError) {
          console.warn('Session expired or invalid during cloud sync. Resetting session.');
          setAuthUser(null);
          setCloudLoaded(false);
          setCloudVersion(0);
          setCloudError(null);
          setCloudLastSyncTime(null);
        } else {
          console.error('Cloud sync failed:', err);
          setCloudError('Could not save to the cloud. Your changes are still saved on this device.');
        }
      }
    } finally {
      setCloudSyncing(false);
    }
  }, [cloudLoaded, cloudVersion, getFullState, applyRemoteState]);

  useEffect(() => {
    if (!cloudLoaded) return;
    const timer = setTimeout(() => { pushToCloud(); }, 3000); // 3s debounce
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, recurringExpenses, recurringIncomes, savingGoals, investmentGoals, categoryBudgets, bankConnections, investments, events, calendarItems, contacts, cashOpeningBalance, cloudLoaded]);

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
    localStorage.setItem(STORAGE_KEYS.INVESTMENT_GOALS, JSON.stringify(investmentGoals));
    localStorage.setItem(STORAGE_KEYS.BANK_CONNECTIONS, JSON.stringify(bankConnections));
    localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments));
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    localStorage.setItem(STORAGE_KEYS.CALENDAR_ITEMS, JSON.stringify(calendarItems));
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    localStorage.setItem(STORAGE_KEYS.CATEGORY_LIMITS, JSON.stringify(categoryBudgets));
    localStorage.setItem(STORAGE_KEYS.CASH_OPENING, cashOpeningBalance.toString());
  }, [transactions, recurringExpenses, recurringIncomes, savingGoals, investmentGoals, bankConnections, investments, events, calendarItems, contacts, categoryBudgets, cashOpeningBalance]);

  // Market prices are entered/updated manually now (see Settings/Investments)
  // rather than auto-refreshed by an AI call. quotaExhausted is left `true`
  // (set above) so the ticker always honestly reads "Cached Data".

  const handleAuthenticated = (user: AuthUser) => {
    setAuthUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    // Final backup before logout if vault is connected
    if (vaultHandle) {
      try {
        await vaultService.saveState(vaultHandle, getFullState());
      } catch (e) { console.warn("Logout backup failed."); }
    }
    // Flush any pending edits to the cloud before we wipe local state.
    if (cloudLoaded) {
      try {
        await pushToCloud();
      } catch (e) { console.warn('Final cloud sync before logout failed.'); }
    }
    try {
      await authService.logout();
    } catch (e) {
      console.warn('Logout request failed, clearing local session state anyway.');
    }
    // Wipe the in-memory + localStorage copy of this account's data. Without
    // this, a second account signing in on the same browser would briefly
    // see (and could even overwrite) the previous account's data.
    clearLocalData();
    setCloudLoaded(false);
    setCloudVersion(0);
    setCloudError(null);
    setCloudLastSyncTime(null);
    setAuthUser(null);
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

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <i className="fas fa-circle-notch fa-spin text-indigo-400 text-3xl"></i>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!isAuthenticated ? (
        <Login onAuthenticated={handleAuthenticated} />
      ) : (
        <>
          <MarketTicker prices={marketPrices} quotaExhausted={quotaExhausted} />
          
          <header className="fixed top-9 left-0 right-0 h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-[110] print:hidden shadow-sm">
            <div className="flex items-center gap-6 w-full max-w-7xl mx-auto justify-between">
              <div className="flex items-center gap-8">
                {/* Logo & Brand from Design HTML */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
                    <span className="text-white font-bold text-xs">FF</span>
                  </div>
                  <h1 className="text-sm font-semibold tracking-tight uppercase text-indigo-900 hidden xs:block">
                    FFPRO <span className="font-normal text-slate-400">v4.2</span>
                  </h1>
                </div>

                {/* Minimalist Tabs */}
                <div className="flex items-center gap-1 sm:gap-2">
                  {isAdmin && (
                    <button 
                      onClick={() => setActiveTab('dashboard')} 
                      className={`flex items-center gap-1.5 px-3 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-4 ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                      <LayoutDashboard size={14} />
                      <span className="hidden md:inline">Dashboard</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveTab('calendar')} 
                    className={`flex items-center gap-1.5 px-3 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-4 ${activeTab === 'calendar' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                    <CalendarIcon size={14} />
                    <span className="hidden md:inline">Calendar</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('events')} 
                    className={`flex items-center gap-1.5 px-3 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-4 ${activeTab === 'events' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                    <Zap size={14} />
                    <span>Planner</span>
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => setActiveTab('projections')} 
                      className={`flex items-center gap-1.5 px-3 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-4 ${activeTab === 'projections' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                      <TrendingUp size={14} />
                      <span className="hidden md:inline">Forecast</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* PWA Install Button */}
                {deferredPrompt && (
                  <button 
                    onClick={handleInstall}
                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold uppercase tracking-wider border border-indigo-100 hover:bg-indigo-100 transition-all"
                  >
                    <Download size={12} />
                    <span>Install</span>
                  </button>
                )}

                {/* Cloud Sync Status Indicator */}
                <div
                  className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 rounded border border-slate-100"
                  title={cloudError || undefined}
                >
                  {cloudSyncing ? (
                    <RefreshCw size={12} className="text-indigo-500 animate-spin" />
                  ) : cloudError ? (
                    <ShieldAlert size={12} className="text-rose-500" />
                  ) : cloudLoaded ? (
                    <ShieldCheck size={12} className="text-emerald-500" />
                  ) : (
                    <Shield size={12} className="text-slate-300" />
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] font-bold uppercase tracking-tighter text-slate-400 leading-none">Cloud Sync</span>
                    <span className="text-[7px] font-medium text-slate-500 leading-none mt-0.5">
                      {cloudError
                        ? 'Attention'
                        : cloudLastSyncTime
                        ? `${new Date(cloudLastSyncTime).toLocaleTimeString()}`
                        : 'Connecting…'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setShowSettings(true)} 
                  className="w-8 h-8 flex items-center justify-center rounded bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all border border-slate-150"
                  title="System Settings"
                >
                  <SettingsIcon size={16} />
                </button>
                <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                  {currentUsername.charAt(0)}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full pt-32 px-6 pb-12">
            {activeTab === 'dashboard' && isAdmin && (
              <div className="space-y-8">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                   <div>
                     <h1 className="text-2xl font-light text-slate-800 tracking-tight">Command <span className="font-semibold text-slate-950">Center</span></h1>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Strategic Intelligence Hub</p>
                   </div>
                   <div className="w-full md:w-auto">
                      <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
                      >
                        <Plus size={14} />
                        Add Transaction
                      </button>
                   </div>
                </header>

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
                directoryHandle={null}
                currentUser={currentUsername}
                isAdmin={isAdmin}
                onAddEvent={(e) => setEvents(prev => [{
                  ...e,
                  id: generateId(),
                  items: e.items || [],
                  notes: e.notes || [],
                  tasks: e.tasks || [],
                  files: e.files || [],
                  contactIds: e.contactIds || [],
                  memberUsernames: e.memberUsernames || [],
                  ious: e.ious || [],
                  lastUpdated: new Date().toISOString()
                }, ...prev])}
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
              onResetData={() => {
                if (!confirm("Purge all data for this account? This clears both this device and your cloud-synced copy, and cannot be undone.")) return;
                dataSyncService.clear()
                  .catch((e) => console.warn('Cloud purge failed (continuing with local purge):', e))
                  .finally(() => { localStorage.clear(); window.location.reload(); });
              }}
              onClose={() => setShowSettings(false)}
              onLogout={handleLogout}
              remindersEnabled={false}
              onToggleReminders={() => {}}
              bankConnections={bankConnections}
              onResetBank={() => setBankConnections([])}
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
