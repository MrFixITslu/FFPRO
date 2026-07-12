
import React, { useEffect, useState } from 'react';
import { authService, AuthUser } from '../services/authService';

interface Props {
  onAuthenticated: (user: AuthUser) => void;
}

const OAuthButton: React.FC<{
  provider: 'google' | 'facebook' | 'apple';
  label: string;
  icon: string;
  isConfigured: boolean;
  onClickIfNotConfigured: (provider: 'google' | 'facebook' | 'apple') => void;
}> = ({ provider, label, icon, isConfigured, onClickIfNotConfigured }) => {
  if (isConfigured) {
    return (
      <a
        href={authService.oauthUrl(provider)}
        className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-bold text-white text-[10px] uppercase tracking-wider transition-all"
      >
        <i className={icon}></i> Continue with {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClickIfNotConfigured(provider)}
      className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-bold text-white text-[10px] uppercase tracking-wider transition-all relative group"
    >
      <i className={icon}></i> Continue with {label}
      <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5 text-[7px] font-bold tracking-normal normal-case">
        Configure
      </span>
    </button>
  );
};

const Login: React.FC<Props> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'facebook' | 'apple' | null>(null);
  const [configTab, setConfigTab] = useState<'env' | 'docker'>('env');

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

  const handleProviderClick = (provider: 'google' | 'facebook' | 'apple') => {
    setSelectedProvider(provider);
    setShowConfigHelp(true);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-6 overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-sm w-full relative z-10 my-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded flex items-center justify-center text-white text-2xl mx-auto mb-4 shadow-sm ring-1 ring-white/10">
            <i className="fas fa-fingerprint text-xl"></i>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Vault Access</h1>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mt-1.5">Fire Finance Secure Gateway</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-lg border border-white/10 shadow-lg space-y-4">
          <div className="space-y-2">
            <OAuthButton
              provider="google"
              label="Google"
              icon="fab fa-google"
              isConfigured={availableProviders.includes('google')}
              onClickIfNotConfigured={handleProviderClick}
            />
            <OAuthButton
              provider="facebook"
              label="Facebook"
              icon="fab fa-facebook"
              isConfigured={availableProviders.includes('facebook')}
              onClickIfNotConfigured={handleProviderClick}
            />
          </div>

          <div className="flex items-center gap-3 text-slate-500 text-[8px] font-bold uppercase tracking-wider">
            <div className="flex-1 h-px bg-white/10" /> or use email <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                  <i className="fas fa-envelope"></i>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 px-3 py-2 bg-white/5 border border-white/10 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-white transition-all text-xs"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Username <span className="text-slate-500 normal-case">(optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                    <i className="fas fa-user"></i>
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 px-3 py-2 bg-white/5 border border-white/10 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-white transition-all text-xs"
                    placeholder="Username"
                    autoComplete="username"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                  <i className="fas fa-lock"></i>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 px-3 py-2 bg-white/5 border border-white/10 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-white transition-all text-xs"
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-[9px] font-bold uppercase tracking-wider text-center animate-in shake duration-300">
                <i className="fas fa-exclamation-circle mr-1.5"></i> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider text-[10px]"
            >
              {loading ? (
                <i className="fas fa-circle-notch fa-spin text-xs"></i>
              ) : mode === 'login' ? (
                <>Decrypt &amp; Enter <i className="fas fa-chevron-right text-[9px]"></i></>
              ) : (
                <>Create Account <i className="fas fa-chevron-right text-[9px]"></i></>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            className="w-full text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider hover:text-indigo-400 transition"
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
          </button>
        </div>

        <p className="mt-6 text-center text-slate-600 text-[8px] font-bold uppercase tracking-wider">
          Auth-Shield v2.0 • OAuth2 + bcrypt
        </p>
      </div>

      {showConfigHelp && (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-lg max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <i className={selectedProvider === 'google' ? 'fab fa-google' : selectedProvider === 'facebook' ? 'fab fa-facebook' : 'fab fa-apple'}></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white capitalize">{selectedProvider} Integration</h3>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Self-Hosted Server Guide</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowConfigHelp(false);
                  setSelectedProvider(null);
                }}
                className="text-slate-400 hover:text-white transition p-1"
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setConfigTab('env')}
                className={`flex-1 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all ${
                  configTab === 'env'
                    ? 'border-indigo-500 text-indigo-400 bg-white/5'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                1. Environment Setup
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('docker')}
                className={`flex-1 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all ${
                  configTab === 'docker'
                    ? 'border-indigo-500 text-indigo-400 bg-white/5'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                2. Docker &amp; Nginx Setup
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
              {configTab === 'env' && (
                <div className="space-y-3">
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    To enable <strong>Continue with {selectedProvider === 'google' ? 'Google' : selectedProvider === 'facebook' ? 'Facebook' : 'Apple'}</strong> on your live deployment, register your application on the developer portal and configure the following environment variables:
                  </p>

                  <div className="bg-slate-950 p-3 rounded border border-white/5 font-mono text-[10px] text-indigo-300 space-y-2 select-all leading-normal">
                    {selectedProvider === 'google' && (
                      <>
                        <div># Google Cloud Console OAuth Client</div>
                        <div>GOOGLE_CLIENT_ID="your_client_id.apps.googleusercontent.com"</div>
                        <div>GOOGLE_CLIENT_SECRET="your_google_client_secret"</div>
                        <div>GOOGLE_CALLBACK_URL="https://ffpro.v79sl.duckdns.org/api/auth/google/callback"</div>
                      </>
                    )}
                    {selectedProvider === 'facebook' && (
                      <>
                        <div># Meta Developer Portal Facebook App</div>
                        <div>FACEBOOK_APP_ID="your_facebook_app_id"</div>
                        <div>FACEBOOK_APP_SECRET="your_facebook_app_secret"</div>
                        <div>FACEBOOK_CALLBACK_URL="https://ffpro.v79sl.duckdns.org/api/auth/facebook/callback"</div>
                      </>
                    )}
                    {selectedProvider === 'apple' && (
                      <>
                        <div># Apple Developer Portal Sign In</div>
                        <div>APPLE_CLIENT_ID="your_services_id"</div>
                        <div>APPLE_TEAM_ID="your_developer_team_id"</div>
                        <div>APPLE_KEY_ID="your_private_key_id"</div>
                        <div>APPLE_PRIVATE_KEY_PATH="/path/to/key.p8"</div>
                        <div>APPLE_CALLBACK_URL="https://ffpro.v79sl.duckdns.org/api/auth/apple/callback"</div>
                      </>
                    )}
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 text-[10px] leading-relaxed text-amber-200">
                    <div className="font-bold uppercase tracking-wider text-[8px] text-amber-400 mb-1">
                      <i className="fas fa-exclamation-triangle mr-1"></i> Developer Portal Settings
                    </div>
                    Ensure that you add the corresponding Callback URL to your Authorized Redirect URIs in the developer settings portal for {selectedProvider === 'google' ? 'Google Cloud Console' : selectedProvider === 'facebook' ? 'Meta Developers' : 'Apple Developers'}!
                  </div>
                </div>
              )}

              {configTab === 'docker' && (
                <div className="space-y-3">
                  <div className="text-slate-400 leading-relaxed text-[11px] space-y-2">
                    <p>
                      Since <strong>Port 3000 is already used</strong> on your server, and your Nginx reverse proxy is running on the Docker network <strong>"proxy_network"</strong>, you can use container-to-container routing:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 mt-1 text-[10.5px]">
                      <li>Nginx and this application container join the <code className="text-indigo-400 font-mono bg-white/5 px-1 py-0.5 rounded">proxy_network</code> network.</li>
                      <li>Nginx forwards requests directly to the container's service name on port <code className="text-indigo-400 font-mono bg-white/5 px-1 py-0.5 rounded">3000</code>.</li>
                      <li><strong>No host port mapping is needed</strong>, which avoids any conflict with Port 3000 on the host system!</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">docker-compose.yml</span>
                    </div>
                    <pre className="bg-slate-950 p-3 rounded border border-white/5 font-mono text-[9px] text-slate-300 overflow-x-auto select-all leading-relaxed max-h-48">
{`version: '3.8'

services:
  fire-finance:
    image: fire-finance-pro:latest
    container_name: fire-finance-app
    restart: unless-stopped
    networks:
      - proxy_network
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=your_secure_random_session_secret
      - DATA_ENCRYPTION_KEY=your_32_byte_base64_encryption_key
      - GEMINI_API_KEY=your_gemini_api_key
      ` + (selectedProvider === 'google' ? `- GOOGLE_CLIENT_ID=your_google_client_id
      - GOOGLE_CLIENT_SECRET=your_google_client_secret
      - GOOGLE_CALLBACK_URL=https://ffpro.v79sl.duckdns.org/api/auth/google/callback` : selectedProvider === 'facebook' ? `- FACEBOOK_APP_ID=your_facebook_app_id
      - FACEBOOK_APP_SECRET=your_facebook_app_secret
      - FACEBOOK_CALLBACK_URL=https://ffpro.v79sl.duckdns.org/api/auth/facebook/callback` : `- APPLE_CLIENT_ID=your_services_id
      - APPLE_TEAM_ID=your_developer_team_id
      - APPLE_KEY_ID=your_private_key_id
      - APPLE_CALLBACK_URL=https://ffpro.v79sl.duckdns.org/api/auth/apple/callback`) + `
      - FRONTEND_URL=https://ffpro.v79sl.duckdns.org

networks:
  proxy_network:
    external: true`}
                    </pre>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">nginx.conf Server Block</span>
                    </div>
                    <pre className="bg-slate-950 p-3 rounded border border-white/5 font-mono text-[9px] text-slate-300 overflow-x-auto select-all leading-relaxed max-h-48">
{`server {
    listen 80;
    server_name ffpro.v79sl.duckdns.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ffpro.v79sl.duckdns.org;

    ssl_certificate /etc/letsencrypt/live/ffpro.v79sl.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ffpro.v79sl.duckdns.org/privkey.pem;

    location / {
        # Route to container internally on same Docker network
        proxy_pass http://fire-finance-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowConfigHelp(false);
                  setSelectedProvider(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[10px] uppercase tracking-wider transition-all"
              >
                Got it, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
