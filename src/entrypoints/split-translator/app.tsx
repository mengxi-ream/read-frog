import { i18n } from "#imports"
import { useState } from "react"
import { TextInputForm } from "./components/text-input-form"
import { TranslationResult } from "./components/translation-result"
import { useSplitTextTranslation } from "./hooks/use-split-text-translation"

export default function App() {
  const [input, setInput] = useState("")
  const { state, translate } = useSplitTextTranslation()
  const isTranslating = state.status === "loading"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 p-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">
            {i18n.t("splitTranslator.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {i18n.t("splitTranslator.description")}
          </p>
        </header>

        <TextInputForm
          value={input}
          onChange={setInput}
          onSubmit={() => void translate(input)}
          disabled={!input.trim()}
          isTranslating={isTranslating}
        />

        <TranslationResult
          state={state}
          onRetry={() => void translate(input)}
        />
      </main>
    </div>
  )
}
