import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useAtom } from "jotai";
import { useId } from "react";
import { toast } from "sonner";
import { i18n } from "#imports";
import { Button } from "@/components/ui/base-ui/button";
import { Input } from "@/components/ui/base-ui/input";
import { Label } from "@/components/ui/base-ui/label";
import { getRandomUUID } from "@/utils/crypto-polyfill";
import { usePromptAtoms } from "./context";
import { analysisJSONFile } from "./utils/prompt-file";
export function ImportPrompts() {
    const promptAtoms = usePromptAtoms();
    const [config, setConfig] = useAtom(promptAtoms.config);
    const inputId = useId();
    const injectPrompts = (list) => {
        const originPatterns = config.patterns;
        const patterns = list.map(item => ({
            ...item,
            id: getRandomUUID(),
            // Backwards compatibility: add systemPrompt if missing from imported file
            systemPrompt: item.systemPrompt ?? "",
        }));
        setConfig({
            ...config,
            patterns: [...originPatterns, ...patterns],
        });
    };
    const importPrompts = async (e) => {
        try {
            const files = e.target.files;
            if (!files || !files[0])
                return;
            const promptConfig = await analysisJSONFile(files[0]);
            injectPrompts(promptConfig);
            toast.success(`${i18n.t("options.translation.personalizedPrompts.importSuccess")} !`);
        }
        catch (error) {
            if (error instanceof Error) {
                toast.error(error.message);
            }
            else {
                toast.error("Something went error when importing");
            }
        }
        finally {
            e.target.value = "";
            e.target.files = null;
        }
    };
    return (_jsxs(Button, { variant: "outline", className: "p-0", children: [_jsxs(Label, { htmlFor: inputId, className: "w-full px-3", children: [_jsx(Icon, { icon: "tabler:file-import", className: "size-4" }), i18n.t("options.translation.personalizedPrompts.import")] }), _jsx(Input, { type: "file", id: inputId, className: "hidden", accept: ".json", onChange: importPrompts })] }));
}
