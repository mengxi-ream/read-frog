import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from "@tanstack/react-form";
import { useCallback } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field";
import { Select } from "@/components/ui/base-ui/select";
import { useFieldContext } from "./form-context";
export function SelectField({ label, ...props }) {
    const field = useFieldContext();
    const errors = useStore(field.store, state => state.meta.errors);
    const hasError = errors.length > 0;
    const handleValueChange = useCallback((value) => {
        if (typeof value !== "string")
            return;
        field.handleChange(value);
    }, [field]);
    return (_jsxs(Field, { invalid: hasError, children: [_jsx(FieldLabel, { nativeLabel: false, render: _jsx("div", {}), children: label }), _jsx(Select, { value: field.state.value, onValueChange: handleValueChange, ...props, children: props.children }), _jsx(FieldError, { match: hasError, children: errors.map(error => typeof error === "string" ? error : error?.message).join(", ") })] }));
}
