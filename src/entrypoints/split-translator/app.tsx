import type { LangCodeISO6393 } from "@read-frog/definitions"
import { i18n } from "#imports"
import { useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { configAtom } from "@/utils/atoms/config"
import { TextInputForm } from "./components/text-input-form"
import { TranslationResult } from "./components/translation-result"
import { useSplitTextTranslation } from "./hooks/use-split-text-translation"

export default function App() {
  const config = useAtomValue(configAtom)
  const [input, setInput] = useState("")
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<LangCodeISO6393>()
  const { state, translate } = useSplitTextTranslation()
  const isTranslating = state.status === "loading"
  const targetLanguage = selectedTargetLanguage ?? config.language.targetCode
  const previousConfigTargetLanguageRef = useRef(config.language.targetCode)

  useEffect(() => {
    const previousConfigTargetLanguage = previousConfigTargetLanguageRef.current
    const nextConfigTargetLanguage = config.language.targetCode

    if (previousConfigTargetLanguage === nextConfigTargetLanguage) {
      return
    }

    previousConfigTargetLanguageRef.current = nextConfigTargetLanguage

    if (selectedTargetLanguage !== undefined || !input.trim()) {
      return
    }

    void translate(input, nextConfigTargetLanguage)
  }, [config.language.targetCode, input, selectedTargetLanguage, translate])

  const handleTargetLanguageChange = (nextTargetLanguage: LangCodeISO6393) => {
    setSelectedTargetLanguage(nextTargetLanguage)
    if (input.trim()) {
      void translate(input, nextTargetLanguage)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full flex-col gap-4 p-4">
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
          onSubmit={() => void translate(input, targetLanguage)}
          onTargetLanguageChange={handleTargetLanguageChange}
          targetLanguage={targetLanguage}
          disabled={!input.trim()}
          isTranslating={isTranslating}
        />

        <TranslationResult
          state={state}
          onRetry={() => void translate(input, targetLanguage)}
        />
      </main>
    </div>
  )
}
