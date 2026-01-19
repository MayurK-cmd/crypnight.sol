import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        
      </div>
      <h1>crypnight.sol</h1>
      <p>crypnight.sol is a decentralized chess puzzle platform built on Solana where players compete using skill instead of luck. Users connect their Phantom Wallet, solve chess puzzles in real-time, and earn SOL by outperforming opponents in speed and accuracy.</p>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          click me 
        </button>
        
      </div>
      <p className="read-the-docs">
        BUILD UNDER PROGRESS! STAY TUNED
      </p>
    </>
  )
}

export default App
