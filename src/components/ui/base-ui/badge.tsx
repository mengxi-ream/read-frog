import type { VariantProps } from "class-variance-authority"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority"

import { cn } from "@/utils/styles/utils"

const badgeVariants = cva(
  "gap-1 rounded-4xl border border-transparent font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive overflow-hidden group/badge",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive: "bg-destructive/10 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20",
        outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "bg-accent text-accent-foreground [a]:hover:bg-accent/80",
      },
      size: {
        default: "h-5 px-2 py-0.5 text-xs [&>svg]:size-3!",
        sm: "h-4 px-1.5 py-0 text-[10px] [&>svg]:size-2.5!",
        lg: "h-6 px-2.5 py-1 text-sm [&>svg]:size-3.5!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ className, variant, size })),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
