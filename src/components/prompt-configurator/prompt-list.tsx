import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useSetAtom } from "jotai"
import { Activity } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { ConfigurePrompt } from "./configure-prompt"
import { usePromptAtoms } from "./context"
import { ExportPrompts } from "./export-prompts"
import { ImportPrompts } from "./import-prompts"
import { PromptGrid } from "./prompt-grid"

export function PromptList() {
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
      <div className="w-full text-end mb-4 gap-3 flex justify-end">
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
      <PromptGrid
        currentPromptId={currentPromptId}
        setCurrentPromptId={setCurrentPromptId}
      />
    </section>
  )
}
