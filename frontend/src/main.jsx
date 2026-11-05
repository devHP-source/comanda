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
