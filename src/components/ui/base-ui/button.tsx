import type { VariantProps } from "class-variance-authority"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority"
import { cn } from "@/utils/styles/utils"

// Bevel mechanics shared by the solid variants, after openui.com's BevelButton (as in the design
// system): a flat fill, a translucent edge that tints it (hence bg-clip-border), inset highlight
// and shade, and a drop shadow. A flat fill transitions background-color directly, so hover needs
// no extra layer. The bevel rides on shadow-(...) so a focus ring still stacks on top of it. Each
// variant only maps its six theme tokens. The per-variant classes below are spelled out: Tailwind
// scans source text, so a class name built at runtime is never generated.
const solidBevel = [
  "border-(--btn-edge) bg-(--btn-fill) bg-clip-border shadow-(--btn-bevel) disabled:shadow-none",
  "hover:bg-(--btn-fill-hover) active:bg-(--btn-fill-active) active:shadow-(--btn-press)",
].join(" ")

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: `${solidBevel} text-primary-foreground [--btn-bevel:var(--rf-primary-bevel)] [--btn-edge:var(--rf-primary-edge)] [--btn-fill-active:var(--rf-primary-active)] [--btn-fill-hover:var(--rf-primary-hover)] [--btn-fill:var(--rf-primary)] [--btn-press:var(--rf-primary-press)]`,
        brand: `${solidBevel} text-brand-foreground [--btn-bevel:var(--rf-brand-bevel)] [--btn-edge:var(--rf-brand-edge)] [--btn-fill-active:var(--rf-brand-active)] [--btn-fill-hover:var(--rf-brand-hover)] [--btn-fill:var(--rf-brand)] [--btn-press:var(--rf-brand-press)]`,
        accent: `${solidBevel} text-accent-foreground [--btn-bevel:var(--rf-accent-bevel)] [--btn-edge:var(--rf-accent-edge)] [--btn-fill-active:var(--rf-accent-active)] [--btn-fill-hover:var(--rf-accent-hover)] [--btn-fill:var(--rf-accent)] [--btn-press:var(--rf-accent-press)]`,
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        // A small action we want noticed without a solid fill. Accent text reads on the light page
        // (APCA Lc 59) but not on the dark one, where the dark accent is tuned for white text on
        // a fill (Lc 31 as text); there the text turns white and the border and tint carry the
        // accent.
        "outline-accent":
          "border-accent/50 bg-background text-accent hover:border-accent hover:bg-accent/10 aria-expanded:border-accent aria-expanded:bg-accent/10 dark:border-accent/70 dark:bg-accent/10 dark:text-accent-foreground dark:hover:bg-accent/20 dark:aria-expanded:bg-accent/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // The quiet icon button of the popups and panels drawn over web pages: grey until hovered.
        "ghost-secondary":
          "text-muted-foreground hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground dark:hover:bg-secondary/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
