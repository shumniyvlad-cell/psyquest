import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/alice/400.css'
import '@fontsource-variable/golos-text/index.css'
import './styles/global.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
