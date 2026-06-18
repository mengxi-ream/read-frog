"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
function Collapsible({ ...props }) {
    return _jsx(CollapsiblePrimitive.Root, { "data-slot": "collapsible", ...props });
}
function CollapsibleTrigger({ ...props }) {
    return (_jsx(CollapsiblePrimitive.Trigger, { "data-slot": "collapsible-trigger", ...props }));
}
function CollapsibleContent({ ...props }) {
    return (_jsx(CollapsiblePrimitive.Panel, { "data-slot": "collapsible-content", ...props }));
}
export { Collapsible, CollapsibleContent, CollapsibleTrigger };
