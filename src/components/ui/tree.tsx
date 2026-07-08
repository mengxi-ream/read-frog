"use client"

import type { ItemInstance } from "@headless-tree/core"
import { Slot } from "@radix-ui/react-slot"
import { IconChevronDown, IconSquareMinus, IconSquarePlus } from "@tabler/icons-react"
import * as React from "react"
import { useMemo } from "react"
import { cn } from "@/utils/styles/utils"

type ToggleIconType = "chevron" | "plus-minus"

interface TreeContextValue<T = any> {
  indent: number
  currentItem?: ItemInstance<T>
  tree?: any
  toggleIconType?: ToggleIconType
}

const TreeContext = React.createContext<TreeContextValue>({
  indent: 20,
  currentItem: undefined,
  tree: undefined,
  toggleIconType: "plus-minus",
})

function useTreeContext<T = any>() {
  return React.use(TreeContext) as TreeContextValue<T>
}

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  indent?: number
  tree?: any
  toggleIconType?: ToggleIconType
}

function Tree({ indent = 20, tree, className, toggleIconType = "chevron", ...props }: TreeProps) {
  const containerProps =
    tree && typeof tree.getContainerProps === "function" ? tree.getContainerProps() : {}
  const mergedProps = { ...props, ...containerProps }

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    "--tree-indent": `${indent}px`,
  } as React.CSSProperties

  const contextValue = useMemo(
    () => ({ indent, tree, toggleIconType }),
    [indent, tree, toggleIconType],
  )

  return (
    <TreeContext value={contextValue}>
      <div
        data-slot="tree"
        style={mergedStyle}
        className={cn("flex flex-col", className)}
        {...otherProps}
      />
    </TreeContext>
  )
}

interface TreeItemProps<T = any> extends React.HTMLAttributes<HTMLButtonElement> {
  item: ItemInstance<T>
  indent?: number
  asChild?: boolean
}

function TreeItem<T = any>({
  item,
  className,
  asChild,
  children,
  ...props
}: Omit<TreeItemProps<T>, "indent">) {
  const parentContext = useTreeContext<T>()
  const { indent } = parentContext

  const itemProps = typeof item.getProps === "function" ? item.getProps() : {}
  const mergedProps = { ...props, ...itemProps }

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    "--tree-padding": `${item.getItemMeta().level * indent}px`,
  } as React.CSSProperties

  const Comp = asChild ? Slot : "button"

  const contextValue = useMemo(
    () => ({ ...parentContext, currentItem: item }),
    [parentContext, item],
  )

  return (
    <TreeContext value={contextValue}>
      <Comp
        data-slot="tree-item"
        style={mergedStyle}
        className={cn(
          "z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20 data-disabled:pointer-events-none data-disabled:opacity-50",
          className,
        )}
        data-focus={typeof item.isFocused === "function" ? item.isFocused() || false : undefined}
        data-folder={typeof item.isFolder === "function" ? item.isFolder() || false : undefined}
        data-selected={
          typeof item.isSelected === "function" ? item.isSelected() || false : undefined
        }
        data-drag-target={
          typeof item.isDragTarget === "function" ? item.isDragTarget() || false : undefined
        }
        data-search-match={
          typeof item.isMatchingSearch === "function" ? item.isMatchingSearch() || false : undefined
        }
        aria-expanded={item.isExpanded()}
        {...otherProps}
      >
        {children}
      </Comp>
    </TreeContext>
  )
}

interface TreeItemLabelProps<T = any> extends React.HTMLAttributes<HTMLSpanElement> {
  item?: ItemInstance<T>
}

function TreeItemLabel<T = any>({
  item: propItem,
  children,
  className,
  ...props
}: TreeItemLabelProps<T>) {
  const { currentItem, toggleIconType } = useTreeContext<T>()
  const item = propItem || currentItem

  React.useEffect(() => {
    if (!item) {
      console.warn("TreeItemLabel: No item provided via props or context")
    }
  }, [item])

  if (!item) {
    return null
  }

  return (
    <span
      data-slot="tree-item-label"
      className={cn(
        "flex items-center gap-1 rounded-sm bg-background px-2 py-1.5 text-sm transition-colors not-in-data-[folder=true]:ps-7 hover:bg-accent in-focus-visible:ring-[3px] in-focus-visible:ring-ring/50 in-data-[drag-target=true]:bg-accent in-data-[search-match=true]:bg-blue-50! in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {item.isFolder() &&
        (toggleIconType === "plus-minus" ? (
          item.isExpanded() ? (
            <IconSquareMinus
              className="size-3.5 text-muted-foreground"
              stroke="currentColor"
              strokeWidth="1"
            />
          ) : (
            <IconSquarePlus
              className="size-3.5 text-muted-foreground"
              stroke="currentColor"
              strokeWidth="1"
            />
          )
        ) : (
          <IconChevronDown className="size-4 text-muted-foreground in-aria-[expanded=false]:-rotate-90" />
        ))}
      {children || (typeof item.getItemName === "function" ? item.getItemName() : null)}
    </span>
  )
}

function TreeDragLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { tree } = useTreeContext()

  React.useEffect(() => {
    if (!tree || typeof tree.getDragLineStyle !== "function") {
      console.warn(
        "TreeDragLine: No tree provided via context or tree does not have getDragLineStyle method",
      )
    }
  }, [tree])

  if (!tree || typeof tree.getDragLineStyle !== "function") {
    return null
  }

  const dragLine = tree.getDragLineStyle()
  return (
    <div
      style={dragLine}
      className={cn(
        "absolute z-30 -mt-px h-0.5 w-[unset] bg-primary before:absolute before:-top-[3px] before:left-0 before:size-2 before:rounded-full before:border-2 before:border-primary before:bg-background",
        className,
      )}
      {...props}
    />
  )
}

export { Tree, TreeDragLine, TreeItem, TreeItemLabel }
