import { Icon } from "@iconify/react"
import debounce from "debounce"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useMemo } from "react"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { detectLanguage } from "@/utils/content/language"
import { cn } from "@/utils/styles/utils"
import { detectedSourceLangCodeAtom, exchangeLangCodesAtom, inputTextAtom, sourceLangCodeAtom, targetLangCodeAtom } from "../atoms"
import { SearchableLanguageSelector } from "./searchable-language-selector"

export function LanguageControlPanel({ compact = false }: { compact?: boolean }) {
  const [sourceLangCode, setSourceLangCode] = useAtom(sourceLangCodeAtom)
  const [targetLangCode, setTargetLangCode] = useAtom(targetLangCodeAtom)
  const exchangeLangCodes = useSetAtom(exchangeLangCodesAtom)
  const inputText = useAtomValue(inputTextAtom)
  const [detectedSourceLangCode, setDetectedSourceLangCode] = useAtom(detectedSourceLangCodeAtom)
  const languageDetection = useAtomValue(configFieldsAtomMap.languageDetection)

  // Debounced language detection from input text
  const enableLLM = languageDetection.mode === "llm"
  const debouncedDetect = useMemo(
    () => debounce(async (text: string) => {
      const detected = await detectLanguage(text, {
        minLength: 1,
        enableLLM,
      })
      setDetectedSourceLangCode(detected)
    }, 1000),
    [setDetectedSourceLangCode, enableLLM],
  )

  useEffect(() => {
    void debouncedDetect(inputText)
    return () => debouncedDetect.clear()
  }, [inputText, debouncedDetect])

  const detectedLangCode = detectedSourceLangCode ?? "eng"

  return (
    <div className={cn("flex w-full items-center", compact ? "gap-1.5" : "gap-3")}>
      <SearchableLanguageSelector
        className="flex-1 min-w-0"
        value={sourceLangCode}
        onValueChange={value => void setSourceLangCode(value)}
        detectedLangCode={detectedLangCode}
        label={i18n.t("side.sourceLang")}
      />

      <div className={cn("shrink-0 self-end", compact ? "pb-0" : "pb-0.5")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void exchangeLangCodes()}
          disabled={sourceLangCode === "auto"}
          title={i18n.t("translationHub.exchangeLanguages")}
          className={compact ? "size-9" : undefined}
        >
          <Icon icon="tabler:arrows-exchange" className="h-4 w-4" />
        </Button>
      </div>

      <SearchableLanguageSelector
        className="flex-1 min-w-0"
        value={targetLangCode}
        onValueChange={(value) => {
          if (value !== "auto")
            void setTargetLangCode(value)
        }}
        label={i18n.t("side.targetLang")}
      />
    </div>
  )
}
