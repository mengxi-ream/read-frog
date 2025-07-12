import type { Config } from '@/types/config/config.ts'
import { Provider as JotaiProvider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import React from 'react'

import ReactDOM from 'react-dom/client'

import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { configAtom } from '@/utils/atoms/config.ts'
import { globalConfig, loadGlobalConfig } from '@/utils/config/config.ts'
import { DEFAULT_CONFIG } from '@/utils/constants/config.ts'
import App from './app.tsx'
import { getIsInPatterns, isCurrentSiteInPatternsAtom, isPageTranslatedAtom } from './atoms/auto-translate.ts'

import '@/assets/tailwind/text-small.css'
import '@/assets/tailwind/theme.css'

document.documentElement.classList.toggle(
  'dark',
  localStorage.theme === 'dark'
  || (!('theme' in localStorage)
    && window.matchMedia('(prefers-color-scheme: dark)').matches),
)

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: [
    [typeof configAtom, Config],
    [typeof isPageTranslatedAtom, boolean],
    [typeof isCurrentSiteInPatternsAtom, boolean],
  ]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

async function initApp() {
  await loadGlobalConfig()
  const root = document.getElementById('root')!
  root.className = 'text-base antialiased w-[320px] bg-background'
  const config = globalConfig ?? DEFAULT_CONFIG

  const activeTab = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })

  const tabId = activeTab[0].id

  let isPageTranslated: boolean = false
  if (tabId) {
    isPageTranslated
      = (await sendMessage('getEnablePageTranslation', {
        tabId,
      })) ?? false
  }

  const isInPatterns = tabId
    ? await getIsInPatterns(config.translate)
    : false

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <JotaiProvider>
        <HydrateAtoms
          initialValues={[
            [configAtom, config],
            [isPageTranslatedAtom, isPageTranslated],
            [isCurrentSiteInPatternsAtom, isInPatterns],
          ]}
        >
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </HydrateAtoms>
      </JotaiProvider>
    </React.StrictMode>,
  )
}

initApp()
