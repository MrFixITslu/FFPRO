
import React, { useEffect, useState } from 'react';
import { authService, AuthUser } from '../services/authService';

interface Props {
  onAuthenticated: (user: AuthUser) => void;
}

const OAuthButton: React.FC<{ provider: 'google' | 'facebook' | 'apple'; label: string; icon: string }> = ({ provider, label, icon }) => (
  <a
    href={authService.oauthUrl(provider)}
    className="w-full flex items-center justify-center gap-3 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-white text-[10px] uppercase tracking-widest transition-all"
  >
    <i className={icon}></i> Continue with {label}
  </a>
);

const Login: React.FC<Props> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    authService.providers().then((providers) => {
      if (!cancelled) setAvailableProviders(providers);
    }).catch(() => {
      if (!cancelled) setAvailableProviders([]);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = mode === 'login'
        ? await authService.login(email, password)
        : await authService.register(email, username, password);
      onAuthenticated(user);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-6 overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-md w-full relative z-10 my-10">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-3xl mx-auto mb-6 shadow-2xl shadow-indigo-500/20 ring-4 ring-white/5">
            <i className="fas fa-fingerprint"></i>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Vault Access</h1>
          <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mt-2">Fire Finance Secure Gateway</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 shadow-2xl space-y-6 animate-in zoom-in-95 duration-500">
          {availableProviders.length > 0 && (
            <div className="space-y-3">
              {availableProviders.includes('google') && <OAuthButton provider="google" label="Google" icon="fab fa-google" />}
              {availableProviders.includes('facebook') && <OAuthButton provider="facebook" label="Facebook" icon="fab fa-facebook" />}
              {availableProviders.includes('apple') && <OAuthButton provider="apple" label="Apple" icon="fab fa-apple" />}
            </div>
          )}

          {availableProviders.length > 0 && (
            <div className="flex items-center gap-3 text-slate-600 text-[9px] font-black uppercase tracking-widest">
              <div className="flex-1 h-px bg-white/10" /> or use email <div className="flex-1 h-px bg-white/10" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <i className="fas fa-envelope"></i>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-white transition-all"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username <span className="text-slate-600 normal-case">(optional)</span></label>
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
                    autoComplete="username"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
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
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest text-center animate-in shake duration-300">
                <i className="fas fa-exclamation-circle mr-2"></i> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
            >
              {loading ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : mode === 'login' ? (
                <>Decrypt &amp; Enter <i className="fas fa-chevron-right text-[10px]"></i></>
              ) : (
                <>Create Account <i className="fas fa-chevron-right text-[10px]"></i></>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            className="w-full text-center text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition"
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
          </button>
        </div>

        <p className="mt-8 text-center text-slate-500 text-[9px] font-black uppercase tracking-widest">
          Auth-Shield v2.0 • OAuth2 + bcrypt
        </p>
      </div>
    </div>
  );
};

export default Login;
