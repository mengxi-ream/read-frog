import { AnchoredToastProvider, ToastProvider } from "@/components/ui/base-ui/toast"
import FloatingButton from "./components/floating-button"

export default function App({ portalContainer }: { portalContainer: ShadowRoot }) {
  return (
    <ToastProvider portalProps={{ container: portalContainer }}>
      <AnchoredToastProvider portalProps={{ container: portalContainer }}>
        <FloatingButton />
      </AnchoredToastProvider>
    </ToastProvider>
  )
}
