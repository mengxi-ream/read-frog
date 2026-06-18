import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { i18n } from "#imports";
export function LLMStatusIndicator({ hasLLMProvider, featureName }) {
    return (_jsxs("div", { className: "flex items-center gap-1.5 mt-2", children: [_jsx("div", { className: `size-2 rounded-full ${hasLLMProvider ? "bg-green-500" : "bg-orange-400"}` }), _jsx("span", { className: "text-xs", children: hasLLMProvider
                    ? i18n.t("options.translation.llmProviderConfigured", [featureName])
                    : i18n.t("options.translation.llmProviderNotConfigured", [featureName]) })] }));
}
