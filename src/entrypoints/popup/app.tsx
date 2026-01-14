import { browser, i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import FrogToast from '@/components/frog-toast'
import { UserAccount } from '@/components/user-account'
import { version } from '../../../package.json'
import { initIsIgnoreTabAtom } from './atoms/ignore'
import { initSiteControlAtomsAtom } from './atoms/site-control'
import { AddToWhitelist } from './components/add-to-whitelist'
import { AISmartContext } from './components/ai-smart-context'
import { AlwaysTranslate } from './components/always-translate'
import BlogNotification from './components/blog-notification'
import { DiscordButton } from './components/discord-button'
import LanguageOptionsSelector from './components/language-options-selector'
import { MoreMenu } from './components/more-menu'
import Hotkey from './components/node-translation-hotkey-selector'
import ReadButton from './components/read-button'
import ReadProviderField from './components/read-provider-field'
import TranslateButton from './components/translate-button'
import TranslatePromptSelector from './components/translate-prompt-selector'
import TranslateProviderField from './components/translate-provider-field'
import TranslationModeSelector from './components/translation-mode-selector'

function App() {
  const initIsIgnoreTab = useSetAtom(initIsIgnoreTabAtom)
  const initSiteControlAtoms = useSetAtom(initSiteControlAtomsAtom)

  useEffect(() => {
    void initIsIgnoreTab()
    void initSiteControlAtoms()
  }, [initIsIgnoreTab, initSiteControlAtoms])

  return (
    <>
      <div className="bg-background flex flex-col gap-4 px-6 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <UserAccount />
          <div className="flex items-center">
            <DiscordButton />
            <BlogNotification />
          </div>
        </div>
        <LanguageOptionsSelector />
        {/* <LanguageLevelSelector /> */}
        <TranslationModeSelector />
        <TranslateProviderField />
        <TranslatePromptSelector />
        <ReadProviderField />
        <div className="grid w-full grid-cols-2 gap-2">
          <ReadButton />
          <TranslateButton />
        </div>
        <AddToWhitelist />
        <AlwaysTranslate />
        <Hotkey />
        <AISmartContext />
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
        <MoreMenu />
      </div>
      <FrogToast />
    </>
  )
}

export default App
