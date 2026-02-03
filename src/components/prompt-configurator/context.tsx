import type { PrimitiveAtom, WritableAtom } from 'jotai'
import type { z } from 'zod'
import type { customPromptsConfigSchema } from '@/types/config/translate'
import { createContext, use } from 'react'

export type CustomPromptsConfig = z.infer<typeof customPromptsConfigSchema>

export interface PromptAtoms {
  config: WritableAtom<CustomPromptsConfig, [CustomPromptsConfig], void>
  exportMode: PrimitiveAtom<boolean>
  selectedPrompts: PrimitiveAtom<string[]>
}

export const PromptConfiguratorContext = createContext<PromptAtoms | null>(null)

export function usePromptAtoms() {
  const atoms = use(PromptConfiguratorContext)
  if (!atoms) {
    throw new Error('usePromptAtoms must be used within PromptConfigurator')
  }
  return atoms
}
