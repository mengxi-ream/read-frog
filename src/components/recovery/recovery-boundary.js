import { jsx as _jsx } from "react/jsx-runtime";
import { ErrorBoundary } from "react-error-boundary";
import { RecoveryFallback } from "@/components/recovery/recovery-fallback";
export function RecoveryBoundary({ children }) {
    return (_jsx(ErrorBoundary, { fallbackRender: ({ error, resetErrorBoundary }) => (_jsx(RecoveryFallback, { error: error instanceof Error ? error : new Error(String(error)), onRecovered: resetErrorBoundary })), children: children }));
}
