import type { ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { RecoveryFallback } from "@/components/recovery/recovery-fallback"

interface RecoveryBoundaryProps {
  children: ReactNode
}

function renderRecoveryFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown
  resetErrorBoundary: () => void
}) {
  return (
    <RecoveryFallback
      error={error instanceof Error ? error : new Error(String(error))}
      onRecovered={resetErrorBoundary}
    />
  )
}

export function RecoveryBoundary({ children }: RecoveryBoundaryProps) {
  return <ErrorBoundary fallbackRender={renderRecoveryFallback}>{children}</ErrorBoundary>
}
