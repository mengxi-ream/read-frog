import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { useStore } from "jotai"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/base-ui/popover"
import { toastManager } from "@/components/ui/base-ui/toast"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getUiLocale, i18n } from "@/utils/i18n"
import { buildAiConfigHelperPrompt } from "./ai-config-helper-prompt"

const COPIED_FEEDBACK_MS = 1500

function t(key: "trigger" | "title" | "description" | "copy" | "copyFailed") {
  return i18n.t(`options.selectionToolbar.customActions.form.aiConfigHelper.${key}`)
}

// Copies a prompt the user pastes into their own chat assistant, which asks
// what they want and walks them through the settings. The prompt is long, so
// the popover only explains it. It is built on copy, from the form's current
// values: an edit still waiting to autosave is already in it.
export function AiConfigHelperButton({
  getAction,
}: {
  getAction: () => SelectionToolbarCustomAction
}) {
  const store = useStore()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleCopy = async () => {
    const action = getAction()
    const prompt = buildAiConfigHelperPrompt({
      action,
      otherActionNames: store
        .get(configFieldsAtomMap.selectionToolbar)
        .customActions.filter((candidate) => candidate.id !== action.id)
        .map((candidate) => candidate.name),
      uiLocale: getUiLocale(),
      targetCode: store.get(configFieldsAtomMap.language).targetCode,
    })
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      toastManager.add({ type: "error", title: t("copyFailed") })
      return
    }
    setCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(setCopied, COPIED_FEEDBACK_MS, false)
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline-accent" size="xs" />}>
        <Icon icon="tabler:sparkles" />
        {t("trigger")}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3">
        <PopoverHeader>
          <PopoverTitle>{t("title")}</PopoverTitle>
          <PopoverDescription>{t("description")}</PopoverDescription>
        </PopoverHeader>
        <Button type="button" size="sm" onClick={() => void handleCopy()}>
          <Icon icon={copied ? "tabler:check" : "tabler:copy"} />
          {copied ? i18n.t("action.copied") : t("copy")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
