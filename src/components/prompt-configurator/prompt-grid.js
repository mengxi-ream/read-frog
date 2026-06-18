import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAtom, useAtomValue } from "jotai";
import { Activity, useId } from "react";
import { i18n } from "#imports";
import { Badge } from "@/components/ui/base-ui/badge";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle, } from "@/components/ui/base-ui/card";
import { Checkbox } from "@/components/ui/base-ui/checkbox";
import { Label } from "@/components/ui/base-ui/label";
import { Separator } from "@/components/ui/base-ui/separator";
import { DEFAULT_TRANSLATE_PROMPT, DEFAULT_TRANSLATE_PROMPT_ID, DEFAULT_TRANSLATE_SYSTEM_PROMPT } from "@/utils/constants/prompt";
import { cn } from "@/utils/styles/utils";
import { ConfigurePrompt } from "./configure-prompt";
import { usePromptAtoms } from "./context";
import { DeletePrompt } from "./delete-prompt";
export function PromptGrid({ currentPromptId, setCurrentPromptId, }) {
    const promptAtoms = usePromptAtoms();
    const config = useAtomValue(promptAtoms.config);
    const [selectedPrompts, setSelectedPrompts] = useAtom(promptAtoms.selectedPrompts);
    const isExportMode = useAtomValue(promptAtoms.exportMode);
    const patterns = config.patterns;
    const checkboxBaseId = useId();
    // Construct virtual default prompt object from code constant
    const defaultPrompt = {
        id: DEFAULT_TRANSLATE_PROMPT_ID,
        name: i18n.t("options.translation.personalizedPrompts.default"),
        systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT,
        prompt: DEFAULT_TRANSLATE_PROMPT,
    };
    // Prepend default to patterns list
    const allPrompts = [defaultPrompt, ...patterns];
    async function handleCardClick(pattern) {
        const isDefault = pattern.id === DEFAULT_TRANSLATE_PROMPT_ID;
        if (!isExportMode) {
            setCurrentPromptId(isDefault ? null : pattern.id);
        }
        else if (!isDefault) {
            // In export mode, only allow selecting custom prompts (not default)
            setSelectedPrompts((prev) => {
                return prev.includes(pattern.id)
                    ? prev.filter(id => id !== pattern.id)
                    : [...prev, pattern.id];
            });
        }
    }
    return (_jsx("div", { "aria-label": i18n.t("options.translation.personalizedPrompts.title"), className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-96 overflow-auto p-2 select-none", children: allPrompts.map((pattern) => {
            const isDefault = pattern.id === DEFAULT_TRANSLATE_PROMPT_ID;
            const isActive = isDefault ? currentPromptId === null : currentPromptId === pattern.id;
            return (_jsxs(Card, { className: cn("h-full gap-0 pb-2 py-0 cursor-pointer hover:scale-[1.02] transition-transform duration-30 ease-in-out", 
                // for highlight checked card in export mode
                isExportMode ? "has-aria-checked:border-primary has-aria-checked:bg-primary/5 dark:has-aria-checked:border-primary/70 dark:has-aria-checked:bg-primary/10" : ""), children: [_jsx(CardHeader, { className: "grid-rows-1 pt-4 px-4 mb-3", onClick: () => handleCardClick(pattern), children: _jsx(CardTitle, { className: "w-full min-w-0", children: _jsxs("div", { className: "leading-relaxed gap-3 flex items-center w-full h-5", children: [_jsx(Activity, { mode: isExportMode && !isDefault ? "visible" : "hidden", children: _jsx(Checkbox, { id: `${checkboxBaseId}-check-${pattern.id}`, checked: selectedPrompts.includes(pattern.id), onClick: e => e.stopPropagation(), onCheckedChange: (checked) => {
                                                setSelectedPrompts((prev) => {
                                                    return checked
                                                        ? [...prev, pattern.id]
                                                        : prev.filter(id => id !== pattern.id);
                                                });
                                            } }) }), _jsx(Label, { htmlFor: `${checkboxBaseId}-check-${pattern.id}`, className: "flex-1 min-w-0 block truncate cursor-pointer", title: pattern.name, children: pattern.name }), _jsx(Activity, { mode: isActive ? "visible" : "hidden", children: _jsx(Badge, { className: "bg-primary", children: i18n.t("options.translation.personalizedPrompts.current") }) })] }) }) }), _jsx(CardContent, { className: "flex flex-col gap-4 h-16 flex-1 px-4 mb-3", onClick: () => handleCardClick(pattern), children: _jsx("p", { className: "text-sm text-ellipsis whitespace-pre-wrap line-clamp-3", children: pattern.systemPrompt && pattern.prompt
                                ? `${pattern.systemPrompt}\n---\n${pattern.prompt}`
                                : pattern.systemPrompt || pattern.prompt }) }), _jsx(Separator, { className: "my-0" }), _jsxs(CardFooter, { className: "w-full flex justify-between px-4 items-center py-2 cursor-default", children: [_jsx(Activity, { mode: isDefault ? "visible" : "hidden", children: _jsx(CardAction, { children: _jsx(ConfigurePrompt, { originPrompt: pattern }) }) }), _jsxs(Activity, { mode: isDefault ? "hidden" : "visible", children: [_jsx(CardAction, { children: _jsx(DeletePrompt, { originPrompt: pattern }) }), _jsx(CardAction, { children: _jsx(ConfigurePrompt, { originPrompt: pattern }) })] })] })] }, pattern.id));
        }) }));
}
