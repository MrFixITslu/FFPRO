
import React from 'react';
import { AIAnalysisResult, Transaction, PortfolioUpdate } from '../types';

interface Props {
  pendingItems: AIAnalysisResult[];
  onApprove: (index: number) => void;
  onDiscard: (index: number) => void;
  onEdit: (index: number) => void;
  onDiscardAll: () => void;
}

const VerificationQueue: React.FC<Props> = ({ pendingItems, onApprove, onDiscard, onEdit, onDiscardAll }) => {
  if (pendingItems.length === 0) return null;

  return (
    <section className="mb-10 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-sm">
            <i className="fas fa-shield-check"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Verification Queue</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase">{pendingItems.length} Items Awaiting Review</p>
          </div>
        </div>
        <button onClick={onDiscardAll} className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 px-3 py-1.5 rounded-lg transition">Discard All</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingItems.map((item, idx) => (
          <div key={idx} className="bg-white border-2 border-slate-100 rounded-[2rem] p-5 shadow-sm hover:border-indigo-100 transition-all flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${item.updateType === 'portfolio' ? 'bg-blue-500' : 'bg-indigo-600'}`}>
                  <i className={`fas ${item.updateType === 'portfolio' ? 'fa-chart-line' : 'fa-receipt'}`}></i>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {item.updateType === 'portfolio' ? 'Portfolio Adjustment' : (item.transaction?.vendor ? `Merchant: ${item.transaction.vendor}` : 'Suggested Transaction')}
                  </p>
                  <p className="font-black text-sm text-slate-800 truncate max-w-[150px]">
                    {item.updateType === 'portfolio' ? `${item.portfolio?.provider}: Update ${item.portfolio?.symbol}` : item.transaction?.description || 'Extracted Entry'}
                  </p>
                </div>
              </div>
              <p className="font-black text-slate-900">{item.updateType === 'portfolio' ? `${item.portfolio?.quantity || 0}` : `$${(item.transaction?.amount || 0).toFixed(2)}`}</p>
            </div>

            {/* Itemized Preview */}
            {item.transaction?.lineItems && item.transaction.lineItems.length > 0 && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Itemized Details</p>
                <div className="space-y-1">
                  {item.transaction.lineItems.slice(0, 3).map((li, lIdx) => (
                    <div key={lIdx} className="flex justify-between text-[9px] font-bold text-slate-600">
                      <span>{li.quantity}x {li.name}</span>
                      <span>${li.price?.toFixed(2)}</span>
                    </div>
                  ))}
                  {item.transaction.lineItems.length > 3 && (
                    <p className="text-[8px] text-indigo-500 font-black italic">+{item.transaction.lineItems.length - 3} more items...</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => onApprove(idx)} className="flex-1 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-slate-800 transition active:scale-95">{item.updateType === 'portfolio' ? 'Sync Portfolio' : 'Quick Approve'}</button>
              <button onClick={() => onEdit(idx)} className="px-4 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition">Edit</button>
              <button onClick={() => onDiscard(idx)} className="w-12 py-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition"><i className="fas fa-trash-alt"></i></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default VerificationQueue;
