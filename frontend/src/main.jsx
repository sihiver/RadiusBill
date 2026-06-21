import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import IsolirPage from './components/IsolirPage.jsx'

const isIsolir = window.location.pathname === '/isolir' || window.location.pathname === '/isolir.html';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isIsolir ? <IsolirPage /> : <App />}
  </StrictMode>,
)
