import type { VariantProps } from "class-variance-authority"
import type { badgeVariants } from "@/components/ui/base-ui/badge"
import { Icon } from "@iconify/react"
import { i18n } from "#imports"
import { Badge } from "@/components/ui/base-ui/badge"
import { cn } from "@/utils/styles/utils"

type SponsorBadgeProps = Pick<VariantProps<typeof badgeVariants>, "size"> & { className?: string }

export function SponsorBadge({ size = "sm", className }: SponsorBadgeProps) {
  return (
    <Badge
      variant="secondary"
      size={size}
      className={cn(
        "h-4 gap-0.5 border-amber-200 bg-amber-100 px-1.5 text-[9px] font-semibold text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        className,
      )}
    >
      <Icon icon="tabler:star" className="size-2.5 text-current" />
      {i18n.t("options.apiProviders.badges.sponsor")}
    </Badge>
  )
}
