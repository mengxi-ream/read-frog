"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/utils/styles/utils";
function Label({ className, ...props }) {
    return (_jsx("label", { "data-slot": "label", className: cn("gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed", className), ...props }));
}
export { Label };
