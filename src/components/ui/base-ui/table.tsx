import * as React from "react"
import { useProximityHover } from "@/hooks/use-proximity-hover"
import { cn } from "@/utils/styles/utils"

interface TableContextValue {
  activeIndex: number | null
  registerItem: (index: number, element: HTMLElement | null) => void
}

// Outside a Table a row has nothing to register with and is never active.
const TableContext = React.createContext<TableContextValue>({
  activeIndex: null,
  registerItem: () => {},
})

interface TableProps extends React.ComponentProps<"table"> {
  /**
   * Classes for the scroll container around the table, which is where a height
   * cap belongs: it is the element that already scrolls, so `max-h-*` there is
   * what a sticky header pins against. Setting one on the table itself would
   * clip rather than scroll.
   */
  containerClassName?: string
}

/**
 * Rows light up through one highlight that follows the pointer to the nearest row rather
 * than a per-row `:hover`, so moving down the table reads as a single moving object. Give
 * every body row an `index`; header rows leave it off.
 */
function Table({ className, containerClassName, ...props }: TableProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { activeIndex, itemRects, session, handlers, registerItem } =
    useProximityHover(containerRef)
  const activeRect = activeIndex === null ? undefined : itemRects[activeIndex]
  const context = React.useMemo(() => ({ activeIndex, registerItem }), [activeIndex, registerItem])

  return (
    <TableContext value={context}>
      <div
        ref={containerRef}
        data-slot="table-container"
        className={cn("relative w-full overflow-x-auto", containerClassName)}
        {...handlers}
      >
        {activeRect && (
          // Keyed on the hover session so each pointer entry mounts a fresh node: a new
          // node has no previous geometry to transition from, which is what stops the
          // highlight from sliding in from whichever row was hovered last time.
          <div
            key={session}
            aria-hidden
            data-slot="table-row-highlight"
            className="pointer-events-none absolute bg-accent transition-[top,left,width,height] duration-[80ms] ease-out motion-reduce:transition-none"
            style={activeRect}
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
        />
      </div>
    </TableContext>
  )
}

function TableHeader(props: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" {...props} />
}

function TableBody(props: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-muted/50 font-medium [&>tr:last-child>*]:border-b-0", className)}
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
  const rowRef = React.useRef<HTMLTableRowElement>(null)
  // Hands the caller the row itself; the handle is only read once the row has mounted.
  React.useImperativeHandle(ref, () => rowRef.current as HTMLTableRowElement, [])
  const { activeIndex, registerItem } = React.useContext(TableContext)

  React.useEffect(() => {
    if (index === undefined) return undefined
    registerItem(index, rowRef.current)
    return () => registerItem(index, null)
  }, [index, registerItem])

  // The highlight draws no border of its own, so the lines it touches — its own bottom
  // border and the row's above it — drop out while it sits there, leaving clean edges.
  // Rows without an index sit just above the first body row.
  const position = index ?? -1
  const hideBorder = activeIndex === position || activeIndex === position + 1

  return (
    <tr
      ref={rowRef}
      data-slot="table-row"
      data-active={activeIndex === index || undefined}
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
