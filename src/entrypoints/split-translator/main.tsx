import "@/utils/zod-config"
import * as React from "react"
import { renderPersistentReactRoot } from "@/utils/react-root"
import "@/assets/styles/theme.css"

function App() {
  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <h1 className="text-xl font-semibold">Split Translator</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Split translator is loading.
      </p>
    </div>
  )
}

const root = document.getElementById("root")!
root.className = "text-base antialiased min-h-screen bg-background"
renderPersistentReactRoot(root, (
  <React.StrictMode>
    <App />
  </React.StrictMode>
))
