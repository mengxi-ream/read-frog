"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { SHARED_POPUP_CLOSED_STATE_CLASS } from "@/components/ui/base-ui/popup-animation-classes";
import { cn } from "@/utils/styles/utils";
function Popover({ ...props }) {
    return _jsx(PopoverPrimitive.Root, { "data-slot": "popover", ...props });
}
function PopoverTrigger({ ...props }) {
    return _jsx(PopoverPrimitive.Trigger, { "data-slot": "popover-trigger", ...props });
}
function PopoverContent({ container, className, positionerClassName, align = "center", alignOffset = 0, side = "bottom", sideOffset = 4, ...props }) {
    return (_jsx(PopoverPrimitive.Portal, { container: container, children: _jsx(PopoverPrimitive.Positioner, { align: align, alignOffset: alignOffset, side: side, sideOffset: sideOffset, className: cn("isolate z-50", positionerClassName), children: _jsx(PopoverPrimitive.Popup, { "data-slot": "popover-content", className: cn("bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 flex flex-col gap-2.5 rounded-lg p-2.5 text-sm shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 z-50 w-72 origin-(--transform-origin) outline-hidden", SHARED_POPUP_CLOSED_STATE_CLASS, className), ...props }) }) }));
}
function PopoverHeader({ className, ...props }) {
    return (_jsx("div", { "data-slot": "popover-header", className: cn("flex flex-col gap-0.5 text-sm", className), ...props }));
}
function PopoverTitle({ className, ...props }) {
    return (_jsx(PopoverPrimitive.Title, { "data-slot": "popover-title", className: cn("font-medium", className), ...props }));
}
function PopoverDescription({ className, ...props }) {
    return (_jsx(PopoverPrimitive.Description, { "data-slot": "popover-description", className: cn("text-muted-foreground", className), ...props }));
}
export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger, };
