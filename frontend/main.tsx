import { createRoot } from 'react-dom/client'
import './styles/variables.css'
import './index.css'
import App from './App.tsx'

import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
