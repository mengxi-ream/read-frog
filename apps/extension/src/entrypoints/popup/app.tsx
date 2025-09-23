import { browser, i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import FrogToast from '@/components/frog-toast'
import { UserAccount } from '@/components/user-account'
import { version } from '../../../package.json'
import { initIsIgnoreTabAtom } from './atoms/ignore'
import { AlwaysTranslate } from './components/always-translate'
import FloatingButton from './components/floating-button'
import LanguageOptionsSelector from './components/language-options-selector'
import Hotkey from './components/node-translation-hotkey-selector'
import QuickLinks from './components/quick-links'
import ReadButton from './components/read-button'
import ReadProviderField from './components/read-provider-field'
import SelectionToolbar from './components/text-selection-tooltip'
import TranslateButton from './components/translate-button'
import TranslatePromptSelector from './components/translate-prompt-selector'
import TranslateProviderField from './components/translate-provider-field'

function App() {
  const initIsIgnoreTab = useSetAtom(initIsIgnoreTabAtom)

  useEffect(() => {
    void initIsIgnoreTab()
  }, [initIsIgnoreTab])

  return (
    <>
      <div className="bg-background flex flex-col gap-4 px-6 pt-5 pb-4">
        <UserAccount />
        <LanguageOptionsSelector />
        {/* <LanguageLevelSelector /> */}
        <TranslateProviderField />
        <TranslatePromptSelector />
        <ReadProviderField />
        <div className="grid w-full grid-cols-2 gap-2">
          <ReadButton />
          <TranslateButton />
        </div>
        <AlwaysTranslate />
        <Hotkey />
        <FloatingButton />
        <SelectionToolbar />
        <QuickLinks />
      </div>
      <div className="flex items-center justify-between bg-neutral-200 px-2 py-1 dark:bg-neutral-800">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <Icon icon="tabler:settings" className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">
            {i18n.t('popup.options')}
          </span>
        </button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {version}
        </span>
        <GithubButton />
      </div>
      <FrogToast />
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
          <Icon icon="tabler:brand-github" className="size-4" strokeWidth={1.6} />
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
