import { AnchoredToastProvider } from "@/components/ui/base-ui/toast"
import FloatingButton from "./components/floating-button"

// Corner toasts render in the selection UI; see selection.content/app.tsx.
export default function App({ portalContainer }: { portalContainer: ShadowRoot }) {
  return (
    <AnchoredToastProvider portalProps={{ container: portalContainer }}>
      <FloatingButton />
    </AnchoredToastProvider>
  )
}
