import { IconLoader2 } from "@tabler/icons-react"
import { Activity } from "react"
import { CopyButton } from "../../components/copy-button"
import { SelectionSourceContent } from "../../components/selection-source-content"
import { SpeakButton } from "../../components/speak-button"

interface TranslationContentProps {
  selectionContent: string | null | undefined
  translatedText: string | undefined
  isTranslating: boolean
}

export function TranslationContent({ selectionContent, translatedText, isTranslating }: TranslationContentProps) {
  return (
    <div className="p-4">
      <SelectionSourceContent text={selectionContent} separatorClassName="mb-3" />
      <div className="space-y-2">
        <p className="text-sm">
          {isTranslating && !translatedText && <IconLoader2 className="inline size-4 animate-spin" strokeWidth={1.6} />}
          {translatedText}
          {isTranslating && translatedText && " ●"}
        </p>
        <Activity mode={translatedText ? "visible" : "hidden"}>
          <div className="flex items-center gap-1">
            <CopyButton text={translatedText} />
            <SpeakButton text={translatedText} />
          </div>
        </Activity>
      </div>
    </div>
  )
}
