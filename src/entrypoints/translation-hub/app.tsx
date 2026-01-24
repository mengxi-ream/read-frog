import { i18n } from '#imports'
import { LanguageControlPanel } from './components/language-control-panel'
import { PromptSelector } from './components/prompt-selector'
import { TextInput } from './components/text-input'
import { TranslationPanel } from './components/translation-panel'
import { TranslationServiceDropdown } from './components/translation-service-dropdown'

export default function App() {
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-foreground">
            {i18n.t('translationHub.title')}
          </h1>
        </header>

        <main className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Row 1: Controls */}
            <div className="order-1">
              <LanguageControlPanel />
            </div>
            <div className="order-3 lg:order-2 flex justify-end lg:items-end lg:h-full">
              <div className="flex items-center gap-2">
                <PromptSelector />
                <TranslationServiceDropdown />
              </div>
            </div>

            {/* Row 2: Content */}
            <div className="order-2 lg:order-3">
              <TextInput />
            </div>
            <div className="order-4">
              <TranslationPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
