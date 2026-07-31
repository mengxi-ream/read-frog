import { IconArrowUpRight, IconX } from "@tabler/icons-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import * as React from "react"
import { Link, useInRouterContext } from "react-router"
import { useProximityHover } from "@/hooks/use-proximity-hover"
import { spring } from "@/utils/styles/springs"
import { cn } from "@/utils/styles/utils"

/**
 * shadcn's compositional card dressed in Fluid Functionalism — a port of
 * fluidfunctionalism.com/docs/card. Same anatomy as the plain `Card` next door (header,
 * title, description, action, content, footer), with a sibling `FluidCardGroup` that owns
 * layout — stacked list, inline rows, or grid — plus the magnetic proximity highlight that
 * previews where a click will land, the same one `Table` uses on its rows.
 *
 * Deliberately kept beside `card.tsx` rather than replacing it: the surface here is
 * transparent and borderless by default, leaning on hairline dividers and the highlight
 * instead of a drawn frame, so the two are not drop-in substitutes for one another.
 */

/**
 * The source draws its hover highlight and its persistent selected fill from two separate
 * tokens. This theme's neutral surfaces — `accent`, `muted`, `secondary` — all resolve to
 * the same colour, so a pair taken from them would be indistinguishable. These are tints
 * over whatever substrate the card sits on instead, which is what the source's tokens are:
 * two steps of the foreground colour, so they flip with the theme on their own and stack
 * readably — a hovered *selected* card still reads as deeper than a merely hovered one.
 */
const HOVER_TINT = "bg-foreground/[0.045]"
const SELECTED_TINT = "bg-foreground/[0.09]"
/**
 * The same tint on `:hover`, for a standalone card with no group highlight to lean on.
 * Spelled out rather than composed from `HOVER_TINT`, because Tailwind only generates a
 * class it can find written in full in the source.
 */
const HOVER_TINT_ON_HOVER = "hover:bg-foreground/[0.045]"

/** The whole-card click target sits above the content, so it carries the card's own ring. */
const STRETCHED_TARGET =
  "absolute inset-0 z-20 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

/**
 * `spring.fast` bundles its exit tween under `.exit`; split it out so neither leaks into
 * the other's transition object.
 */
const { exit: fastExit, ...fastEnter } = spring.fast

/**
 * Any icon component that takes a `className`. Sized and weighted through Tailwind like
 * the rest of base-ui, so tabler / lucide / remix icons are interchangeable in these slots.
 */
type FluidCardIcon = React.ComponentType<{ className?: string }>

type FluidCardOrientation = "card" | "inline"
type FluidCardBorder = "none" | "outlined"

// ── Group context ─────────────────────────────────────────────────────────────

interface FluidCardGroupContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void
  activeIndex: number | null
  /**
   * Index of the persistently selected card, or -1. Its neighbours drop the hairline that
   * would otherwise cut across the selection fill.
   */
  selectedIndex: number
  orientation: FluidCardOrientation
  columns: number
  count: number
  /** Cards carry their own tile shape rather than sharing the group's frame. */
  separated: boolean
  /** Hairlines are drawn between adjacent cards. */
  divided: boolean
  outlined: boolean
}

const FluidCardGroupContext = React.createContext<FluidCardGroupContextValue | null>(null)

// ── Per-card context ──────────────────────────────────────────────────────────

/**
 * Lets the compositional parts adapt to the card they sit in without threading props: the
 * title reads `emphasized` to animate its weight, the rest read `orientation` to switch
 * padding and flow.
 */
interface FluidCardContextValue {
  emphasized: boolean
  orientation: FluidCardOrientation
  /**
   * An inline card holding a full image centres its text and actions in a column beside
   * the image, so the footer drops below the text instead of trailing to the right.
   */
  hasImage: boolean
}

const FluidCardContext = React.createContext<FluidCardContextValue>({
  emphasized: false,
  orientation: "card",
  hasImage: false,
})

