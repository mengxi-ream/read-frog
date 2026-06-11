import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { cn } from "@/utils/styles/utils"
import { inputTextAtom, sourceLangCodeAtom, targetLangCodeAtom, translateRequestAtom } from "../atoms"

export function TextInput({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useAtom(inputTextAtom)
  const sourceLangCode = useAtomValue(sourceLangCodeAtom)
  const targetLangCode = useAtomValue(targetLangCodeAtom)
  const setTranslateRequest = useSetAtom(translateRequestAtom)

  const handleTranslate = () => {
    if (!value.trim())
      return
    setTranslateRequest({
      inputText: value,
      sourceLanguage: sourceLangCode,
      targetLanguage: targetLangCode,
      timestamp: Date.now(),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleTranslate()
    }
  }

  return (
    <div
      className="relative"
    >
      <Textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={i18n.t("translationHub.inputPlaceholder")}
        className={cn(
          "min-h-0 resize-none px-4 py-3",
          compact ? "h-52 text-base!" : "h-96 text-lg!",
        )}
        style={{ userSelect: "text" }}
      />

      <Button
        onClick={handleTranslate}
        disabled={!value.trim()}
        size="sm"
        className="absolute bottom-3 right-3"
      >
        {i18n.t("translationHub.translate")}
      </Button>
    </div>
  )
}
