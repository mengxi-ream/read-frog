import type { Config } from '@/types/config/config'
import { Provider as JotaiProvider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import React from 'react'

import ReactDOM from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { configAtom } from '@/utils/atoms/config'
import { isPageTranslatedAtom } from '@/utils/atoms/translation.ts'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import App from './app.tsx'

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
  ]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

async function initApp() {
  const root = document.getElementById('root')!
  root.className = 'text-base antialiased w-[320px] bg-background'
  const config = await storage.getItem<Config>('local:config')

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

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <JotaiProvider>
        <HydrateAtoms
          initialValues={[
            [configAtom, config ?? DEFAULT_CONFIG],
            [isPageTranslatedAtom, isPageTranslated],
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
