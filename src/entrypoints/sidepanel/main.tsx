import "@/utils/zod-config"
import type { ThemeMode } from "@/types/config/theme"
import { Provider as JotaiProvider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import readFrogLogo from "@/assets/icons/read-frog.png?url&no-inline"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { APP_NAME } from "@/utils/constants/app"
import { renderPersistentReactRoot } from "@/utils/react-root"
import { getLocalThemeMode } from "@/utils/theme"
import "@/assets/styles/text-small.css"
import "@/assets/styles/theme.css"

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: [
    [typeof baseThemeModeAtom, ThemeMode],
  ]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

function SidePanelShell() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col px-5 py-6">
      <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <img
          src={readFrogLogo}
          alt={APP_NAME}
          className="size-16 rounded-full"
        />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-muted-foreground text-sm">
            Side Panel is coming soon.
          </p>
        </div>
      </section>
    </main>
  )
}

async function initApp() {
  const root = document.getElementById("root")!
  root.className = "min-h-screen bg-background text-base antialiased"

  const themeMode = await getLocalThemeMode()

  renderPersistentReactRoot(root, (
    <JotaiProvider>
      <HydrateAtoms initialValues={[[baseThemeModeAtom, themeMode]]}>
        <ThemeProvider>
          <SidePanelShell />
        </ThemeProvider>
      </HydrateAtoms>
    </JotaiProvider>
  ))
}

void initApp()
