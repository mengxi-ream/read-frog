import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { i18n } from "#imports";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/base-ui/alert-dialog";
import { Button } from "@/components/ui/base-ui/button";
import { usePromptAtoms } from "./context";
export function DeletePrompt({ originPrompt, className, ...props }) {
    const promptAtoms = usePromptAtoms();
    const isExportMode = useAtomValue(promptAtoms.exportMode);
    const [config, setConfig] = useAtom(promptAtoms.config);
    const { patterns, promptId } = config;
    const [open, setOpen] = useState(false);
    const deletePrompt = () => {
        setConfig({
            ...config,
            patterns: patterns.filter(p => p.id !== originPrompt.id),
            promptId: promptId !== originPrompt.id ? promptId : null,
        });
        setOpen(false);
    };
    return (_jsxs(AlertDialog, { open: open, onOpenChange: setOpen, children: [_jsx(AlertDialogTrigger, { render: _jsx(Button, { variant: "ghost", size: "icon", className: className, disabled: isExportMode, ...props }), children: _jsx(Icon, { icon: "tabler:trash", className: "size-4" }) }), _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsxs(AlertDialogTitle, { children: [i18n.t("options.translation.personalizedPrompts.deletePrompt.title"), " ", ":", " ", originPrompt.name] }), _jsxs(AlertDialogDescription, { children: [i18n.t("options.translation.personalizedPrompts.deletePrompt.description"), " ", "?"] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: i18n.t("options.translation.personalizedPrompts.deletePrompt.cancel") }), _jsx(AlertDialogAction, { onClick: deletePrompt, children: i18n.t("options.translation.personalizedPrompts.deletePrompt.confirm") })] })] })] }));
}
