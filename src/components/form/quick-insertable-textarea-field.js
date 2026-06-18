import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from "@tanstack/react-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field";
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea";
import { useFieldContext } from "./form-context";
export function QuickInsertableTextareaField({ label, insertCells, className, placeholder, }) {
    const field = useFieldContext();
    const errors = useStore(field.store, state => state.meta.errors);
    const hasError = errors.length > 0;
    return (_jsxs(Field, { invalid: hasError, children: [_jsx(FieldLabel, { children: label }), _jsx(QuickInsertableTextarea, { value: field.state.value, onChange: (event) => {
                    field.handleChange(event.target.value);
                }, placeholder: placeholder, "aria-invalid": hasError, className: className, insertCells: insertCells }), _jsx(FieldError, { match: hasError, children: errors.map(error => typeof error === "string" ? error : error?.message).join(", ") })] }));
}
