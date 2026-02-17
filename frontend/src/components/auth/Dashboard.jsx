import { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { LayoutDashboard, User, LogOut, Trophy, Swords, Zap, Settings } from 'lucide-react';

export default function Dashboard() {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-100 flex flex-col p-6 fixed h-full bg-white z-10">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <span className="font-extrabold text-xl tracking-tighter italic">crypnight.sol</span>
        </div>

        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold transition-all">
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-bold transition-all">
            <User size={20} /> Profile
          </Link>
          <Link to="/leaderboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-bold transition-all">
            <Trophy size={20} /> Rankings
          </Link>
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-all mt-auto"
        >
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-10 relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <header className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tight italic">Welcome back, Strategist.</h2>
            <p className="text-slate-500 mt-2 font-medium">Ready to claim your next SOL reward?</p>
          </div>
          <button className="bg-black text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2">
            <Swords size={18} /> Find Match
          </button>
        </header>

        {/* Bento Grid Stats/Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-200">
             <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2">Solo Speed Arena</h3>
                <p className="text-slate-400 mb-6 text-sm max-w-xs">Solve high-intensity puzzles to earn SOL based on your ELO tier.</p>
                <button className="bg-emerald-400 text-black px-6 py-3 rounded-xl font-black hover:bg-emerald-300 transition-colors flex items-center gap-2">
                  <Zap size={18} fill="currentColor" /> ENTER SOLO MODE
                </button>
             </div>
             <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Current Rating</span>
              <p className="text-5xl font-black italic mt-2 text-emerald-600">load from supa </p>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-4 uppercase tracking-tighter">Top 12% Globally</p>
          </div>
        </div>
      </main>
    </div>
  );
}