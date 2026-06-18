import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from "@iconify/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip";
import { cn } from "@/utils/styles/utils";
export function HelpTooltip({ children, contentClassName }) {
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx("span", { className: "inline-flex items-center" }), children: _jsx(Icon, { icon: "tabler:help", className: "size-3 text-muted-foreground cursor-help" }) }), _jsx(TooltipContent, { className: cn("max-w-64", contentClassName), children: _jsx("p", { children: children }) })] }));
}
