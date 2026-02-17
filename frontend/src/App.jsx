import LandingPage from './components/LandingPage'
import LoginPage from './components/auth/Login'
import SignupPage from './components/auth/Signup'
import Dashboard from './components/auth/Dashboard'
import Setup from './components/auth/Setup'
import Profile from './components/auth/Profile'
import { AuthProvider } from './context/AuthContext';
import SolanaProvider from './wallet/WalletProvider';
import './App.css'
import {Route, Routes, Router, BrowserRouter} from 'react-router-dom'

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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/profile" element={<Profile />} />

      </Routes>
      </BrowserRouter>
      </SolanaProvider>
      </AuthProvider>
    </div>
  )
}

export default App
