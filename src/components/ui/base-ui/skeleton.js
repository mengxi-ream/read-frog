import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/utils/styles/utils";
function Skeleton({ className, ...props }) {
    return (_jsx("div", { "data-slot": "skeleton", className: cn("bg-muted rounded-md animate-pulse", className), ...props }));
}
export { Skeleton };
