import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from "@tanstack/react-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field";
import { Input } from "@/components/ui/base-ui/input";
import { useFieldContext } from "./form-context";
export function InputField({ label, labelExtra, type, ...props }) {
    const field = useFieldContext();
    const errors = useStore(field.store, state => state.meta.errors);
    const hasError = errors.length > 0;
    const handleChange = (e) => {
        const value = e.target.value;
        if (type === "number") {
            if (value === "") {
                field.handleChange(undefined);
            }
            else {
                const num = Number(value);
                if (!Number.isNaN(num)) {
                    field.handleChange(num);
                }
            }
        }
        else {
            field.handleChange(value);
        }
    };
    return (_jsxs(Field, { invalid: hasError, children: [_jsxs("div", { className: "flex items-end justify-between w-full", children: [_jsx(FieldLabel, { nativeLabel: false, render: _jsx("div", {}), children: label }), labelExtra] }), _jsx(Input, { id: field.name, type: type, value: field.state.value ?? "", onBlur: field.handleBlur, onChange: handleChange, "aria-invalid": hasError, ...props }), _jsx(FieldError, { match: hasError, children: errors.map(error => typeof error === "string" ? error : error?.message).join(", ") })] }));
}
