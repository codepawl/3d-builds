import { createRoot } from 'react-dom/client'
import { Scene } from './scene/Scene.jsx'
import { Dashboard } from './ui/Dashboard.jsx'
import './styles.css'

function App() {
  return (
    <div className="app">
      <Scene />
      <Dashboard />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
