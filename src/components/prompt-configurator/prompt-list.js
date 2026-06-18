import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from "@iconify/react";
import { useAtom, useSetAtom } from "jotai";
import { Activity } from "react";
import { i18n } from "#imports";
import { Button } from "@/components/ui/base-ui/button";
import { ConfigurePrompt } from "./configure-prompt";
import { usePromptAtoms } from "./context";
import { ExportPrompts } from "./export-prompts";
import { ImportPrompts } from "./import-prompts";
import { PromptGrid } from "./prompt-grid";
export function PromptList() {
    const promptAtoms = usePromptAtoms();
    const [config, setConfig] = useAtom(promptAtoms.config);
    const setSelectedPrompts = useSetAtom(promptAtoms.selectedPrompts);
    const [isExportMode, setIsExportMode] = useAtom(promptAtoms.exportMode);
    const patterns = config.patterns;
    const currentPromptId = config.promptId;
    const setCurrentPromptId = (value) => {
        setConfig({
            ...config,
            promptId: value,
        });
    };
    return (_jsxs("section", { className: "w-full", children: [_jsxs("div", { className: "w-full text-end mb-4 gap-3 flex justify-end", children: [_jsxs(Activity, { mode: isExportMode ? "visible" : "hidden", children: [_jsxs(Button, { variant: "outline", onClick: () => {
                                    setIsExportMode(false);
                                    setSelectedPrompts([]);
                                }, children: [_jsx(Icon, { icon: "tabler:x", className: "size-4" }), i18n.t("options.translation.personalizedPrompts.exportPrompt.cancel")] }), _jsx(ExportPrompts, {})] }), _jsxs(Activity, { mode: isExportMode ? "hidden" : "visible", children: [_jsx(ImportPrompts, {}), _jsxs(Button, { variant: "outline", onClick: () => setIsExportMode(true), disabled: patterns.length === 0, children: [_jsx(Icon, { icon: "tabler:file-import", className: "size-4" }), i18n.t("options.translation.personalizedPrompts.export")] }), _jsx(ConfigurePrompt, {})] })] }), _jsx(PromptGrid, { currentPromptId: currentPromptId, setCurrentPromptId: setCurrentPromptId })] }));
}