// ── Link ──────────────────────────────────────────────────────────────────────

type FluidCardLinkProps = Omit<React.ComponentProps<"a">, "href" | "target" | "rel"> & {
  href: string
  external?: boolean
}

/**
 * Renders a real anchor, so a card works wherever it is mounted — popup, content script,
 * options page. Inside the options router it upgrades to a react-router link so an in-app
 * route navigates in place rather than reloading the page.
 */
function FluidCardLink({ href, external, ...props }: FluidCardLinkProps) {
  const inRouterContext = useInRouterContext()

  if (inRouterContext && !external) {
    return <Link to={href} {...props} />
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      {...props}
    />
  )
}

// ── FluidCardGroup ────────────────────────────────────────────────────────────

interface FluidCardGroupProps extends Omit<React.ComponentProps<"div">, "onDrag"> {
  /**
   * How each card lays its own content out. "card" stacks it vertically (media and header
   * on top); "inline" runs it as a horizontal row — leading media, trailing footer — like
   * a table row.
   */
  orientation?: FluidCardOrientation
  /** Grid columns. More than one resolves proximity across rows *and* columns. */
  columns?: number
  /**
   * "none" separates cards with hairlines alone; "outlined" draws a border — one shared
   * frame around the block, or one per card when `separated`.
   */
  border?: FluidCardBorder
  /** Split into individually shaped tiles with a gap, instead of one continuous block. */
  separated?: boolean
  /** Enable the magnetic proximity-hover highlight. */
  proximityHover?: boolean
}

/**
 * Owns layout and the shared proximity highlight for the cards inside it.
 *
 * Each child is assigned its proximity index here, so `FluidCard` elements have to be
 * *direct* children — including as a mapped array, which React flattens. Wrapping them in
 * a component of your own (`<MyCards />` returning several cards) leaves the group seeing
 * one child, and both the highlight and the hairlines quietly go missing.
 */
