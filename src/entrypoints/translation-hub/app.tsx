import { LanguageControlPanel } from './components/language-control-panel'
import { TextInput } from './components/text-input'
import { TranslationPanel } from './components/translation-panel'
import { TranslationServiceDropdown } from './components/translation-service-dropdown'
import { useTranslation } from './hooks/use-translation'

export default function App() {
  const {
    handleTranslate,
    handleLanguageExchange,
    handleCopyText,
    handleRemoveService,
    handleServicesChange,
  } = useTranslation()

  return (
    <>
      <div className="bg-muted/30 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <header className="px-6 py-3">
            <h1 className="text-3xl font-semibold text-foreground">
              Multi-API Text Translation
            </h1>
          </header>

          <main className="px-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
              {/* Row 1: Controls */}
              <div className="order-1">
                <LanguageControlPanel
                  onLanguageExchange={handleLanguageExchange}
                />
              </div>
              <div className="order-3 lg:order-2 flex justify-end lg:items-end lg:h-full">
                <TranslationServiceDropdown
                  onServicesChange={handleServicesChange}
                />
              </div>

              {/* Row 2: Content */}
              <div className="order-2 lg:order-3">
                <TextInput
                  onTranslate={handleTranslate}
                  placeholder="Enter the text you want to translate..."
                />
              </div>
              <div className="order-4">
                <TranslationPanel
                  onCopy={handleCopyText}
                  onRemove={handleRemoveService}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
