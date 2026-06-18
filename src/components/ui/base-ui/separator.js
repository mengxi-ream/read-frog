import { jsx as _jsx } from "react/jsx-runtime";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@/utils/styles/utils";
function Separator({ className, orientation = "horizontal", ...props }) {
    return (_jsx(SeparatorPrimitive, { "data-slot": "separator", orientation: orientation, className: cn("bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch", className), ...props }));
}
export { Separator };
