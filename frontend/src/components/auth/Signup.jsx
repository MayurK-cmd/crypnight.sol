import { useState } from 'react';
import API from '../../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

const Toast = ({ message, type, onClose }) => (
  <div className="fixed bottom-10 right-10 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300 text-left">
    <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
      type === 'error' ? 'bg-red-50/90 border-red-100 text-red-600' : 'bg-white/90 border-emerald-100 text-slate-900'
    }`}>
      <span className="text-lg">{type === 'error' ? '⚠️' : '✅'}</span>
      <span className="font-bold text-sm tracking-tight">{message}</span>
      <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600">✕</button>
    </div>
  </div>
);

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const navigate = useNavigate();

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password) return showToast("Please fill in all fields", "error");
    if (password.length < 6) return showToast("Password must be at least 6 characters", "error");

    setIsLoading(true);
    try {
      const res = await API.post('/auth/signup', { email, password });
      showToast(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      showToast(err.response?.data?.error || 'Signup failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
      {toast.show && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <span className="font-extrabold text-2xl tracking-tighter">
              crypnight<span className="text-emerald-500">.sol</span>
            </span>
          </div>
          <h2 className="text-4xl font-black tracking-tight mb-2">Join the Arena</h2>
          <p className="text-slate-500 font-medium">Master your strategy, earn your SOL.</p>
        </div>

        <form onSubmit={handleSignup} className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="grandmaster@chess.sol"
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 pr-12 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[42px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-slate-800 disabled:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 mt-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Create Account"}
            </button>
          </div>
        </form>

        <p className="text-center mt-8 text-slate-500 font-medium text-sm">
          Already a strategist? <Link to="/login" className="text-emerald-600 hover:text-emerald-500 font-bold underline underline-offset-4">Log in here</Link>
        </p>
      </div>
    </div>
  );
}