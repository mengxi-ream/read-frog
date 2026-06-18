import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/utils/styles/utils";
function Table({ className, ...props }) {
    return (_jsx("div", { "data-slot": "table-container", className: "relative w-full overflow-x-auto", children: _jsx("table", { "data-slot": "table", className: cn("w-full caption-bottom text-sm", className), ...props }) }));
}
function TableHeader({ className, ...props }) {
    return (_jsx("thead", { "data-slot": "table-header", className: cn("[&_tr]:border-b", className), ...props }));
}
function TableBody({ className, ...props }) {
    return (_jsx("tbody", { "data-slot": "table-body", className: cn("[&_tr:last-child]:border-0", className), ...props }));
}
function TableFooter({ className, ...props }) {
    return (_jsx("tfoot", { "data-slot": "table-footer", className: cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className), ...props }));
}
function TableRow({ className, ...props }) {
    return (_jsx("tr", { "data-slot": "table-row", className: cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", className), ...props }));
}
function TableHead({ className, ...props }) {
    return (_jsx("th", { "data-slot": "table-head", className: cn("text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0", className), ...props }));
}
function TableCell({ className, ...props }) {
    return (_jsx("td", { "data-slot": "table-cell", className: cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className), ...props }));
}
function TableCaption({ className, ...props }) {
    return (_jsx("caption", { "data-slot": "table-caption", className: cn("text-muted-foreground mt-4 text-sm", className), ...props }));
}
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow, };
