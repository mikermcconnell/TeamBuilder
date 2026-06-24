import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { SubLotteryApp } from '@/sub-lottery/SubLotteryApp'
import './index.css'
import App from './App.tsx'

const isSubLotteryApp = import.meta.env.VITE_APP_VARIANT === 'subs'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isSubLotteryApp ? (
        <>
          <SubLotteryApp />
          <Toaster />
        </>
      ) : (
        <AuthProvider>
          <WorkspaceProvider>
            <App />
            <Toaster />
          </WorkspaceProvider>
        </AuthProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
