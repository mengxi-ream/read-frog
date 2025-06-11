import { useSetAtom } from 'jotai'
import { Bolt, Star } from 'lucide-react'
import { Toaster } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { version } from '../../../package.json'
import { initIsIgnoreTabAtom } from './atom'
import { AlwaysTranslate } from './components/always-translate'
import FloatingButton from './components/floating-button'
import Hotkey from './components/hotkey-selector'
import LanguageLevelSelector from './components/language-level-selector'
import LanguageOptionsSelector from './components/language-options-selector'
import QuickLinks from './components/quick-links'
import ReadButton from './components/read-button'
import ReadProviderSelector from './components/read-provider-selector'
import TranslateButton from './components/translate-button'
import TranslateProviderSelector from './components/translate-provider-selector'

function App() {
  const initIsIgnoreTab = useSetAtom(initIsIgnoreTabAtom)
  useEffect(() => {
    initIsIgnoreTab()
  }, [initIsIgnoreTab])

  return (
    <>
      <div className="bg-background flex flex-col gap-4 px-6 pt-5 pb-4">
        <LanguageOptionsSelector />
        <LanguageLevelSelector />
        <ReadProviderSelector />
        <TranslateProviderSelector />
        <div className="grid w-full grid-cols-2 gap-2">
          <ReadButton />
          <TranslateButton />
        </div>
        <AlwaysTranslate />
        <Hotkey />
        <FloatingButton />
        <QuickLinks />
      </div>
      <div className="flex items-center justify-between bg-neutral-200 px-2 py-1 dark:bg-neutral-800">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <Bolt className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">
            {i18n.t('popup.options')}
          </span>
        </button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {version}
        </span>
        <GithubButton />
      </div>
      <Toaster richColors position="bottom-center" className="-translate-y-8" duration={10000} />
    </>
  )
}

function GithubButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          onClick={() =>
            window.open('https://github.com/mengxi-ream/read-frog', '_blank')}
        >
          <Star className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">Github</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[180px] break-words text-center">
        {i18n.t('popup.github.description')}
      </TooltipContent>
    </Tooltip>
  )
}

export default App
