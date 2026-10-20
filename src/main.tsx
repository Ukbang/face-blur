import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/black-han-sans/korean-400.css'
import '@fontsource/black-han-sans/latin-400.css'
import '@fontsource/ibm-plex-sans-kr/korean-400.css'
import '@fontsource/ibm-plex-sans-kr/korean-600.css'
import '@fontsource/ibm-plex-sans-kr/latin-400.css'
import '@fontsource/ibm-plex-sans-kr/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
