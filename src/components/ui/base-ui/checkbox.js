import { jsx as _jsx } from "react/jsx-runtime";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { IconCheck } from "@tabler/icons-react";
import * as React from "react";
import { cn } from "@/utils/styles/utils";
function Checkbox({ className, onCheckedChange, ...props }) {
    const handleCheckedChange = React.useCallback((checked, _eventDetails) => {
        onCheckedChange?.(checked);
    }, [onCheckedChange]);
    return (_jsx(CheckboxPrimitive.Root, { "data-slot": "checkbox", className: cn("border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex size-4 items-center justify-center rounded-[4px] border shadow-xs transition-shadow group-has-disabled/field:opacity-50 focus-visible:ring-[3px] aria-invalid:ring-[3px] peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50", className), onCheckedChange: handleCheckedChange, ...props, children: _jsx(CheckboxPrimitive.Indicator, { "data-slot": "checkbox-indicator", className: "[&>svg]:size-3.5 grid place-content-center text-current transition-none", children: _jsx(IconCheck, {}) }) }));
}
export { Checkbox };
