import { i18n } from "#imports"
import { LanguageControlPanel } from "./components/language-control-panel"
import { PromptSelector } from "./components/prompt-selector"
import { TextInput } from "./components/text-input"
import { TranslationPanel } from "./components/translation-panel"
import { TranslationPanelActions } from "./components/translation-panel-actions"
import { TranslationServiceDropdown } from "./components/translation-service-dropdown"

export default function App({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "min-h-screen min-w-[360px] bg-background" : "min-h-screen bg-background"}>
      <div className={embedded ? "mx-auto w-full" : "mx-auto max-w-6xl"}>
        {!embedded && (
          <header className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-foreground">
              {i18n.t("translationHub.title")}
            </h1>
          </header>
        )}

        <main className={embedded ? "p-3" : "p-6"}>
          <div className={embedded ? "flex flex-col gap-3" : "grid grid-cols-1 gap-6 lg:grid-cols-2"}>
            {/* Row 1: Controls */}
            <div className={embedded ? "" : "order-1"}>
              <LanguageControlPanel compact={embedded} />
            </div>
            <div className={embedded ? "min-w-0" : "order-3 flex justify-end lg:order-2 lg:h-full lg:items-end"}>
              <div className={embedded ? "flex min-w-0 flex-wrap items-center gap-2" : "flex items-center gap-2"}>
                <PromptSelector compact={embedded} />
                <TranslationServiceDropdown compact={embedded} />
                <TranslationPanelActions compact={embedded} />
              </div>
            </div>

            {/* Row 2: Content */}
            <div className={embedded ? "" : "order-2 lg:order-3"}>
              <TextInput compact={embedded} />
            </div>
            <div className={embedded ? "" : "order-4"}>
              <TranslationPanel compact={embedded} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
