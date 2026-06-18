"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/base-ui/button";
import { SHARED_POPUP_CLOSED_STATE_CLASS } from "@/components/ui/base-ui/popup-animation-classes";
import { cn } from "@/utils/styles/utils";
function Sheet({ ...props }) {
    return _jsx(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetTrigger({ ...props }) {
    return _jsx(SheetPrimitive.Trigger, { "data-slot": "sheet-trigger", ...props });
}
function SheetClose({ ...props }) {
    return _jsx(SheetPrimitive.Close, { "data-slot": "sheet-close", ...props });
}
function SheetPortal({ ...props }) {
    return _jsx(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({ className, ...props }) {
    return (_jsx(SheetPrimitive.Backdrop, { "data-slot": "sheet-overlay", className: cn("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50", SHARED_POPUP_CLOSED_STATE_CLASS, className), ...props }));
}
function SheetContent({ container, className, children, side = "right", showCloseButton = true, ...props }) {
    return (_jsxs(SheetPortal, { container: container, children: [_jsx(SheetOverlay, {}), _jsxs(SheetPrimitive.Popup, { "data-slot": "sheet-content", "data-side": side, className: cn("bg-background data-open:animate-in data-closed:animate-out data-[side=right]:data-closed:slide-out-to-right-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=top]:data-closed:slide-out-to-top-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:fade-out-0 data-open:fade-in-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=bottom]:data-open:slide-in-from-bottom-10 fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm", SHARED_POPUP_CLOSED_STATE_CLASS, className), ...props, children: [children, showCloseButton && (_jsxs(SheetPrimitive.Close, { "data-slot": "sheet-close", render: (_jsx(Button, { variant: "ghost", className: "absolute top-4 right-4", size: "icon-sm" })), children: [_jsx(IconX, {}), _jsx("span", { className: "sr-only", children: "Close" })] }))] })] }));
}
function SheetHeader({ className, ...props }) {
    return (_jsx("div", { "data-slot": "sheet-header", className: cn("gap-1.5 p-4 flex flex-col", className), ...props }));
}
function SheetFooter({ className, ...props }) {
    return (_jsx("div", { "data-slot": "sheet-footer", className: cn("gap-2 p-4 mt-auto flex flex-col", className), ...props }));
}
function SheetTitle({ className, ...props }) {
    return (_jsx(SheetPrimitive.Title, { "data-slot": "sheet-title", className: cn("text-foreground font-medium", className), ...props }));
}
function SheetDescription({ className, ...props }) {
    return (_jsx(SheetPrimitive.Description, { "data-slot": "sheet-description", className: cn("text-muted-foreground text-sm", className), ...props }));
}
export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, };
