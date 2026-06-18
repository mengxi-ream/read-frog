import { atom } from "jotai";
export function createPromptAtoms(configAtom) {
    return {
        config: atom(get => get(configAtom).customPromptsConfig, (get, set, newConfig) => {
            void set(configAtom, { ...get(configAtom), customPromptsConfig: newConfig });
        }),
        exportMode: atom(false),
        selectedPrompts: atom([]),
    };
}
