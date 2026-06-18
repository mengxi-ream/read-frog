import { jsx as _jsx } from "react/jsx-runtime";
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { SHARED_POPUP_CLOSED_STATE_CLASS } from "@/components/ui/base-ui/popup-animation-classes";
import { cn } from "@/utils/styles/utils";
function HoverCard({ ...props }) {
    return _jsx(PreviewCardPrimitive.Root, { "data-slot": "hover-card", ...props });
}
function HoverCardTrigger({ ...props }) {
    return (_jsx(PreviewCardPrimitive.Trigger, { "data-slot": "hover-card-trigger", ...props }));
}
function HoverCardContent({ container, className, side = "bottom", sideOffset = 4, align = "center", alignOffset = 4, ...props }) {
    return (_jsx(PreviewCardPrimitive.Portal, { container: container, "data-slot": "hover-card-portal", children: _jsx(PreviewCardPrimitive.Positioner, { align: align, alignOffset: alignOffset, side: side, sideOffset: sideOffset, className: "isolate z-50", children: _jsx(PreviewCardPrimitive.Popup, { "data-slot": "hover-card-content", className: cn("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground w-64 rounded-lg p-4 text-sm shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 z-50 origin-(--transform-origin) outline-hidden", SHARED_POPUP_CLOSED_STATE_CLASS, className), ...props }) }) }));
}
export { HoverCard, HoverCardContent, HoverCardTrigger };
