import { Toaster } from "sonner"
import { useInputTranslation } from "./input-translation"
import { SelectionToolbar } from "./selection-toolbar"

export default function App() {
  useInputTranslation()

  return (
    <>
      <SelectionToolbar />
      <Toaster richColors className="z-2147483647 notranslate" />
    </>
  )
}
