import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Button } from "@/components/ui/base-ui/button";
import { Textarea } from "@/components/ui/base-ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip";
import { cn } from "@/utils/styles/utils";
function InsertableTextarea({ className, ref, ...props }) {
    const textareaRef = React.useRef(null);
    React.useImperativeHandle(ref, () => {
        const textarea = textareaRef.current;
        if (!textarea)
            throw new Error("Textarea ref is null");
        return {
            ...textarea,
            insertTextAtCursor(text) {
                const textarea = textareaRef.current;
                if (!textarea)
                    return;
                const { selectionStart, selectionEnd, value } = textarea;
                const newValue = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
                // Get the native value setter to bypass React's control
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                if (nativeInputValueSetter) {
                    // Use the native setter to avoid React's internal tracking conflicts
                    nativeInputValueSetter.call(textarea, newValue);
                    textarea.dispatchEvent(new Event("input", { bubbles: true }));
                }
                const newCursorPos = selectionStart + text.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                textarea.focus();
            },
        };
    }, []);
    return (_jsx(Textarea, { ref: textareaRef, className: className, ...props }));
}
const DEFAULT_INSERT_CELLS = [];
function QuickInsertableTextarea({ className, insertCells = DEFAULT_INSERT_CELLS, cellsClassName, cellClassName, containerClassName, ...props }) {
    const textareaRef = React.useRef(null);
    const handleCellClick = (cellText) => {
        textareaRef.current?.insertTextAtCursor(cellText);
    };
    if (insertCells.length === 0) {
        return (_jsx(InsertableTextarea, { ref: textareaRef, className: className, ...props }));
    }
    return (_jsxs("div", { className: cn("space-y-2 w-full min-w-0", containerClassName), children: [_jsx(InsertableTextarea, { ref: textareaRef, className: className, ...props }), _jsx("div", { className: cn("flex flex-wrap gap-2", cellsClassName), children: insertCells.map(cell => (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx("div", { className: "inline-flex" }), children: _jsx(Button, { type: "button", variant: "outline", size: "sm", className: cellClassName, onClick: () => handleCellClick(cell.text), disabled: props.disabled, children: cell.text }) }), _jsx(TooltipContent, { children: _jsx("p", { children: cell.description }) })] }, cell.text))) })] }));
}
export { InsertableTextarea, QuickInsertableTextarea };
