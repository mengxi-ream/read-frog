import type { ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { RecoveryFallback } from "@/components/recovery/recovery-fallback"

interface RecoveryBoundaryProps {
  children: ReactNode
}

export function RecoveryBoundary({ children }: RecoveryBoundaryProps) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <RecoveryFallback
          error={error instanceof Error ? error : new Error(String(error))}
          onRecovered={resetErrorBoundary}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
