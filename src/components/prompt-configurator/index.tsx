import type { BuiltInPrompt } from "./built-in-prompts"
import type { PromptAtoms, PromptInsertCell } from "./context"
import { PromptConfiguratorContext } from "./context"
import { PromptList } from "./prompt-list"

export type { CustomPromptsConfig, PromptAtoms } from "./context"
export { usePromptAtoms } from "./context"

interface PromptManagerProps {
  promptAtoms: PromptAtoms
  insertCells: PromptInsertCell[]
  builtInPrompts: BuiltInPrompt[]
  /** Rendered at the start of the toolbar row, opposite the buttons. */
  toolbarStart?: React.ReactNode
}

/**
 * The prompt list with its import/export/add toolbar, wired to one config field. Carries no
 * heading of its own — the caller frames it, as a card or as a page it drilled into.
 */
export function PromptManager({
  promptAtoms,
  insertCells,
  builtInPrompts,
  toolbarStart,
}: PromptManagerProps) {
  return (
    <PromptConfiguratorContext value={{ promptAtoms, insertCells, builtInPrompts }}>
      <PromptList toolbarStart={toolbarStart} />
    </PromptConfiguratorContext>
  )
}
