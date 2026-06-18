import { jsx as _jsx } from "react/jsx-runtime";
import { Badge } from "@/components/ui/base-ui/badge";
export function NewBadge({ size, className }) {
    return (_jsx(Badge, { variant: "accent", size: size, className: className, children: "New" }));
}
