import { AnchoredToastProvider } from "@/components/ui/base-ui/toast"
import FloatingButton from "./components/floating-button"

// Corner toasts render in the selection UI; see ../selection/app.tsx.
// `portalContainer` is the themed wrapper, for the same reason as there.
export default function App({ portalContainer }: { portalContainer: HTMLElement }) {
  return (
    <AnchoredToastProvider portalProps={{ container: portalContainer }}>
      <FloatingButton />
    </AnchoredToastProvider>
  )
}
