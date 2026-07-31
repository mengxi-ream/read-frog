import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { useAtom, useSetAtom } from "jotai"
import { Activity } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { ConfigurePrompt } from "./configure-prompt"
import { usePromptAtoms } from "./context"
import { ExportPrompts } from "./export-prompts"
import { ImportPrompts } from "./import-prompts"
import { PromptGrid } from "./prompt-grid"

/** `toolbarStart` fills the empty half of the toolbar row, opposite the buttons. */
export function PromptList({ toolbarStart }: { toolbarStart?: ReactNode }) {
  const promptAtoms = usePromptAtoms()
  const [config, setConfig] = useAtom(promptAtoms.config)
  const setSelectedPrompts = useSetAtom(promptAtoms.selectedPrompts)
  const [isExportMode, setIsExportMode] = useAtom(promptAtoms.exportMode)

  const patterns = config.patterns
  const currentPromptId = config.promptId

  const setCurrentPromptId = (value: string | null) => {
    setConfig({
      ...config,
      promptId: value,
    })
  }

  return (
    <section className="w-full">
      <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">{toolbarStart}</div>
        <div className="flex items-center gap-3">
          <Activity mode={isExportMode ? "visible" : "hidden"}>
            <Button
              variant="outline"
              onClick={() => {
                setIsExportMode(false)
                setSelectedPrompts([])
              }}
            >
              <Icon icon="tabler:x" className="size-4" />
              {i18n.t("options.translation.personalizedPrompts.exportPrompt.cancel")}
            </Button>
            <ExportPrompts />
          </Activity>
          <Activity mode={isExportMode ? "hidden" : "visible"}>
            <ImportPrompts />
            <Button
              variant="outline"
              onClick={() => setIsExportMode(true)}
              disabled={patterns.length === 0}
            >
              <Icon icon="tabler:file-import" className="size-4" />
              {i18n.t("options.translation.personalizedPrompts.export")}
            </Button>
            <ConfigurePrompt />
          </Activity>
        </div>
      </div>
      <PromptGrid currentPromptId={currentPromptId} setCurrentPromptId={setCurrentPromptId} />
    </section>
  )
}
