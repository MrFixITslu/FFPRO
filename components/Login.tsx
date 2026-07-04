
import React, { useState } from 'react';

interface Props {
  onLogin: (user: string, pass: string) => boolean;
  onReset: () => void;
}

const Login: React.FC<Props> = ({ onLogin, onReset }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);

    // Simulate small delay for "secure" feel
    setTimeout(() => {
      const success = onLogin(username, password);
      if (!success) {
        setError(true);
        setLoading(false);
      }
    }, 800);
  };

  const handleForgot = () => {
    if (confirm("Forgotten your password? Because this is a secure local vault, we cannot retrieve it. \n\nTo regain access, you must perform a FACTORY RESET which deletes ALL your data. Proceed?")) {
      if (confirm("LAST WARNING: This will permanently erase your transactions, budgets, and project files. Are you sure?")) {
        onReset();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-3xl mx-auto mb-6 shadow-2xl shadow-indigo-500/20 ring-4 ring-white/5">
            <i className="fas fa-fingerprint"></i>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Vault Access</h1>
          <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mt-2">Fire Finance Secure Gateway</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 shadow-2xl space-y-6 animate-in zoom-in-95 duration-500">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Identity</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <i className="fas fa-user"></i>
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-white transition-all"
                placeholder="Username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Credential</label>
            <div className="relative flex flex-col gap-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <i className="fas fa-lock"></i>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-white transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button 
                type="button"
                onClick={handleForgot}
                className="text-right text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest text-center animate-in shake duration-300">
              <i className="fas fa-exclamation-circle mr-2"></i> Access Denied
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            {loading ? (
              <i className="fas fa-circle-notch fa-spin"></i>
            ) : (
              <>Decrypt & Enter <i className="fas fa-chevron-right text-[10px]"></i></>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-slate-500 text-[9px] font-black uppercase tracking-widest">
          Auth-Shield v1.0 • AES-256 Obfuscated
        </p>
      </div>
    </div>
  );
};

export default Login;