function FluidCardGroup({
  orientation = "card",
  columns = 1,
  border = "none",
  separated = false,
  proximityHover = true,
  className,
  children,
  style,
  ref,
  ...props
}: FluidCardGroupProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()
  // More than one column wraps into a grid, where the nearest item has to be resolved in
  // two dimensions; a single column is a plain vertical list.
  const { activeIndex, itemRects, sessionRef, handlers, registerItem, measureItems } =
    useProximityHover(containerRef, { axis: columns > 1 ? "xy" : "y" })

  // Assign each child a stable proximity index, so callers never thread one through by
  // hand the way Table asks them to — here the group owns it.
  const childArray = React.Children.toArray(children).filter(React.isValidElement)
  const count = childArray.length
  const indexed = childArray.map((child, index) =>
    React.cloneElement(child as React.ReactElement<{ index?: number }>, { index }),
  )
  // Which card is selected, so its neighbours can drop the divider that would otherwise
  // slice through the selection fill.
  const selectedIndex = childArray.findIndex(
    (child) => (child.props as { selected?: boolean }).selected,
  )

  const outlined = border === "outlined"
  const divided = !separated

  // Registration and container resize both schedule a remeasure on their own; these are
  // the props that reflow the cards *inside* a container whose own box may not change.
  React.useEffect(() => {
    measureItems()
  }, [measureItems, count, columns, orientation, separated, border])

  const contextValue = React.useMemo<FluidCardGroupContextValue>(
    () => ({
      registerItem,
      activeIndex,
      selectedIndex,
      orientation,
      columns,
      count,
      separated,
      divided,
      outlined,
    }),
    [
      registerItem,
      activeIndex,
      selectedIndex,
      orientation,
      columns,
      count,
      separated,
      divided,
      outlined,
    ],
  )

  const activeRect = proximityHover && activeIndex !== null ? itemRects[activeIndex] : null

  return (
    <FluidCardGroupContext.Provider value={contextValue}>
      <div
        ref={(node) => {
          containerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        {...props}
        data-slot="fluid-card-group"
        data-orientation={orientation}
        className={cn(
          "relative grid",
          // A shared frame clips the highlight and the hairlines to its rounded corners;
          // separated tiles clip themselves.
          outlined && !separated && "overflow-hidden rounded-xl border border-border/60",
          separated ? "gap-2" : "gap-0",
          className,
        )}
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`,
          ...style,
        }}
        onMouseEnter={proximityHover ? handlers.onMouseEnter : undefined}
        onMouseMove={proximityHover ? handlers.onMouseMove : undefined}
        onMouseLeave={proximityHover ? handlers.onMouseLeave : undefined}
      >
        {/*
          One magnetic layer that springs to the card nearest the pointer, previewing where
          a click will land. Keyed on the hover session so each pointer entry mounts a fresh
          node: a new node has no previous geometry to transition from, which is what stops
          the highlight from sliding in from whichever card was hovered last time.
        */}
        <AnimatePresence>
          {activeRect && (
            <motion.div
              key={sessionRef.current}
              aria-hidden
              data-slot="fluid-card-highlight"
              className={cn("pointer-events-none absolute z-0 rounded-xl", HOVER_TINT)}
              initial={{ opacity: 0, ...activeRect }}
              animate={{ opacity: 1, ...activeRect }}
              exit={{ opacity: 0, transition: reduceMotion ? { duration: 0 } : fastExit }}
              transition={
                reduceMotion ? { duration: 0 } : { ...fastEnter, opacity: { duration: 0.08 } }
              }
            />
          )}
        </AnimatePresence>

        {indexed}
      </div>
    </FluidCardGroupContext.Provider>
  )
}

// ── FluidCard ─────────────────────────────────────────────────────────────────

interface FluidCardProps extends Omit<React.ComponentProps<"div">, "onClick"> {
  /**
   * Makes the whole card an interactive target that proximity hover previews. Renders a
   * stretched link when `href` is set, otherwise a stretched button.
   */
  onClick?: () => void
  href?: string
  external?: boolean
  /**
   * Accessible name for the stretched link or button — the card's visible title is not
   * wired up to it automatically.
   */
  label?: string
  /** Persistent selected state, on top of the transient proximity hover. */
  selected?: boolean
  disabled?: boolean
  dismissible?: boolean
  onDismiss?: () => void
  /** Injected by FluidCardGroup — do not set by hand. */
  index?: number
}

function FluidCard({
  onClick,
  href,
  external,
  label,
  selected = false,
  disabled = false,
  dismissible = false,
  onDismiss,
  index,
  className,
  children,
  ref,
  ...props
}: FluidCardProps) {
  const internalRef = React.useRef<HTMLDivElement | null>(null)
  const group = React.useContext(FluidCardGroupContext)

  const orientation = group?.orientation ?? "card"
  const columns = group?.columns ?? 1
  const count = group?.count ?? 1
  const separated = group?.separated ?? true
  const divided = group?.divided ?? false
  const outlined = group?.outlined ?? false
  const activeIndex = group?.activeIndex ?? null
  const selectedIndex = group?.selectedIndex ?? -1

  // Depend on the stable registerItem callback rather than the whole group context: the
  // context object's identity changes on every proximity frame, which would otherwise
  // re-register every card each frame.
  const registerItem = group?.registerItem
  React.useEffect(() => {
    if (index === undefined || !registerItem) return undefined
    registerItem(index, internalRef.current)
    return () => registerItem(index, null)
  }, [index, registerItem])

  // Divider geometry: draw a hairline toward the neighbour below and to the right, but
  // drop it next to the active *or* selected card so the highlight and the selection fill
  // read clean — the same trick Table plays on its row borders.
  const self = index ?? -1
  const col = index === undefined ? 0 : index % columns
  const hasBelow = index !== undefined && index + columns < count
  const hasRight = index !== undefined && col < columns - 1 && index + 1 < count
  const touchesBelow = (other: number) => other === self || other === self + columns
  const touchesRight = (other: number) => other === self || other === self + 1
  const showBottom =
    divided && hasBelow && !(touchesBelow(activeIndex ?? -1) || touchesBelow(selectedIndex))
  const showRight =
    divided && hasRight && !(touchesRight(activeIndex ?? -1) || touchesRight(selectedIndex))

  const isInline = orientation === "inline"
  // An inline card with a full-bleed image reflows so its actions stack under the text.
  // Match the image child by identity *or* displayName, so detection and the split below
  // agree even when module identity drifts (HMR duplication).
  const isImageChild = (child: React.ReactNode) =>
    React.isValidElement(child) &&
    (child.type === FluidCardImage ||
      (child.type as { displayName?: string })?.displayName === "FluidCardImage")
  const hasImage = React.Children.toArray(children).some(isImageChild)
  const inlineImage = isInline && hasImage
  const clickable = !!href || !!onClick

  // A card outside a group is its own tile — always rounded and clipped. Inside one, a
  // separated tile carries its own rounding and clip only when it draws a visible frame: a
  // borderless separated tile has no surface to hug, so it stays unclipped and its media
  // reads as a plain rectangle, while a card in a continuous block leans on the shared
  // group frame for both.
  const tileShape = !group
    ? "overflow-hidden rounded-xl"
    : separated && outlined
      ? "overflow-hidden rounded-xl border border-border/60"
      : ""

  // The stretched overlay makes the whole card the click target while keeping action
  // buttons (higher z) independently clickable — the accessible alternative to nesting
  // interactive elements inside a button or anchor. A disabled card drops the overlay
  // entirely so it cannot be tabbed to or activated by keyboard; `pointer-events-none`
  // alone would only block the mouse.
  const overlay =
    clickable && !disabled ? (
      href ? (
        <FluidCardLink
          href={href}
          external={external}
          onClick={onClick}
          aria-label={label}
          className={STRETCHED_TARGET}
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={selected || undefined}
          className={STRETCHED_TARGET}
        />
      )
    ) : null

  const cardContext = React.useMemo<FluidCardContextValue>(
    // The title's weight follows the persistent selected state only — proximity hover
    // previews through the highlight fill, not by bolding the label.
    () => ({ emphasized: selected, orientation, hasImage }),
    [selected, orientation, hasImage],
  )

  // Inline image cards wrap their non-image parts in a centred column, so the title,
  // description and actions hug together against the image instead of stretching to its
  // full height.
  let body: React.ReactNode = children
  if (inlineImage) {
    const parts = React.Children.toArray(children)
    const image = parts.find(isImageChild)
    body = (
      <>
        {image}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-3.5 pr-4">
          {parts.filter((part) => part !== image)}
        </div>
      </>
    )
  }

  return (
    <FluidCardContext.Provider value={cardContext}>
      <div
        ref={(node) => {
          internalRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        data-slot="fluid-card"
        data-proximity-index={index}
        data-selected={selected || undefined}
        data-orientation={orientation}
        aria-disabled={disabled || undefined}
        className={cn(
          "relative z-10 min-h-[60px] min-w-0",
          inlineImage
            ? // Image on the left; the text and actions ride in a centred column beside it.
              "flex flex-row items-center gap-3"
            : isInline
              ? "flex flex-row items-center gap-3 pl-4"
              : "flex flex-col pb-4",
          // A standalone card cannot lean on the group highlight, so it carries its own
          // hover tint when interactive.
          !group &&
            clickable &&
            !disabled &&
            cn(
              "transition-colors duration-[80ms] motion-reduce:transition-none",
              HOVER_TINT_ON_HOVER,
            ),
          tileShape,
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...props}
      >
        {/*
          The selected fill and the hairlines sit behind the static content (-z-10); the
          stretched overlay (z-20) sits above it so the whole card is clickable, and the
          actions and dismiss control (z-30) rise above the overlay to stay independently
          interactive.
        */}
        {selected && (
          <span
            aria-hidden
            className={cn("pointer-events-none absolute inset-0 -z-10 rounded-xl", SELECTED_TINT)}
          />
        )}

        {/*
          Hairlines between borderless neighbours. Where both meet, the vertical one stops a
          pixel short so the horizontal one owns the crossing: two 60% lines stacked there
          would read brighter than the rest of the grid.
        */}
        {showBottom && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-px bg-border/60"
          />
        )}
        {showRight && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 right-0 -z-10 w-px bg-border/60",
              showBottom ? "bottom-px" : "bottom-0",
            )}
          />
        )}

        {overlay}

        {body}

        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute top-2 right-2 z-30 flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-[80ms] outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
          >
            <IconX className="size-4 stroke-[1.5]" />
          </button>
        )}
      </div>
    </FluidCardContext.Provider>
  )
}

// ── FluidCardHeader ───────────────────────────────────────────────────────────

/**
 * shadcn's header grid — title and description stacked, with the action pinned to the
 * top-right column. In an inline card it becomes the flexible text column between the
 * leading media and the trailing footer.
 */
function FluidCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation, hasImage } = React.useContext(FluidCardContext)
  const inlineImage = orientation === "inline" && hasImage

  return (
    <div
      data-slot="fluid-card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1 has-data-[slot=fluid-card-action]:grid-cols-[1fr_auto]",
        inlineImage ? "min-w-0" : orientation === "inline" ? "min-w-0 flex-1 py-3.5" : "px-4 pt-4",
        className,
      )}
      {...props}
    />
  )
}

// ── FluidCardTitle ────────────────────────────────────────────────────────────

function FluidCardTitle({ className, children, ...props }: React.ComponentProps<"span">) {
  const { emphasized, orientation } = React.useContext(FluidCardContext)
  // Inline rows trim the title to cap height so it centres tightly against the media and
  // the actions; stacked cards keep the natural line box.
  const trim = orientation === "inline" ? "[text-box:trim-both_cap_alphabetic]" : ""

  return (
    <span
      data-slot="fluid-card-title"
      className={cn("inline-grid text-sm leading-snug", className)}
      {...props}
    >
      {/*
        Ghost-span pattern: an invisible semibold copy reserves the width, so the resting →
        emphasised weight animation never reflows the row.
      */}
      <span
        aria-hidden="true"
        className={cn("invisible col-start-1 row-start-1 font-semibold", trim)}
      >
        {children}
      </span>
      <span
        className={cn(
          "col-start-1 row-start-1 text-foreground transition-[font-weight] duration-[80ms] motion-reduce:transition-none",
          emphasized ? "font-semibold" : "font-normal",
          trim,
        )}
      >
        {children}
      </span>
    </span>
  )
}

// ── FluidCardDescription ──────────────────────────────────────────────────────

function FluidCardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="fluid-card-description"
      className={cn("text-sm leading-normal text-muted-foreground", className)}
      {...props}
    />
  )
}

// ── FluidCardAction ───────────────────────────────────────────────────────────

/**
 * Pinned to the header's top-right column. Sits above the stretched overlay so whatever
 * control it holds stays independently clickable.
 */
function FluidCardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="fluid-card-action"
      className={cn(
        "relative z-30 col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  )
}

// ── FluidCardContent ──────────────────────────────────────────────────────────

function FluidCardContent({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = React.useContext(FluidCardContext)

  return (
    <div
      data-slot="fluid-card-content"
      className={cn(orientation === "inline" ? "" : "px-4 pt-3", className)}
      {...props}
    />
  )
}

// ── FluidCardFooter ───────────────────────────────────────────────────────────

/**
 * The actions row. Rises above the stretched overlay so its buttons stay clickable. In an
 * inline card it becomes the trailing, right-aligned slot.
 */
function FluidCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation, hasImage } = React.useContext(FluidCardContext)
  const inlineImage = orientation === "inline" && hasImage

  return (
    <div
      data-slot="fluid-card-footer"
      className={cn(
        "relative z-30 flex items-center gap-1",
        inlineImage
          ? // Under the text, left-aligned in natural order — the inline wrapper owns the
            // spacing.
            "flex-wrap"
          : orientation === "inline"
            ? "ml-auto shrink-0 pr-4"
            : "flex-wrap px-4 pt-3",
        className,
      )}
      {...props}
    />
  )
}

// ── FluidCardMedia ────────────────────────────────────────────────────────────

type FluidCardLogo = string | [string, string]

interface FluidCardMediaProps {
  /** A single logo, or a pair rendered as a connected tuple (e.g. a trigger → target). */
  logo?: FluidCardLogo
  logoAlt?: string
  icon?: FluidCardIcon
  /** Logo edge length in px. Icons are fixed at 18px inside a 32px tile. */
  size?: number
  className?: string
}

/**
 * The leading icon or brand logo. Not part of shadcn's anatomy, but the connective tissue
 * most product cards need.
 */
function FluidCardMedia({ logo, logoAlt, icon: Icon, size = 22, className }: FluidCardMediaProps) {
  const { orientation } = React.useContext(FluidCardContext)
  // Stacked, it sits in the header grid: the extra 8px makes the gap below the icon read
  // as 12px (header gap-1 + mb-2). Inline, the card already owns the left inset.
  const wrap = cn(orientation === "inline" ? "" : "mb-2", className)

  if (logo) {
    const logos = Array.isArray(logo) ? logo : [logo]
    return (
      <span
        data-slot="fluid-card-media"
        className={cn("inline-flex shrink-0 items-center gap-1.5", wrap)}
      >
        {logos.map((src, index) => (
          <span key={src} className="inline-flex items-center gap-1.5">
            {index > 0 && <span aria-hidden className="h-px w-2 bg-border" />}
            <img
              src={src}
              alt={logoAlt ?? ""}
              width={size}
              height={size}
              className="rounded-lg object-contain"
              style={{ width: size, height: size }}
            />
          </span>
        ))}
      </span>
    )
  }

  if (Icon) {
    // The icon sits in a 32×32 tinted tile so it reads as a media slot rather than a bare
    // glyph. The tile is a tint, not a solid surface, so it blends over whatever is behind
    // it — the substrate, or the hover highlight.
    return (
      <span
        data-slot="fluid-card-media"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
          HOVER_TINT,
          wrap,
        )}
      >
        <Icon className="size-4.5 stroke-[1.5] text-muted-foreground" />
      </span>
    )
  }

  return null
}

// ── FluidCardImage ────────────────────────────────────────────────────────────

interface FluidCardImageProps {
  src: string
  alt?: string
  className?: string
}

/**
 * The prominent, full-bleed image, as distinct from a small logo. Stacked it is a top
 * banner; inline it is a full-height leading image on the left, flush against the edge.
 */
function FluidCardImage({ src, alt, className }: FluidCardImageProps) {
  const { orientation } = React.useContext(FluidCardContext)

  return (
    <img
      src={src}
      alt={alt ?? ""}
      data-slot="fluid-card-image"
      // The image keeps a fixed 2px radius in every state — stacked or inline, framed or
      // borderless — rather than inheriting a frame's larger clip. A framed tile still
      // clips the surrounding surface as before.
      className={cn(
        "rounded-[2px] object-cover",
        orientation === "inline" ? "size-40 shrink-0" : "aspect-video w-full",
        className,
      )}
    />
  )
}

/**
 * A stable marker so FluidCard can recognise an image child by name, surviving the module
 * identity mismatches (HMR duplication) that break `type ===`.
 */
FluidCardImage.displayName = "FluidCardImage"

// ── FluidCardEyebrow ──────────────────────────────────────────────────────────

/** Small uppercase label above the title, e.g. "New model". */
function FluidCardEyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="fluid-card-eyebrow"
      className={cn(
        "text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  )
}

// ── FluidCardFeature ──────────────────────────────────────────────────────────

interface FluidCardFeatureProps {
  icon?: FluidCardIcon
  title: string
  description?: string
}

/** An icon + title + description row, for feature lists inside the content region. */
function FluidCardFeature({ icon: Icon, title, description }: FluidCardFeatureProps) {
  return (
    <div data-slot="fluid-card-feature" className="flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-muted-foreground" />}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground [text-box:trim-both_cap_alphabetic]">
          {title}
        </span>
        {description && (
          <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
        )}
      </div>
    </div>
  )
}

// ── FluidCardButton ───────────────────────────────────────────────────────────

type FluidCardButtonVariant = "primary" | "secondary" | "ghost" | "link"

const FLUID_CARD_BUTTON_VARIANTS: Record<FluidCardButtonVariant, string> = {
  primary: "bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80",
  secondary: "bg-accent text-foreground hover:bg-accent/80 active:bg-accent",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent",
  link: "text-foreground underline-offset-4 hover:underline px-0! h-auto!",
}

interface FluidCardButtonProps {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: FluidCardButtonVariant
  icon?: FluidCardIcon
  /** Which side the icon sits on. Defaults to the end for external actions, else the start. */
  iconPosition?: "start" | "end"
  /** Opens the href in a new tab and appends an outward arrow. */
  external?: boolean
  disabled?: boolean
}

/**
 * A self-contained action for the footer. Kept free of a `Button` dependency so the card
 * stands on its own; reach for `Button` directly when you want the full variant set.
 */
function FluidCardButton({
  children,
  onClick,
  href,
  variant = "ghost",
  icon: Icon,
  iconPosition,
  external = false,
  disabled = false,
}: FluidCardButtonProps) {
  const position = iconPosition ?? (external ? "end" : "start")

  const glyph = Icon ? (
    <Icon className="size-3.5 shrink-0 stroke-[1.5] transition-[stroke-width] duration-[80ms] group-hover/fluid-card-action:stroke-2 motion-reduce:transition-none" />
  ) : null

  const inner = (
    <>
      {position === "start" && glyph}
      <span className="[text-box:trim-both_cap_alphabetic]">{children}</span>
      {position === "end" && glyph}
      {external && (
        <IconArrowUpRight className="size-3.5 shrink-0 stroke-[1.5] transition-[stroke-width] duration-[80ms] group-hover/fluid-card-action:stroke-2 motion-reduce:transition-none" />
      )}
    </>
  )

  const classes = cn(
    "group/fluid-card-action relative z-30 inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium outline-none",
    "transition-colors duration-[80ms] motion-reduce:transition-none",
    "focus-visible:ring-2 focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:opacity-50",
    FLUID_CARD_BUTTON_VARIANTS[variant],
  )

  if (href) {
    return (
      <FluidCardLink href={href} external={external} onClick={onClick} className={classes}>
        {inner}
      </FluidCardLink>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      {inner}
    </button>
  )
}

export {
  FluidCard,
  FluidCardAction,
  FluidCardButton,
  FluidCardContent,
  FluidCardDescription,
  FluidCardEyebrow,
  FluidCardFeature,
  FluidCardFooter,
  FluidCardGroup,
  FluidCardHeader,
  FluidCardImage,
  FluidCardMedia,
  FluidCardTitle,
}
export type {
  FluidCardButtonProps,
  FluidCardButtonVariant,
  FluidCardGroupProps,
  FluidCardIcon,
  FluidCardLogo,
  FluidCardProps,
}
