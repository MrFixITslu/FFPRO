
import React, { useState } from 'react';
import { InstitutionType } from '../types';
import { verifyApiConnection } from '../services/bankApiService';

interface Props {
  onSuccess: (institution: string, accountLastFour: string, openingBalance: number, institutionType: InstitutionType) => void;
  onClose: () => void;
}

type Step = 'bank-select' | 'api-handshake' | 'credentials' | 'balance-init' | 'syncing' | 'success';

const BankSyncModal: React.FC<Props> = ({ onSuccess, onClose }) => {
  const [step, setStep] = useState<Step>('bank-select');
  const [selectedBank, setSelectedBank] = useState<{name: string, color: string, icon: string, type: InstitutionType, apiType: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');

  const platforms = [
    { name: '1st National Bank St. Lucia', color: 'bg-emerald-600', icon: 'fa-landmark', type: 'bank' as const, apiType: 'Direct Connect' },
    { name: 'Laborie Cooperative Credit Union', color: 'bg-teal-600', icon: 'fa-users-rectangle', type: 'credit_union' as const, apiType: 'Laborie-Connect' },
    { name: 'St. Lucia Workers Credit Union', color: 'bg-indigo-600', icon: 'fa-users', type: 'credit_union' as const, apiType: 'CU-Sync' },
    { name: 'Binance', color: 'bg-yellow-500', icon: 'fa-coins', type: 'investment' as const, apiType: 'REST API' },
    { name: 'Vanguard', color: 'bg-rose-700', icon: 'fa-chart-pie', type: 'investment' as const, apiType: 'Brokerage-API' }
  ];

  const handleBankSelect = (bank: typeof platforms[0]) => {
    setSelectedBank(bank);
    setStep('api-handshake');
  };

  const startApiLink = async () => {
    setLoading(true);
    // Simulate API authorization flow
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setStep('credentials');
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await verifyApiConnection({}, selectedBank?.name || '');
    setLoading(false);
    if (success) {
      // For investments, we skip the manual balance entry if we're pulling portfolio data
      if (selectedBank?.type === 'investment') {
        setStep('syncing');
      } else {
        setStep('balance-init');
      }
    }
  };

  const handleFinish = () => {
    if (selectedBank) {
      onSuccess(
        selectedBank.name, 
        selectedBank.type === 'investment' ? 'API-KEY' : '8821',
        parseFloat(openingBalance) || 0,
        selectedBank.type
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {step === 'bank-select' && (
          <div className="p-8">
            <h3 className="text-xl font-black text-slate-800 mb-2 text-center">API Gateway</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mb-6">Select Institution to Link</p>
            <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
              {platforms.map(bank => (
                <button 
                  key={bank.name}
                  onClick={() => handleBankSelect(bank)}
                  className="w-full p-4 flex items-center gap-4 bg-slate-50 hover:bg-white hover:ring-2 hover:ring-indigo-500 border border-slate-200 rounded-2xl transition group"
                >
                  <div className={`w-10 h-10 ${bank.color} rounded-xl flex items-center justify-center text-white text-sm shadow-lg`}>
                    <i className={`fas ${bank.icon}`}></i>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-slate-800 text-sm truncate">{bank.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">{bank.apiType}</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{bank.type}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-full mt-6 py-2 text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
          </div>
        )}

        {step === 'api-handshake' && selectedBank && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className={`w-16 h-16 ${selectedBank.color} rounded-2xl flex items-center justify-center text-white text-2xl`}>
                  <i className={`fas ${selectedBank.icon}`}></i>
                </div>
                <div className="absolute -right-2 -bottom-2 w-8 h-8 bg-indigo-600 rounded-full border-4 border-white flex items-center justify-center text-white text-[10px]">
                  <i className="fas fa-link"></i>
                </div>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Establishing Connection</h3>
            <p className="text-slate-500 text-sm mb-8">Linking to <b>{selectedBank.name}</b> via encrypted {selectedBank.apiType} protocol.</p>
            <button 
              onClick={startApiLink}
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 transition active:scale-95"
            >
              {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Begin API Handshake'}
            </button>
          </div>
        )}

        {step === 'credentials' && selectedBank && (
          <div className="p-8">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <i className="fas fa-shield-alt text-indigo-600"></i>
              API Authorization
            </h3>
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {selectedBank.type === 'investment' ? (
                <>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">API Key</label>
                    <input type="text" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs" placeholder="x-api-key-..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">API Secret</label>
                    <input type="password" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs" placeholder="••••••••••••" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Net-Banking ID</label>
                    <input type="text" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Customer 001" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Digital Password</label>
                    <input type="password" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="••••••••" />
                  </div>
                </>
              )}
              <button disabled={loading} className={`w-full py-4 ${selectedBank.color} text-white font-black rounded-2xl transition shadow-lg flex items-center justify-center gap-2 active:scale-95`}>
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : (selectedBank.type === 'investment' ? 'Connect Portfolio' : 'Authorize API')}
              </button>
            </form>
          </div>
        )}

        {step === 'balance-init' && (
          <div className="p-8">
            <h3 className="text-xl font-black text-slate-800 mb-2 text-center">Initial Sync</h3>
            <p className="text-slate-500 text-xs text-center mb-8 uppercase tracking-widest font-bold">API Data Fetch Pending</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Enter Current Ledger Balance</label>
                <input 
                  type="number" 
                  autoFocus
                  required
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full p-6 bg-emerald-50 border border-emerald-100 rounded-3xl outline-none font-mono font-black text-2xl text-emerald-800 text-center" 
                  placeholder="0.00" 
                />
              </div>
              <button 
                onClick={() => setStep('syncing')}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl"
              >
                Start Data Extraction
              </button>
            </div>
          </div>
        )}

        {step === 'syncing' && (
          <div className="p-12 text-center">
            <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
            <h3 className="text-xl font-black text-slate-800 mb-2">
              {selectedBank?.type === 'investment' ? 'Extracting Portfolio' : 'Standardizing Feed'}
            </h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
              {selectedBank?.type === 'investment' ? 'Polling Asset Balances...' : 'JSON Pipeline Processing...'}
            </p>
            {setTimeout(() => setStep('success'), 4000) && null}
          </div>
        )}

        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 text-4xl mx-auto mb-6 border-4 border-emerald-100 animate-bounce">
              <i className="fas fa-check"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">API Linked!</h3>
            <p className="text-slate-500 text-sm mb-8">
              {selectedBank?.type === 'investment' 
                ? `Total amounts for ${selectedBank.name} have been retrieved. Approve them in the Verification Queue.`
                : `Real-time webhooks are now active for ${selectedBank?.name}.`}
            </p>
            <button onClick={handleFinish} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl transition active:scale-95">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankSyncModal;
