import "@/utils/zod-config"
import type { Config } from "@/types/config/config"
import { QueryClientProvider } from "@tanstack/react-query"
import { Provider as JotaiProvider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import * as React from "react"
import { configAtom } from "@/utils/atoms/config"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { initI18n } from "@/utils/i18n"
import { LocaleBoundary } from "@/utils/i18n/locale-boundary"
import { renderPersistentReactRoot } from "@/utils/react-root"
import { queryClient } from "@/utils/tanstack-query"
import PdfViewerApp from "./app"
import "@fontsource-variable/onest/index.css"
import "@/assets/styles/theme.css"

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: { config: Config }
  children: React.ReactNode
}) {
  useHydrateAtoms([[configAtom, initialValues.config]])
  return <>{children}</>
}

async function initApp() {
  const root = document.getElementById("root")!
  const configValue = await getLocalConfig()
  const config = configValue ?? DEFAULT_CONFIG

  await initI18n(config.uiLanguage)

  renderPersistentReactRoot(
    root,
    <React.StrictMode>
      <JotaiProvider>
        <HydrateAtoms initialValues={{ config }}>
          <QueryClientProvider client={queryClient}>
            <LocaleBoundary>
              <PdfViewerApp />
            </LocaleBoundary>
          </QueryClientProvider>
        </HydrateAtoms>
      </JotaiProvider>
    </React.StrictMode>,
  )
}

void initApp()
