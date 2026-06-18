import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cva } from "class-variance-authority";
import { Separator } from "@/components/ui/base-ui/separator";
import { cn } from "@/utils/styles/utils";
function FieldSet({ className, ...props }) {
    return (_jsx("fieldset", { "data-slot": "field-set", className: cn("flex flex-col gap-6", "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3", className), ...props }));
}
function FieldLegend({ className, variant = "legend", ...props }) {
    return (_jsx("legend", { "data-slot": "field-legend", "data-variant": variant, className: cn("mb-3 font-medium", "data-[variant=legend]:text-base", "data-[variant=label]:text-sm", className), ...props }));
}
function FieldGroup({ className, ...props }) {
    return (_jsx("div", { "data-slot": "field-group", className: cn("group/field-group @container/field-group flex w-full flex-col gap-6 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4", className), ...props }));
}
const fieldVariants = cva("group/field flex w-full gap-2 data-[invalid]:text-destructive", {
    variants: {
        orientation: {
            "vertical": ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
            "horizontal": [
                "flex-row items-center",
                "[&>[data-slot=field-label]]:flex-auto",
                "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
            ],
            "responsive": [
                "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto",
                "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
                "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
            ],
            "responsive-compact": [
                "flex-col [&>*]:w-full [&>.sr-only]:w-auto @xs/field-group:flex-row @xs/field-group:items-center @xs/field-group:[&>*]:w-auto",
                "@xs/field-group:[&>[data-slot=field-label]]:flex-auto",
                "@xs/field-group:has-[>[data-slot=field-content]]:items-start @xs/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
            ],
        },
    },
    defaultVariants: {
        orientation: "vertical",
    },
});
function FieldRoot({ className, orientation = "vertical", ...props }) {
    return (_jsx(FieldPrimitive.Root, { "data-slot": "field", "data-orientation": orientation, className: cn(fieldVariants({ orientation }), className), ...props }));
}
function FieldContent({ className, ...props }) {
    return (_jsx("div", { "data-slot": "field-content", className: cn("group/field-content flex flex-1 flex-col gap-1.5 leading-snug", className), ...props }));
}
function FieldLabel({ className, ...props }) {
    return (_jsx(FieldPrimitive.Label, { "data-slot": "field-label", className: cn("group/field-label peer/field-label flex w-fit gap-2 text-sm font-medium leading-snug text-foreground", "group-data-[disabled]/field:opacity-50", 
        // Nested field support
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4", "has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10", className), ...props }));
}
function FieldTitle({ className, ...props }) {
    return (_jsx("div", { "data-slot": "field-label", className: cn("flex w-fit items-center gap-2 text-sm font-medium leading-snug", "group-data-[disabled]/field:opacity-50", className), ...props }));
}
function FieldDescription({ className, ...props }) {
    return (_jsx(FieldPrimitive.Description, { "data-slot": "field-description", className: cn("text-sm font-normal leading-normal text-muted-foreground", "group-has-[[data-orientation=horizontal]]/field:text-balance", 
        // Spacing adjustments
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5", 
        // Link styling
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4", className), ...props }));
}
function FieldControl({ ref: forwardedRef, className, ...props }) {
    return (_jsx(FieldPrimitive.Control, { ref: forwardedRef, "data-slot": "field-control", className: cn("h-8 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground", "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className), ...props }));
}
function FieldError({ className, ...props }) {
    return (_jsx(FieldPrimitive.Error, { "data-slot": "field-error", className: cn("text-sm font-normal text-destructive", className), ...props }));
}
function FieldSeparator({ children, className, ...props }) {
    return (_jsxs("div", { "data-slot": "field-separator", "data-content": !!children, className: cn("relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2", className), ...props, children: [_jsx(Separator, { className: "absolute inset-0 top-1/2" }), children && (_jsx("span", { className: "relative mx-auto block w-fit bg-background px-2 text-muted-foreground", "data-slot": "field-separator-content", children: children }))] }));
}
export { FieldRoot as Field, FieldContent, FieldControl, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldRoot, FieldSeparator, FieldSet, FieldTitle, fieldVariants, };
