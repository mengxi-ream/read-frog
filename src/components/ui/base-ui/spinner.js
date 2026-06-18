import { jsx as _jsx } from "react/jsx-runtime";
import { IconLoader } from "@tabler/icons-react";
import { cn } from "@/utils/styles/utils";
function Spinner({ className, ...props }) {
    return (_jsx(IconLoader, { role: "status", "aria-label": "Loading", className: cn("size-4 animate-spin", className), ...props }));
}
export { Spinner };
