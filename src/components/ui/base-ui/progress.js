import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@/utils/styles/utils";
function Progress({ className, children, value, ...props }) {
    return (_jsxs(ProgressPrimitive.Root, { value: value, "data-slot": "progress", className: cn("flex flex-wrap gap-3", className), ...props, children: [children, _jsx(ProgressTrack, { children: _jsx(ProgressIndicator, {}) })] }));
}
function ProgressTrack({ className, ...props }) {
    return (_jsx(ProgressPrimitive.Track, { className: cn("bg-muted h-1.5 rounded-full relative flex w-full items-center overflow-x-hidden", className), "data-slot": "progress-track", ...props }));
}
function ProgressIndicator({ className, ...props }) {
    return (_jsx(ProgressPrimitive.Indicator, { "data-slot": "progress-indicator", className: cn("bg-primary h-full transition-all", className), ...props }));
}
function ProgressLabel({ className, ...props }) {
    return (_jsx(ProgressPrimitive.Label, { className: cn("text-sm font-medium", className), "data-slot": "progress-label", ...props }));
}
function ProgressValue({ className, ...props }) {
    return (_jsx(ProgressPrimitive.Value, { className: cn("text-muted-foreground ml-auto text-sm tabular-nums", className), "data-slot": "progress-value", ...props }));
}
export { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue, };
