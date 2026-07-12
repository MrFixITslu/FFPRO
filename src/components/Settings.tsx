
import React, { useState, useMemo, useRef } from 'react';
import { CATEGORIES, RecurringExpense, RecurringIncome, SavingGoal, BankConnection, InvestmentGoal, StoredUser, STORAGE_KEYS } from '../types';
import { triggerSecureDownload } from '../services/fileStorageService';
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Database, 
  Key, 
  Bell, 
  LogOut, 
  HardDrive, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2, 
  Plus, 
  X,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  salary: number;
  onUpdateSalary: (val: number) => void;
  targetMargin: number;
  cashOpeningBalance: number;
  onUpdateCashOpeningBalance: (val: number) => void;
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (budgets: Record<string, number>) => void;
  recurringExpenses: RecurringExpense[];
  onAddRecurring: (item: Omit<RecurringExpense, 'id' | 'accumulatedOverdue'>) => void;
  onUpdateRecurring: (item: RecurringExpense) => void;
  onDeleteRecurring: (id: string) => void;
  recurringIncomes: RecurringIncome[];
  onAddRecurringIncome: (item: Omit<RecurringIncome, 'id'>) => void;
  onUpdateRecurringIncome: (item: RecurringIncome) => void;
  onDeleteRecurringIncome: (id: string) => void;
  savingGoals: SavingGoal[];
  onAddSavingGoal: (item: Omit<SavingGoal, 'id' | 'currentAmount'>) => void;
  onDeleteSavingGoal: (id: string) => void;
  investmentGoals: InvestmentGoal[];
  onAddInvestmentGoal: (item: Omit<InvestmentGoal, 'id'>) => void;
  onDeleteInvestmentGoal: (id: string) => void;
  onExportData: () => void;
  onResetData: () => void;
  onClose: () => void;
  onLogout: () => void;
  remindersEnabled: boolean;
  onToggleReminders: (enabled: boolean) => void;
  bankConnections: BankConnection[];
  onResetBank: () => void;
  onUpdatePassword: (newPass: string) => void;
  users: StoredUser[];
  onUpdateUsers: (users: StoredUser[]) => void;
  isAdmin: boolean;
  onOpenBankSync?: () => void;
  onUnlinkBank?: (inst: string) => void;
}

type SettingsTab = 'general' | 'recurring' | 'goals' | 'api' | 'security';

