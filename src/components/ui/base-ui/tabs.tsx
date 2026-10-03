import type { VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/utils/styles/utils"

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      // Upstream only sets the attribute, which leaves Base UI horizontal: vertical
      // tabs then lose `aria-orientation` and keep Left/Right as their arrow keys.
      orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default:
          "items-center justify-center rounded-lg bg-muted p-[3px] group-data-horizontal/tabs:h-8",
        /* The hairline runs under the whole list (beside it, when vertical) and the
           active tab's bar sits on it. Add `w-full` to run the hairline across the
           container: the tabs keep to their labels' width at its start, so a wide
           list doesn't spread them apart. */
        line: "items-stretch group-data-horizontal/tabs:h-10 group-data-horizontal/tabs:border-b group-data-vertical/tabs:border-e",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

type TabsListVariant = NonNullable<VariantProps<typeof tabsListVariants>["variant"]>

// Triggers style themselves, and the line variant renders extra parts, by the list they sit in.
const TabsListVariantContext = React.createContext<TabsListVariant>("default")

/* The bar's slide and the icon's reveal (see TabsTrigger) share one curve and one
   length, so the bar lands under the label as the label settles. Both were read
   off a frame-by-frame capture of X's notification tabs: an ease-out cubic that
   covers 60% of the way in the first 80ms. */
const SLIDE_DURATION = 300
const SLIDE_EASING = "cubic-bezier(0.33, 1, 0.68, 1)"
const SLIDE_ID = "tabs-indicator-slide"

/** The bar of the list's active tab, skipping any nested list's. */
function findActiveIndicator(list: HTMLElement): HTMLElement | null {
  for (const indicator of list.querySelectorAll<HTMLElement>("[data-slot=tabs-indicator]")) {
    if (
      indicator.closest("[role=tablist]") === list &&
      indicator.closest("[data-slot=tabs-trigger]")?.hasAttribute("data-active")
    ) {
      return indicator
    }
  }
  return null
}

/* Every tab draws its own bar, and only the active one shows, so where the bar
   rests is plain CSS: right on the first paint and through any resize or late
   font. The slide is a FLIP laid over that. The new bar starts out transformed
   onto the old one, then lets go. Being a transform, it runs on the compositor,
   which keeps it smooth while the newly opened panel mounts. */
function slideIndicator(from: HTMLElement, to: HTMLElement, vertical: boolean) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

  // Read before cancelling, so a bar caught mid-slide hands over from where it is on screen.
  const start = from.getBoundingClientRect()
  for (const element of [from, to]) {
    for (const animation of element.getAnimations()) {
      if (animation.id === SLIDE_ID) animation.cancel()
    }
  }
  const end = to.getBoundingClientRect()
  const size = vertical ? to.offsetHeight : to.offsetWidth
  if (start.width === 0 || start.height === 0 || end.width === 0 || end.height === 0 || !size)
    return

  /* The rects are in screen pixels and the transform is in the bar's own, which
     differ under a scaled ancestor. The new tab's icon is still at width zero
     here, so `end` is short of where the bar finally rests; it grows with the
     label underneath the transform, and both arrive together. */
  const zoom = (vertical ? end.height : end.width) / size
  const transform = vertical
    ? `translateY(${(start.top - end.top) / zoom}px) scaleY(${start.height / end.height})`
    : `translateX(${(start.left - end.left) / zoom}px) scaleX(${start.width / end.width})`

  to.animate([{ transform }, { transform: "none" }], {
    id: SLIDE_ID,
    duration: SLIDE_DURATION,
    easing: SLIDE_EASING,
  })
}

/* Watches for the active tab changing, however it changed: a click, the keyboard,
   or a controlled `value`. Mutation callbacks run after React has committed the
   new `data-active` but before the frame is painted, so the bar never shows a
   frame in its resting place before it slides. */
function useIndicatorSlide(listRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  React.useEffect(() => {
    const list = listRef.current
    if (!enabled || !list) return undefined

    let current = findActiveIndicator(list)
    const observer = new MutationObserver(() => {
      const next = findActiveIndicator(list)
      if (next === current) return
      const previous = current
      current = next
      if (previous?.isConnected && next)
        slideIndicator(previous, next, list.getAttribute("data-orientation") === "vertical")
    })
    observer.observe(list, { attributes: true, attributeFilter: ["data-active"], subtree: true })
    return () => observer.disconnect()
  }, [enabled, listRef])
}

