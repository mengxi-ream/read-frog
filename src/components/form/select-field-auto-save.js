import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from "@tanstack/react-form";
import { useCallback } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field";
import { Select } from "@/components/ui/base-ui/select";
import { useFieldContext } from "./form-context";
export function SelectFieldAutoSave({ formForSubmit, label, labelExtra, ...props }) {
    const field = useFieldContext();
    const errors = useStore(field.store, state => state.meta.errors);
    const hasError = errors.length > 0;
    const handleValueChange = useCallback((value) => {
        if (typeof value !== "string")
            return;
        field.handleChange(value);
        void formForSubmit.handleSubmit();
    }, [field, formForSubmit]);
    return (_jsxs(Field, { invalid: hasError, children: [_jsxs("div", { className: "flex items-end justify-between w-full", children: [_jsx(FieldLabel, { nativeLabel: false, render: _jsx("div", {}), children: label }), labelExtra] }), _jsx(Select, { value: field.state.value, onValueChange: handleValueChange, ...props, children: props.children }), _jsx(FieldError, { match: hasError, children: errors.map(error => typeof error === "string" ? error : error?.message).join(", ") })] }));
}