const Settings: React.FC<Props> = ({ 
  targetMargin, categoryBudgets, onUpdateCategoryBudgets, 
  cashOpeningBalance, onUpdateCashOpeningBalance,
  recurringExpenses, onAddRecurring, onUpdateRecurring, onDeleteRecurring,
  recurringIncomes, onAddRecurringIncome, onUpdateRecurringIncome, onDeleteRecurringIncome,
  savingGoals, onAddSavingGoal, onDeleteSavingGoal,
  investmentGoals, onAddInvestmentGoal, onDeleteInvestmentGoal,
  onResetData, onClose, onLogout, 
  onUpdatePassword, bankConnections,
  onOpenBankSync, onUnlinkBank,
  isAdmin
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passForm, setPassForm] = useState({ new: '', confirm: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Temp form states for adding new items
  const [newRec, setNewRec] = useState({ description: '', amount: '', category: CATEGORIES[0], nextDate: new Date().toISOString().split('T')[0] });
  const [newInc, setNewInc] = useState({ description: '', amount: '', nextDate: new Date().toISOString().split('T')[0] });
  const [newGoal, setNewGoal] = useState({ name: '', target: '', category: CATEGORIES[0] });

  // Edit states
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [editingIncId, setEditingIncId] = useState<string | null>(null);
  const [editRecData, setEditRecData] = useState<RecurringExpense | null>(null);
  const [editIncData, setEditIncData] = useState<RecurringIncome | null>(null);

  const liquidAssetBuffer = useMemo(() => {
    const totalOnlyBanks: number = (bankConnections || [])
      .filter(c => c.institutionType === 'bank')
      .reduce((acc: number, c) => acc + (c.openingBalance || 0), 0);
    
    const totalLiquid: number = totalOnlyBanks + cashOpeningBalance;
    const totalThresholds: number = (Object.values(categoryBudgets || {}) as number[]).reduce((acc: number, val: number) => acc + (val || 0), 0);
    const totalRecurring: number = (recurringExpenses || []).reduce((acc: number, exp) => acc + (exp.amount || 0), 0);
    
    return totalLiquid - (totalThresholds + totalRecurring);
  }, [bankConnections, cashOpeningBalance, categoryBudgets, recurringExpenses]);

  const monthlyCashflowSurplus = useMemo(() => {
    const monthlyIncomeTotal = (recurringIncomes || []).reduce((acc, inc) => acc + (inc.amount || 0), 0);
    const monthlyCommitmentsTotal = (recurringExpenses || []).reduce((acc, exp) => acc + (exp.amount || 0), 0) + 
      (Object.values(categoryBudgets || {}) as number[]).reduce((acc, val) => acc + (val || 0), 0);
    
    return monthlyIncomeTotal - monthlyCommitmentsTotal;
  }, [recurringIncomes, recurringExpenses, categoryBudgets]);

  const handleExportBackup = () => {
    const backupData: Record<string, string | null> = {};
    Object.values(STORAGE_KEYS).forEach(key => {
      backupData[key] = localStorage.getItem(key);
    });
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    triggerSecureDownload(blob, `fire_finance_backup_${timestamp}.json`);
  };

  const handleImportRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm("RESTORE WARNING: This will overwrite ALL current vault data. This action cannot be undone. Proceed?")) {
          Object.keys(data).forEach(key => {
            if (data[key] !== null) {
              localStorage.setItem(key, data[key]);
            }
          });
          alert("Vault Data Restored Successfully. Terminal will now reload.");
          window.location.reload();
        }
      } catch (err) {
        alert("CRITICAL ERROR: Invalid backup file structure.");
      }
    };
    reader.readAsText(file);
  };

  const handleBudgetChange = (category: string, value: string) => {
    onUpdateCategoryBudgets({ ...categoryBudgets, [category]: parseFloat(value) || 0 });
  };

  const handlePasswordSubmit = () => {
    if (!passForm.new || passForm.new.length < 4) return alert('Min 4 chars');
    if (passForm.new !== passForm.confirm) return alert('Mismatch');
    onUpdatePassword(passForm.new);
    setIsChangingPass(false);
    setPassForm({ new: '', confirm: '' });
    alert("Vault credentials updated.");
  };

  const startEditRec = (exp: RecurringExpense) => {
    setEditingRecId(exp.id);
    setEditRecData({ ...exp });
  };

  const startEditInc = (inc: RecurringIncome) => {
    setEditingIncId(inc.id);
    setEditIncData({ ...inc });
  };

  const saveEditRec = () => {
    if (editRecData) {
      // Also update dayOfMonth in case nextDueDate changed
      const d = new Date(editRecData.nextDueDate);
      editRecData.dayOfMonth = d.getDate();
      onUpdateRecurring(editRecData);
      setEditingRecId(null);
      setEditRecData(null);
    }
  };

  const saveEditInc = () => {
    if (editIncData) {
      const d = new Date(editIncData.nextConfirmationDate);
      editIncData.dayOfMonth = d.getDate();
      onUpdateRecurringIncome(editIncData);
      setEditingIncId(null);
      setEditIncData(null);
    }
  };

  const tabs: {id: SettingsTab, label: string, icon: string}[] = [
    { id: 'general', label: 'Core', icon: 'fa-sliders-h' },
    { id: 'recurring', label: 'Recurring', icon: 'fa-redo' },
    { id: 'goals', label: 'Targets', icon: 'fa-bullseye' },
    { id: 'api', label: 'Gateways', icon: 'fa-plug' },
    { id: 'security', label: 'System', icon: 'fa-shield-halved' },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 h-[85vh] flex flex-col md:flex-row">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-150 flex flex-col p-5 overflow-x-auto no-scrollbar">
          <div className="mb-6 hidden md:block">
            <h2 className="text-lg font-bold text-slate-800">Vault Settings</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Logic Center</p>
          </div>
          
          <div className="flex md:flex-col gap-1.5 flex-nowrap">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
              >
                <i className={`fas ${tab.icon} w-3.5`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-4 hidden md:block">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-50 transition">
              <i className="fas fa-power-off text-xs"></i> Logout
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400 hover:text-slate-800 transition shadow-sm z-10"><i className="fas fa-times text-xs"></i></button>

          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><i className="fas fa-coins text-indigo-600 text-xs"></i> Financial Baseline</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Opening Cash Ledger</label>
                    <input 
                      type="number" 
                      value={cashOpeningBalance} 
                      onChange={(e) => onUpdateCashOpeningBalance(parseFloat(e.target.value) || 0)} 
                      className="w-full bg-white border border-slate-250 rounded px-3 py-2 text-base font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
                    />
                  </div>
                  <div className="p-5 bg-indigo-50/50 rounded-lg border border-indigo-100 flex flex-col justify-between">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Monthly Surplus Target</label>
                      <p className={`text-xl font-bold ${monthlyCashflowSurplus >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        ${monthlyCashflowSurplus.toLocaleString()}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Monthly Flow: Income - Commitments</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-indigo-100">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1 block opacity-80">Liquid Asset Buffer</label>
                      <p className={`text-xs font-bold ${liquidAssetBuffer >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        ${liquidAssetBuffer.toLocaleString()}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Vault Safety: (Banks + Cash) - Total Commitments</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><i className="fas fa-layer-group text-indigo-600 text-xs"></i> Spending Thresholds</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CATEGORIES.filter(c => !['Income', 'Savings', 'Investments', 'Other', 'Transfer'].includes(c)).map(cat => (
                    <div key={cat} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{cat}</p>
                      <input 
                        type="number" 
                        value={categoryBudgets[cat] || ''} 
                        onChange={(e) => handleBudgetChange(cat, e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'recurring' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800">Recurring Commitments</h3>
                  <span className="text-[9px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 px-2.5 py-0.5 rounded uppercase tracking-wider">Fixed Expenses</span>
                </div>
                
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {recurringExpenses.map(exp => (
                    <div key={exp.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-3 group">
                      {editingRecId === exp.id ? (
                        <div className="space-y-3 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={editRecData?.description} onChange={e => setEditRecData(prev => prev ? {...prev, description: e.target.value} : null)} className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold" placeholder="Description" />
                            <input type="number" value={editRecData?.amount} onChange={e => setEditRecData(prev => prev ? {...prev, amount: parseFloat(e.target.value) || 0} : null)} className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold" placeholder="Amount" />
                            <select value={editRecData?.category} onChange={e => setEditRecData(prev => prev ? {...prev, category: e.target.value} : null)} className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold">
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="date" value={editRecData?.nextDueDate} onChange={e => setEditRecData(prev => prev ? {...prev, nextDueDate: e.target.value} : null)} className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEditRec} className="flex-1 py-1.5 bg-indigo-600 text-white rounded text-[9px] font-bold uppercase tracking-wider">Save Changes</button>
                            <button onClick={() => { setEditingRecId(null); setEditRecData(null); }} className="flex-1 py-1.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center text-rose-500 shadow-sm"><i className="fas fa-calendar-minus text-xs"></i></div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{exp.description}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">${exp.amount} • {exp.category} • Next: {new Date(exp.nextDueDate).toLocaleDateString('default', { day: 'numeric', month: 'short' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEditRec(exp)} title="Edit Commitment" className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-indigo-600 transition-colors"><i className="fas fa-pencil-alt text-xs"></i></button>
                            <button onClick={() => onDeleteRecurring(exp.id)} title="Remove Commitment" className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-alt text-xs"></i></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-5 bg-slate-900 rounded-lg border border-slate-800 text-white shadow-sm">
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mb-3">Register New Recurring Bill</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" placeholder="Description" value={newRec.description} onChange={e => setNewRec({...newRec, description: e.target.value})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500" />
                    <input type="number" placeholder="Amount" value={newRec.amount} onChange={e => setNewRec({...newRec, amount: e.target.value})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500" />
                    <select value={newRec.category} onChange={e => setNewRec({...newRec, category: e.target.value})} className="bg-slate-850 border border-white/10 rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-300">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div>
                      <input type="date" value={newRec.nextDate} onChange={e => setNewRec({...newRec, nextDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-300" />
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (!newRec.description || !newRec.amount) return;
                      const nextD = new Date(newRec.nextDate);
                      onAddRecurring({ 
                        description: newRec.description, 
                        amount: parseFloat(newRec.amount), 
                        category: newRec.category, 
                        dayOfMonth: nextD.getDate(), 
                        nextDueDate: nextD.toISOString().split('T')[0] 
                      });
                      setNewRec({ description: '', amount: '', category: CATEGORIES[0], nextDate: new Date().toISOString().split('T')[0] });
                    }} 
                    className="w-full py-2 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-500 transition shadow-sm"
                  >Authorize Commitment</button>
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800">Recurring Inflows</h3>
                  <span className="text-[9px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-600 px-2.5 py-0.5 rounded uppercase tracking-wider">Income Sources</span>
                </div>
                
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {recurringIncomes.map(inc => (
                    <div key={inc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-3">
                      {editingIncId === inc.id ? (
                        <div className="space-y-3 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={editIncData?.description} onChange={e => setEditIncData(prev => prev ? {...prev, description: e.target.value} : null)} className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold" placeholder="Description" />
                            <input type="number" value={editIncData?.amount} onChange={e => setEditIncData(prev => prev ? {...prev, amount: parseFloat(e.target.value) || 0} : null)} className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold" placeholder="Amount" />
                            <div className="col-span-2">
                              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Next Income Date</label>
                              <input type="date" value={editIncData?.nextConfirmationDate} onChange={e => setEditIncData(prev => prev ? {...prev, nextConfirmationDate: e.target.value} : null)} className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEditInc} className="flex-1 py-1.5 bg-emerald-600 text-white rounded text-[9px] font-bold uppercase tracking-wider">Save Changes</button>
                            <button onClick={() => { setEditingIncId(null); setEditIncData(null); }} className="flex-1 py-1.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center text-emerald-500 shadow-sm"><i className="fas fa-calendar-plus text-xs"></i></div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{inc.description}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">${inc.amount} • {inc.category} • Next: {new Date(inc.nextConfirmationDate).toLocaleDateString('default', { day: 'numeric', month: 'short' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEditInc(inc)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-indigo-600 transition-colors"><i className="fas fa-pencil-alt text-xs"></i></button>
                            <button onClick={() => onDeleteRecurringIncome(inc.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-alt text-xs"></i></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-5 bg-slate-900 rounded-lg border border-slate-800 text-white shadow-sm">
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 mb-3">Register Recurring Income</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" placeholder="Source (e.g. Salary, Rent)" value={newInc.description} onChange={e => setNewInc({...newInc, description: e.target.value})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500" />
                    <input type="number" placeholder="Amount" value={newInc.amount} onChange={e => setNewInc({...newInc, amount: e.target.value})} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500" />
                    <div className="col-span-2">
                      <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500 ml-1 block mb-1">Expected Next Receipt Date</label>
                      <input type="date" value={newInc.nextDate} onChange={e => setNewInc({...newInc, nextDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500 text-slate-300" />
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (!newInc.description || !newInc.amount) return;
                      const nextD = new Date(newInc.nextDate);
                      onAddRecurringIncome({ 
                        description: newInc.description, 
                        amount: parseFloat(newInc.amount), 
                        category: 'Income', 
                        dayOfMonth: nextD.getDate(), 
                        nextConfirmationDate: nextD.toISOString().split('T')[0] 
                      });
                      setNewInc({ description: '', amount: '', nextDate: new Date().toISOString().split('T')[0] });
                    }} 
                    className="w-full py-2 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500 transition shadow-sm"
                  >Register Inflow</button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><i className="fas fa-mountain-sun text-indigo-600 text-xs"></i> Active Saving Goals</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {savingGoals.map(goal => (
                    <div key={goal.id} className="p-5 bg-slate-50 border border-slate-200 rounded-lg relative group">
                      <div className="flex justify-between items-start mb-3">
                        <p className="font-bold text-slate-800 text-xs">{goal.name}</p>
                        <button onClick={() => onDeleteSavingGoal(goal.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-times text-xs"></i></button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <span>Progress</span>
                          <span className="text-indigo-600 font-semibold">${goal.currentAmount} / ${goal.targetAmount}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${(goal.currentAmount/goal.targetAmount)*100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 border border-dashed border-slate-300 rounded-lg text-center bg-slate-50/50">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Initialize New Objective</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto">
                    <input type="text" placeholder="Goal Name (e.g. New Car)" value={newGoal.name} onChange={e => setNewGoal({...newGoal, name: e.target.value})} className="px-3 py-1.5 bg-white border border-slate-200 rounded outline-none font-semibold text-xs" />
                    <input type="number" placeholder="Target Amount" value={newGoal.target} onChange={e => setNewGoal({...newGoal, target: e.target.value})} className="px-3 py-1.5 bg-white border border-slate-200 rounded outline-none font-semibold text-xs" />
                    <button 
                      onClick={() => {
                        if (!newGoal.name || !newGoal.target) return;
                        onAddSavingGoal({ name: newGoal.name, targetAmount: parseFloat(newGoal.target), institution: 'Savings Account', institutionType: 'bank', openingBalance: 0, category: 'Savings' });
                        setNewGoal({ name: '', target: '', category: CATEGORIES[0] });
                      }}
                      className="md:col-span-2 py-2 bg-slate-900 text-white font-bold rounded text-[10px] uppercase tracking-wider hover:bg-indigo-600 transition shadow-sm"
                    >Activate Goal Matrix</button>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><i className="fas fa-rocket text-indigo-600 text-xs"></i> Investment Targets</h3>
                <div className="grid grid-cols-1 gap-2">
                  {investmentGoals.map(goal => (
                    <div key={goal.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{goal.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Target: ${goal.targetAmount} • Provider: {goal.provider}</p>
                      </div>
                      <button onClick={() => onDeleteInvestmentGoal(goal.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt text-xs"></i></button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Managed API Connections</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Banks & Investment Portals</p>
                  </div>
                  <button 
                    onClick={onOpenBankSync}
                    className="px-4 py-2 bg-slate-900 text-white rounded text-[10px] font-bold uppercase tracking-wider shadow hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-plus text-[10px]"></i> Link New
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {bankConnections.map(conn => (
                    <div key={conn.institution} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center text-indigo-600 shadow-sm">
                          <i className={`fas ${conn.institutionType === 'investment' ? 'fa-chart-line' : 'fa-landmark'} text-xs`}></i>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{conn.institution}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            {conn.institutionType} • {conn.accountLastFour}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Status: Linked</p>
                          <p className="text-[8px] text-slate-400 font-bold">Synced: {conn.lastSynced ? new Date(conn.lastSynced).toLocaleTimeString() : 'Never'}</p>
                        </div>
                        <button onClick={() => onUnlinkBank?.(conn.institution)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors">
                          <i className="fas fa-unlink text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <section className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2.5"><i className="fas fa-shield-virus text-indigo-600 text-xs"></i> Authentication Logic</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <button onClick={() => setIsChangingPass(true)} className="flex-1 py-2 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition shadow-sm">Rotate Credentials</button>
                    <button onClick={onResetData} className="flex-1 py-2 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-50 transition shadow-sm">Factory Purge</button>
                  </div>
                </div>
              </section>

              <section className="bg-white p-5 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2.5">
                  <Download className="text-indigo-600 text-xs" size={16} /> Backup & Restore
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button 
                    onClick={handleExportBackup}
                    className="py-2.5 bg-indigo-600 text-white font-bold rounded shadow-sm uppercase tracking-wider text-[10px] hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Manual Export
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 bg-slate-100 text-slate-600 font-bold rounded shadow-sm uppercase tracking-wider text-[10px] hover:bg-slate-200 transition flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <Upload size={14} /> Import Backup
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json"
                    onChange={handleImportRestore} 
                  />
                </div>
              </section>

              <button onClick={onLogout} className="w-full py-3 bg-slate-900 text-white font-bold rounded text-[10px] uppercase tracking-wider hover:bg-rose-600 transition-all shadow flex items-center justify-center gap-2">
                <Lock size={14} /> Close Vault & Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {isChangingPass && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-lg p-6 border border-slate-200 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 mb-1">Security Update</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-6">Update Vault Credentials</p>
            <div className="space-y-4">
              <div className="relative">
                <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                <input type="password" value={passForm.new} onChange={e => setPassForm({...passForm, new: e.target.value})} className="w-full pl-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded outline-none font-semibold text-slate-800 text-xs" placeholder="New Password" />
              </div>
              <div className="relative">
                <i className="fas fa-check-double absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                <input type="password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} className="w-full pl-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded outline-none font-semibold text-slate-800 text-xs" placeholder="Confirm Password" />
              </div>
              <button onClick={handlePasswordSubmit} className="w-full py-2.5 bg-slate-900 text-white font-bold rounded shadow-sm uppercase tracking-wider text-[10px] hover:bg-indigo-600 transition active:scale-95">Apply Cryptography</button>
              <button onClick={() => setIsChangingPass(false)} className="w-full py-1 text-slate-400 font-bold text-[9px] uppercase tracking-wider">Abort Process</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
