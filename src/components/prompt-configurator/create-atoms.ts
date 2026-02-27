import type { WritableAtom } from "jotai"
import type { CustomPromptsConfig, PromptAtoms } from "./context"
import { atom } from "jotai"

interface ConfigWithCustomPrompts {
  customPromptsConfig: CustomPromptsConfig
}

export function createPromptAtoms<T extends ConfigWithCustomPrompts>(
  configAtom: WritableAtom<T, [Partial<T>], Promise<void>>,
): PromptAtoms {
  return {
    config: atom(
      get => get(configAtom).customPromptsConfig,
      (get, set, newConfig: CustomPromptsConfig) => {
        void set(configAtom, { ...get(configAtom), customPromptsConfig: newConfig })
      },
    ),
    exportMode: atom(false),
    selectedPrompts: atom<string[]>([]),
  }
}
