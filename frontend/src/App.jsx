import { useContext } from 'react';
import LandingPage from './components/LandingPage'
import LoginPage from './components/auth/Login'
import SignupPage from './components/auth/Signup'
import Dashboard from './components/auth/Dashboard'
import Setup from './components/auth/Setup'
import Profile from './components/auth/Profile'
import Redirect from './components/auth/Redirect'
import Solo from './components/gameModes/Solo'
import Duel from './components/gameModes/Duel'
import DemoPage from './components/demo/DemoPage'
import MatchHistory from './components/MatchHistory.jsx'
import Leaderboard from './components/Leaderboard.jsx'

import { AuthProvider, AuthContext } from './context/AuthContext';
import SolanaProvider from './wallet/WalletProvider';
import './App.css'
import {Route, Routes, Router, BrowserRouter} from 'react-router-dom'

function PrivateRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return user ? children : <LoginPage />;
}

function App() {


  return (
    <div>

      <AuthProvider>
      <SolanaProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/setup" element={<PrivateRoute><Setup /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/redirect" element={<Redirect />} />
        <Route path="/solo" element={<PrivateRoute><Solo /></PrivateRoute>} />
        <Route path="/duel" element={<PrivateRoute><Duel /></PrivateRoute>} />
        <Route path="/demo" element={<PrivateRoute><DemoPage /></PrivateRoute>} />
        <Route path="/match-history" element={<PrivateRoute><MatchHistory /></PrivateRoute>} />
        <Route path="/leaderboard" element={<Leaderboard />} />

      </Routes>
      </BrowserRouter>
      </SolanaProvider>
      </AuthProvider>
    </div>
  )
}

export default App
