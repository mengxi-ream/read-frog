import type { PromptAtoms, PromptInsertCell } from "./context"
import { PromptConfiguratorContext } from "./context"
import { PromptList } from "./prompt-list"

export type { CustomPromptsConfig, PromptAtoms } from "./context"
export { usePromptAtoms } from "./context"

interface PromptManagerProps {
  promptAtoms: PromptAtoms
  insertCells: PromptInsertCell[]
  /** Rendered at the start of the toolbar row, opposite the buttons. */
  toolbarStart?: React.ReactNode
}

/**
 * The prompt list with its import/export/add toolbar, wired to one config field. Carries no
 * heading of its own — the caller frames it, as a card or as a page it drilled into.
 */
export function PromptManager({ promptAtoms, insertCells, toolbarStart }: PromptManagerProps) {
  return (
    <PromptConfiguratorContext value={{ promptAtoms, insertCells }}>
      <PromptList toolbarStart={toolbarStart} />
    </PromptConfiguratorContext>
  )
}
