import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { usePromptAtoms } from "./context"
import { downloadJSONFile } from "./utils/prompt-file"

export function ExportPrompts() {
  const promptAtoms = usePromptAtoms()
  const config = useAtomValue(promptAtoms.config)
  const [selectedPrompts, setSelectedPrompts] = useAtom(promptAtoms.selectedPrompts)
  const setIsExportMode = useSetAtom(promptAtoms.exportMode)

  const patterns = config.patterns

  const sortOutDownloadPrompts = patterns
    .filter(pattern => selectedPrompts.includes(pattern.id))
    .map((pattern) => {
      const { id, ...patternWithoutId } = pattern
      return patternWithoutId
    })

  return (
    <Button
      onClick={() => {
        downloadJSONFile(sortOutDownloadPrompts)
        setIsExportMode(false)
        setSelectedPrompts([])
      }}
      disabled={!selectedPrompts.length}
    >
      <Icon icon="tabler:check" className="size-4" />
      {i18n.t("options.translation.personalizedPrompts.exportPrompt.exportSelected")}
    </Button>
  )
}
