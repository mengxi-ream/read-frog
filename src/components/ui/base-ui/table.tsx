import * as React from "react"
import { useProximityHover } from "@/hooks/use-proximity-hover"
import { cn } from "@/utils/styles/utils"

interface TableContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void
  activeIndex: number | null
}

const TableContext = React.createContext<TableContextValue | null>(null)

/**
 * Rows light up through one highlight that follows the pointer to the nearest row rather
 * than a per-row `:hover`, so moving down the table reads as a single moving object. Give
 * every body row an `index`; header rows leave it off.
 */
function Table({ className, children, ...props }: React.ComponentProps<"table">) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { activeIndex, itemRects, sessionRef, handlers, registerItem } =
    useProximityHover(containerRef)

  const activeRect = activeIndex !== null ? itemRects[activeIndex] : null
  const contextValue = React.useMemo(
    () => ({ registerItem, activeIndex }),
    [registerItem, activeIndex],
  )

  return (
    <TableContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        data-slot="table-container"
        className="relative w-full overflow-x-auto"
        onMouseEnter={handlers.onMouseEnter}
        onMouseMove={handlers.onMouseMove}
        onMouseLeave={handlers.onMouseLeave}
      >
        {activeRect && (
          // Keyed on the hover session so each pointer entry mounts a fresh node: a new
          // node has no previous geometry to transition from, which is what stops the
          // highlight from sliding in from whichever row was hovered last time.
          <div
            // oxlint-disable-next-line react/refs -- reading the session id during render is the point -- a new key mounts a fresh node with no geometry to animate from
            key={sessionRef.current}
            aria-hidden
            data-slot="table-row-highlight"
            className="pointer-events-none absolute bg-accent transition-[top,left,width,height] duration-[80ms] ease-out motion-reduce:transition-none"
            style={{
              top: activeRect.top,
              left: activeRect.left,
              width: activeRect.width,
              height: activeRect.height,
            }}
          />
        )}
        <table
          data-slot="table"
          // Separated borders with zero spacing render the same as collapsed ones, but a
          // collapsed border belongs to the table rather than the cell, so it paints
          // outside a sticky header's layer and scrolls out from under it. Row lines
          // therefore live on the cells (see TableRow) and survive a pinned header.
          className={cn(
            "w-full caption-bottom border-separate border-spacing-0 text-[13px]",
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    </TableContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={className} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 font-medium [&>tr:first-child>*]:border-t [&>tr:last-child>*]:border-b-0",
        className,
      )}
      {...props}
    />
  )
}

function TableRow({
  index,
  className,
  ref,
  ...props
}: React.ComponentProps<"tr"> & {
  /** Position among body rows, for the proximity highlight. Omit on header rows. */
  index?: number
}) {
  const rowRef = React.useRef<HTMLTableRowElement | null>(null)
  const context = React.useContext(TableContext)

  React.useEffect(() => {
    if (index === undefined || !context) return undefined
    context.registerItem(index, rowRef.current)
    return () => context.registerItem(index, null)
  }, [index, context])

  const isBodyRow = index !== undefined
  const activeIndex = context?.activeIndex ?? null
  const isActive = isBodyRow && activeIndex === index
  // The highlight draws no border of its own, so the lines it touches — its own bottom
  // border and the row's above it — drop out while it sits there, leaving clean edges.
  const hideBorder =
    activeIndex !== null &&
    (isBodyRow ? index === activeIndex || index === activeIndex - 1 : activeIndex === 0)

  return (
    <tr
      ref={(node) => {
        rowRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      }}
      data-slot="table-row"
      data-active={isActive ? "true" : undefined}
      className={cn(
        "group/row relative z-10 [&>*]:border-b [&>*]:transition-[border-color] [&>*]:duration-[80ms]",
        hideBorder ? "[&>*]:border-transparent" : "[&>*]:border-border/60",
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-3 py-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2 align-middle whitespace-nowrap text-muted-foreground transition-colors duration-[80ms] group-data-[active=true]/row:text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow }
