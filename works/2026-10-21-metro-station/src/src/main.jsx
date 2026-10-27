import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App.jsx'
import './ui/styles.css'

createRoot(document.getElementById('root')).render(<App />)
