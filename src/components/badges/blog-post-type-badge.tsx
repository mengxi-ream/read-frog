import type { BlogPostType } from "@read-frog/definitions"
import type { VariantProps } from "class-variance-authority"
import type { badgeVariants } from "@/components/ui/base-ui/badge"
import { Badge } from "@/components/ui/base-ui/badge"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

/** A pale tint with deep text of the same hue, so the tag reads without outshouting the title. */
const BLOG_POST_TYPE_TINT: Record<BlogPostType, string> = {
  promotion: "bg-pink-100 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
}

type BlogPostTypeBadgeProps = Pick<VariantProps<typeof badgeVariants>, "size"> & {
  type: BlogPostType
  className?: string
}

export function BlogPostTypeBadge({ type, size = "sm", className }: BlogPostTypeBadgeProps) {
  return (
    <Badge
      variant="secondary"
      size={size}
      // A tag rather than a pill: the tighter corner sits better in a line of text.
      className={cn("rounded-[4px] font-semibold", BLOG_POST_TYPE_TINT[type], className)}
    >
      {i18n.t(`options.whatsNew.postType.${type}`)}
    </Badge>
  )
}
