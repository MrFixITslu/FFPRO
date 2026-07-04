
import React, { useState, useEffect } from 'react';
import { CATEGORIES, Transaction, TransactionType, LineItem, BankConnection } from '../types';

interface Props {
  onAdd: (t: Omit<Transaction, 'id'>) => void;
  initialData?: Partial<Transaction>;
  onCancel?: () => void;
  bankConnections?: BankConnection[];
}

const TransactionForm: React.FC<Props> = ({ onAdd, initialData, onCancel, bankConnections = [] }) => {
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || CATEGORIES[0]);
  const [desc, setDesc] = useState(initialData?.description || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [vendor, setVendor] = useState(initialData?.vendor || '');
  const [institution, setInstitution] = useState(initialData?.institution || 'Cash in Hand');
  const [destinationInstitution, setDestinationInstitution] = useState(initialData?.destinationInstitution || '1st National Bank St. Lucia');
  const [lineItems, setLineItems] = useState<LineItem[]>(initialData?.lineItems || []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const amt = parseFloat(amount);
    
    if (isNaN(amt) || amt <= 0) {
      newErrors.amount = "Enter a positive number";
    }
    
    if (!desc || !desc.trim()) {
      newErrors.description = "Description cannot be empty";
    }

    if (type === 'transfer' && institution === destinationInstitution) {
      newErrors.destination = "Source and destination must be different";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    onAdd({
      amount: parseFloat(amount),
      category: type === 'transfer' ? 'Transfer' : category,
      description: desc.trim(),
      notes: notes.trim() || undefined,
      type,
      date,
      vendor: vendor.trim() || undefined,
      institution,
      destinationInstitution: type === 'transfer' ? destinationInstitution : undefined,
      lineItems: lineItems.length > 0 ? lineItems : undefined,
      recurringId: initialData?.recurringId,
      savingGoalId: initialData?.savingGoalId
    });
    
    // Reset form
    if (!initialData) {
      setAmount('');
      setDesc('');
      setNotes('');
      setVendor('');
      setLineItems([]);
    }
    setErrors({});
  };

  const setQuickDate = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split('T')[0]);
  };

  const isEditing = !!initialData?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in duration-300">
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all ${type === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
        >
          <i className="fas fa-arrow-down mr-1"></i> Expense
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all ${type === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
        >
          <i className="fas fa-arrow-up mr-1"></i> Income
        </button>
        <button
          type="button"
          onClick={() => setType('transfer')}
          className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all ${type === 'transfer' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
        >
          <i className="fas fa-exchange-alt mr-1"></i> Transfer
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`w-full p-4 bg-slate-50 border ${errors.amount ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-800 text-lg transition-all`}
            placeholder="0.00"
            required
          />
          {errors.amount && <p className="text-[9px] font-bold text-rose-500 mt-1 ml-1 animate-pulse">{errors.amount}</p>}
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            {type === 'transfer' ? 'From Account' : 'Payment Source'}
          </label>
          <div className="relative">
            <select
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700 text-sm appearance-none cursor-pointer"
            >
              <option value="Cash in Hand">Cash in Hand</option>
              {bankConnections.map(conn => (
                <option key={conn.institution} value={conn.institution}>{conn.institution}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <i className="fas fa-wallet text-[10px]"></i>
            </div>
          </div>
        </div>
      </div>

      {type === 'transfer' && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">To Account</label>
          <div className="relative">
            <select
              value={destinationInstitution}
              onChange={(e) => setDestinationInstitution(e.target.value)}
              className={`w-full p-4 bg-slate-50 border ${errors.destination ? 'border-rose-300' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700 text-sm appearance-none cursor-pointer`}
            >
              <option value="Cash in Hand">Cash in Hand</option>
              {bankConnections.map(conn => (
                <option key={conn.institution} value={conn.institution}>{conn.institution}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <i className="fas fa-long-arrow-alt-right text-[10px]"></i>
            </div>
            {errors.destination && <p className="text-[9px] font-bold text-rose-500 mt-1 ml-1 animate-pulse">{errors.destination}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date</label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 text-sm"
              required
            />
            <div className="flex gap-2 mt-2 ml-1">
              <button type="button" onClick={() => setQuickDate(0)} className="text-[8px] font-black uppercase tracking-widest bg-slate-100 px-2 py-1 rounded hover:bg-indigo-100 hover:text-indigo-600 transition">Today</button>
              <button type="button" onClick={() => setQuickDate(-1)} className="text-[8px] font-black uppercase tracking-widest bg-slate-100 px-2 py-1 rounded hover:bg-indigo-100 hover:text-indigo-600 transition">Yesterday</button>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
          <div className="relative">
            <select
              disabled={type === 'transfer'}
              value={type === 'transfer' ? 'Transfer' : category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-700 text-sm appearance-none cursor-pointer disabled:opacity-50"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <i className="fas fa-tag text-[10px]"></i>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Description</label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className={`w-full p-4 bg-slate-50 border ${errors.description ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 text-sm transition-all`}
          placeholder={type === 'transfer' ? "e.g. Moving to Savings" : "What was this for?"}
          required
        />
        {errors.description && <p className="text-[9px] font-bold text-rose-500 mt-1 ml-1 animate-pulse">{errors.description}</p>}
      </div>

      {lineItems.length > 0 && type !== 'transfer' && (
        <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-50">
          <label className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">Itemized Breakdown</label>
          <div className="space-y-2">
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div className="flex gap-2 items-center">
                  <span className="w-6 h-6 bg-white border border-indigo-100 rounded-lg flex items-center justify-center text-[9px] font-black text-indigo-600">
                    {item.quantity || 1}x
                  </span>
                  <span className="font-bold text-slate-700">{item.name}</span>
                </div>
                <span className="font-black text-slate-900">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 transition active:scale-95"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-95"
        >
          {isEditing ? 'Save Changes' : 'Confirm Entry'}
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;
