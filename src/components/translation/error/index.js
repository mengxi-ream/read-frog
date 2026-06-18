import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ErrorButton } from "./error-button";
import { RetryButton } from "./retry-button";
export function TranslationError({ nodes, error }) {
    return (_jsxs("div", { className: "notranslate inline-flex items-center justify-center gap-1 px-1.5", children: [_jsx(RetryButton, { nodes: nodes }), _jsx(ErrorButton, { error: error })] }));
}
