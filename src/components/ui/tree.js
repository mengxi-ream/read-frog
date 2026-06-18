"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { IconChevronDown, IconSquareMinus, IconSquarePlus } from "@tabler/icons-react";
import * as React from "react";
import { useMemo } from "react";
import { cn } from "@/utils/styles/utils";
const TreeContext = React.createContext({
    indent: 20,
    currentItem: undefined,
    tree: undefined,
    toggleIconType: "plus-minus",
});
function useTreeContext() {
    return React.use(TreeContext);
}
function Tree({ indent = 20, tree, className, toggleIconType = "chevron", ...props }) {
    const containerProps = tree && typeof tree.getContainerProps === "function" ? tree.getContainerProps() : {};
    const mergedProps = { ...props, ...containerProps };
    // Extract style from mergedProps to merge with our custom styles
    const { style: propStyle, ...otherProps } = mergedProps;
    // Merge styles
    const mergedStyle = {
        ...propStyle,
        "--tree-indent": `${indent}px`,
    };
    const contextValue = useMemo(() => ({ indent, tree, toggleIconType }), [indent, tree, toggleIconType]);
    return (_jsx(TreeContext, { value: contextValue, children: _jsx("div", { "data-slot": "tree", style: mergedStyle, className: cn("flex flex-col", className), ...otherProps }) }));
}
function TreeItem({ item, className, asChild, children, ...props }) {
    const parentContext = useTreeContext();
    const { indent } = parentContext;
    const itemProps = typeof item.getProps === "function" ? item.getProps() : {};
    const mergedProps = { ...props, ...itemProps };
    // Extract style from mergedProps to merge with our custom styles
    const { style: propStyle, ...otherProps } = mergedProps;
    // Merge styles
    const mergedStyle = {
        ...propStyle,
        "--tree-padding": `${item.getItemMeta().level * indent}px`,
    };
    const Comp = asChild ? Slot : "button";
    const contextValue = useMemo(() => ({ ...parentContext, currentItem: item }), [parentContext, item]);
    return (_jsx(TreeContext, { value: contextValue, children: _jsx(Comp, { "data-slot": "tree-item", style: mergedStyle, className: cn("z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20 data-disabled:pointer-events-none data-disabled:opacity-50", className), "data-focus": typeof item.isFocused === "function" ? item.isFocused() || false : undefined, "data-folder": typeof item.isFolder === "function" ? item.isFolder() || false : undefined, "data-selected": typeof item.isSelected === "function" ? item.isSelected() || false : undefined, "data-drag-target": typeof item.isDragTarget === "function" ? item.isDragTarget() || false : undefined, "data-search-match": typeof item.isMatchingSearch === "function" ? item.isMatchingSearch() || false : undefined, "aria-expanded": item.isExpanded(), ...otherProps, children: children }) }));
}
function TreeItemLabel({ item: propItem, children, className, ...props }) {
    const { currentItem, toggleIconType } = useTreeContext();
    const item = propItem || currentItem;
    React.useEffect(() => {
        if (!item) {
            console.warn("TreeItemLabel: No item provided via props or context");
        }
    }, [item]);
    if (!item) {
        return null;
    }
    return (_jsxs("span", { "data-slot": "tree-item-label", className: cn("in-focus-visible:ring-ring/50 bg-background hover:bg-accent in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-foreground in-data-[drag-target=true]:bg-accent flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm transition-colors not-in-data-[folder=true]:ps-7 in-focus-visible:ring-[3px] in-data-[search-match=true]:bg-blue-50! [&_svg]:pointer-events-none [&_svg]:shrink-0", className), ...props, children: [item.isFolder()
                && (toggleIconType === "plus-minus"
                    ? (item.isExpanded()
                        ? (_jsx(IconSquareMinus, { className: "text-muted-foreground size-3.5", stroke: "currentColor", strokeWidth: "1" }))
                        : (_jsx(IconSquarePlus, { className: "text-muted-foreground size-3.5", stroke: "currentColor", strokeWidth: "1" })))
                    : (_jsx(IconChevronDown, { className: "text-muted-foreground size-4 in-aria-[expanded=false]:-rotate-90" }))), children || (typeof item.getItemName === "function" ? item.getItemName() : null)] }));
}
function TreeDragLine({ className, ...props }) {
    const { tree } = useTreeContext();
    React.useEffect(() => {
        if (!tree || typeof tree.getDragLineStyle !== "function") {
            console.warn("TreeDragLine: No tree provided via context or tree does not have getDragLineStyle method");
        }
    }, [tree]);
    if (!tree || typeof tree.getDragLineStyle !== "function") {
        return null;
    }
    const dragLine = tree.getDragLineStyle();
    return (_jsx("div", { style: dragLine, className: cn("bg-primary before:bg-background before:border-primary absolute z-30 -mt-px h-0.5 w-[unset] before:absolute before:-top-[3px] before:left-0 before:size-2 before:rounded-full before:border-2", className), ...props }));
}
export { Tree, TreeDragLine, TreeItem, TreeItemLabel };