function TabsList({
  className,
  variant = "default",
  ref,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement>(null)
  // Hands the caller the list itself; the handle is only read once the list has mounted.
  React.useImperativeHandle(ref, () => listRef.current as HTMLDivElement, [])
  const listVariant = variant ?? "default"
  useIndicatorSlide(listRef, listVariant === "line")

  return (
    <TabsListVariantContext value={listVariant}>
      <TabsPrimitive.List
        ref={listRef}
        data-slot="tabs-list"
        data-variant={listVariant}
        className={cn(tabsListVariants({ variant: listVariant }), className)}
        {...props}
      />
    </TabsListVariantContext>
  )
}

const tabsTriggerVariants = cva(
  "group/tabs-trigger relative inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground data-active:text-foreground dark:data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "h-[calc(100%-1px)] flex-1 px-1.5 py-0.5 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 data-active:bg-background data-active:shadow-sm dark:data-active:border-input dark:data-active:bg-input/30",
        line: "border-0 px-3 group-data-horizontal/tabs:h-full group-data-vertical/tabs:py-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

/* In the line variant the label and its icon sit in one box that the bar is
   drawn under, so the bar spans what the tab says rather than the whole tab.

   Laid out side by side, an icon only shows on the active tab (X's
   notifications tabs). It is the box's first child, an `svg` or anything marked
   `data-icon="inline-start"`. Inactive, it is squeezed to zero width, with the
   gap after it cancelled by a negative margin, so the label sits centred on its
   own. Becoming active, both grow back, which slides the label aside while the
   icon fades in; an svg drawn into a narrowing box shrinks with it, so the icon
   also scales. Stacked vertically the labels share a left edge, which an icon
   that comes and goes would break, so there every icon stays. */
const lineContentClassName =
  "inline-flex items-center gap-1.5 group-data-horizontal/tabs:relative group-data-horizontal/tabs:h-full group-data-horizontal/tabs:[&>:is(svg,[data-icon=inline-start]):first-child]:overflow-hidden group-data-horizontal/tabs:[&>:is(svg,[data-icon=inline-start]):first-child]:transition-[width,margin,opacity] group-data-horizontal/tabs:[&>:is(svg,[data-icon=inline-start]):first-child]:duration-300 group-data-horizontal/tabs:[&>:is(svg,[data-icon=inline-start]):first-child]:ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:[&>:is(svg,[data-icon=inline-start]):first-child]:transition-none group-data-horizontal/tabs:not-group-data-active/tabs-trigger:[&>:is(svg,[data-icon=inline-start]):first-child]:-me-1.5 group-data-horizontal/tabs:not-group-data-active/tabs-trigger:[&>:is(svg,[data-icon=inline-start]):first-child]:w-0 group-data-horizontal/tabs:not-group-data-active/tabs-trigger:[&>:is(svg,[data-icon=inline-start]):first-child]:opacity-0"

/* Overhangs the label by 8px a side, as X's does. Vertical, it runs down the
   tab's trailing edge instead, so it is placed against the tab, not the label.
   The origin is the edge the FLIP measures from. */
const lineIndicatorClassName =
  "pointer-events-none absolute rounded-full bg-foreground opacity-0 group-data-active/tabs-trigger:opacity-100 group-data-horizontal/tabs:-inset-x-2 group-data-horizontal/tabs:bottom-0 group-data-horizontal/tabs:h-[3px] group-data-horizontal/tabs:origin-left group-data-vertical/tabs:inset-y-1.5 group-data-vertical/tabs:end-0 group-data-vertical/tabs:w-[3px] group-data-vertical/tabs:origin-top"

function TabsTrigger({ className, children, ...props }: TabsPrimitive.Tab.Props) {
  const variant = React.use(TabsListVariantContext)

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    >
      {variant === "line" ? (
        <span data-slot="tabs-trigger-content" className={lineContentClassName}>
          {children}
          <span aria-hidden data-slot="tabs-indicator" className={lineIndicatorClassName} />
        </span>
      ) : (
        children
      )}
    </TabsPrimitive.Tab>
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, tabsListVariants, TabsTrigger }
