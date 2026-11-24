import type { ReactNode } from "react"
import type { FeatureId } from "@/utils/features"
import { useFeatureOn } from "@/hooks/use-feature-on"
import { cn } from "@/utils/styles/utils"

/**
 * Rows that belong to the feature in the row above them, as simple mode's tree has them:
 * indented under it, and greyed out while it is off. They stay editable, and keep their values.
 */
export function NestedFeatureItems({
  feature,
  children,
}: {
  feature: FeatureId
  children: ReactNode
}) {
  const featureOn = useFeatureOn(feature)

  return (
    <div className={cn("ml-1 flex flex-col gap-6 border-l pl-5", !featureOn && "opacity-60")}>
      {children}
    </div>
  )
}
