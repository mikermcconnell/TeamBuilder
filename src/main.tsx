import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { Toaster } from '@/components/ui/sonner'
import { shouldRenderSubLotteryApp } from '@/appVariant'
import './index.css'

const SubLotteryApp = lazy(() =>
  import('@/sub-lottery/SubLotteryApp').then(module => ({ default: module.SubLotteryApp })),
)

const TeamBuilderApp = lazy(async () => {
  const [{ AuthProvider }, { WorkspaceProvider }, { default: App }] = await Promise.all([
    import('@/contexts/AuthContext'),
    import('@/contexts/WorkspaceContext'),
    import('./App.tsx'),
  ])

  return {
    default: function TeamBuilderRoot() {
      return (
        <AuthProvider>
          <WorkspaceProvider>
            <App />
            <Toaster />
          </WorkspaceProvider>
        </AuthProvider>
      )
    },
  }
})

const isSubLotteryApp = shouldRenderSubLotteryApp(
  window.location.pathname,
  import.meta.env.VITE_APP_VARIANT,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        {isSubLotteryApp ? (
          <>
            <SubLotteryApp />
            <Toaster />
          </>
        ) : (
          <TeamBuilderApp />
        )}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
