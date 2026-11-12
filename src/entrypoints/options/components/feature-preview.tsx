import type { ComponentProps, CSSProperties, ReactNode } from "react"
import watercolorDark from "@/assets/preview/watercolor-dark.webp"
import watercolorLight from "@/assets/preview/watercolor-light.webp"
import { cn } from "@/utils/styles/utils"

/**
 * The settings page's previews are drawn at one design size and shrink in steps on narrow pages,
 * against the width of the page's content column (`PageLayout` makes it the container). `zoom`
 * rather than `scale` so the box they take up in the page shrinks with them.
 */
export const PREVIEW_ZOOM_STEPS =
  "@max-3xl:[zoom:0.85] @max-2xl:[zoom:0.75] @max-xl:[zoom:0.62] @max-md:[zoom:0.5] @max-sm:[zoom:0.44]"

/** A sheet of watercolor paper, light or dark with the theme, that a preview sits on. */
export function PreviewBackdrop({ className, style, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex w-full justify-center overflow-hidden rounded-xl bg-cover bg-center",
        "bg-(image:--preview-backdrop-light) dark:bg-(image:--preview-backdrop-dark)",
        className,
      )}
      style={
        {
          "--preview-backdrop-light": `url("${watercolorLight}")`,
          "--preview-backdrop-dark": `url("${watercolorDark}")`,
          ...style,
        } as CSSProperties
      }
      {...props}
    />
  )
}

/**
 * A fixed-size scene on the backdrop, for previews drawn as a browser window with the feature in it.
 * Nothing in it is a real control, so it takes no pointer events and its text can't be selected.
 */
export function PreviewStage({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "pointer-events-none relative h-[330px] w-[720px] shrink-0 select-none",
        PREVIEW_ZOOM_STEPS,
        className,
      )}
      {...props}
    />
  )
}

/**
 * A browser window standing on the bottom edge of the stage, showing a web page. The page follows
 * the settings page's theme: a large white page on a dark settings page reads as a hole.
 * Place it with `className`; `children` are positioned against the page below the toolbar.
 */
export function PreviewBrowserWindow({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "absolute bottom-0 overflow-hidden rounded-t-xl bg-white text-neutral-800",
        "shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.05),0_18px_44px_-14px_rgb(28_36_18/0.28)]",
        "dark:bg-[#1f1f1f] dark:text-neutral-300",
        "dark:shadow-[0_0_0_1px_rgb(255_255_255/0.07),0_18px_44px_-14px_rgb(0_0_0/0.6)]",
        className,
      )}
    >
      <div className="flex h-10 items-center gap-[7px] border-b border-[#f0f0f0] px-3.5 dark:border-neutral-800">
        <span className="size-2.5 rounded-full bg-[#dedede] dark:bg-[#3a3a3a]" />
        <span className="size-2.5 rounded-full bg-[#dedede] dark:bg-[#3a3a3a]" />
        <span className="size-2.5 rounded-full bg-[#dedede] dark:bg-[#3a3a3a]" />
        <span className="ml-[18px] h-[22px] flex-[0_1_62%] rounded-full bg-[#f2f2f2] dark:bg-neutral-800" />
      </div>
      <div className="absolute inset-x-0 top-10 bottom-0">{children}</div>
    </div>
  )
}

/** Grey bars standing in for a page's text, one per width (a percentage of the line). */
export function PreviewTextLines({ widths, className }: { widths: number[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-[11px]", className)}>
      {widths.map((width, index) => (
        <span
          // oxlint-disable-next-line react/no-array-index-key -- the bars never reorder, and two can share a width
          key={index}
          className="h-2 rounded-full bg-[#f1f1f1] dark:bg-[#2b2b2b]"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  )
}

/** Text the visitor has selected on the previewed page. */
export const PREVIEW_SELECTION_CLASS_NAME = "relative bg-[#b3d7ff] dark:bg-[#2f5e94]"

/** The mouse pointer, resting on whatever the preview shows being used. */
export function PreviewPointer({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("absolute size-[18px] drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]", className)}
    >
      <path
        d="M5.5 3.2l13.2 9.1-6.1.9-3.3 5.6z"
        fill="#111"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}
