import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/global.css'
import { LanguageProvider } from './context/LanguageProvider.jsx'
import { AuthProvider } from './context/AuthProvider.jsx'
import { ListProvider } from './context/ListProvider.jsx'
import App from './App.jsx'

// The flag allows one reload per tab session
const CHUNK_RELOAD_KEY = 'comanda_chunk_reload'

window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return // already reloaded once: let the error through
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  } catch {
    return // storage blocked: without the flag we can't rule out a loop, so no reload
  }
  event.preventDefault() // stops Vite from throwing the error, the page is reloading anyway
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ListProvider>
            <App />
          </ListProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
