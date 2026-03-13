import { IconChevronDown, IconChevronUp, IconLoader2 } from "@tabler/icons-react"
import { Activity, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Separator } from "@/components/ui/base-ui/separator"
import { cn } from "@/utils/styles/utils"
import { CopyButton } from "../../components/copy-button"
import { SpeakButton } from "../../components/speak-button"

interface TranslationContentProps {
  selectionContent: string | null | undefined
  translatedText: string | undefined
  isTranslating: boolean
}

export function TranslationContent({ selectionContent, translatedText, isTranslating }: TranslationContentProps) {
  const [actionsExpanded, setActionsExpanded] = useState(false)

  return (
    <div className="p-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectionContent}</p>
          <Button
            variant="ghost-secondary"
            size="icon-xs"
            className="size-5.5"
            onClick={() => setActionsExpanded(prev => !prev)}
          >
            <Activity mode={actionsExpanded ? "visible" : "hidden"}>
              <IconChevronUp />
            </Activity>
            <Activity mode={actionsExpanded ? "hidden" : "visible"}>
              <IconChevronDown />
            </Activity>
          </Button>
        </div>
        <Activity mode={actionsExpanded ? "visible" : "hidden"}>
          <div className="flex items-center gap-1">
            <CopyButton text={selectionContent ?? undefined} />
            <SpeakButton text={selectionContent ?? undefined} />
          </div>
        </Activity>
      </div>
      <Separator className={cn("mb-3 opacity-60", actionsExpanded ? "mt-1.5" : "mt-3")} />
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
