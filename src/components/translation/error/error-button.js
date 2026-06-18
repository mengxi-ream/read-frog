import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconAlertCircle } from "@tabler/icons-react";
import { use } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/base-ui/hover-card";
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host";
export function ErrorButton({ error }) {
    const shadowWrapper = use(ShadowWrapperContext);
    return (_jsxs(HoverCard, { children: [_jsx(HoverCardTrigger, { delay: 0, closeDelay: 0, render: _jsx(IconAlertCircle, { className: "size-4 text-destructive hover:text-destructive/90 cursor-pointer" }) }), _jsxs(HoverCardContent, { container: shadowWrapper, className: "w-64 notranslate", render: _jsx(Alert, {}), children: [_jsx(IconAlertCircle, { className: "size-4 text-red-500!" }), _jsx(AlertTitle, { children: "Translation Error" }), _jsxs(AlertDescription, { className: "break-all", children: [_jsx(StatusCode, { statusCode: error.statusCode ?? 500 }), _jsx("p", { className: "text-zinc-900 dark:text-zinc-100", children: error.message || "Something went wrong" })] })] })] }));
}
function StatusCode({ statusCode }) {
    const getStatusCodeColor = (code) => {
        const firstDigit = Math.floor(code / 100);
        switch (firstDigit) {
            case 2: return "bg-green-500"; // 2xx - Success
            case 3: return "bg-blue-500"; // 3xx - Redirection
            case 4: return "bg-yellow-500"; // 4xx - Client Error
            case 5: return "bg-red-500"; // 5xx - Server Error
            default: return "bg-gray-500"; // Unknown
        }
    };
    return (_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${getStatusCodeColor(statusCode)}` }), _jsxs("span", { className: "text-sm font-medium", children: ["Status Code:", statusCode] })] }));
}
