import { Icon } from "@iconify/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/base-ui/button"
import { getFeatureActiveDays } from "@/utils/feature-active-days"
import { i18n } from "@/utils/i18n"
import {
  dismissStoreReviewPrompt,
  isStoreReviewPromptDismissed,
  shouldShowStoreReviewPrompt,
} from "@/utils/store-review"
import { getReviewUrl } from "@/utils/utils"

const STORE_REVIEW_PROMPT_QUERY_KEY = ["store-review-prompt"]

/**
 * Asks for a store review once the user has actually used the extension on enough
 * separate days to have an opinion. Both buttons are terminal — there is no second ask —
 * so the cost of a miss is one card the user closes, not a recurring nag.
 *
 * Absolutely positioned against the popup body: it overlays the bottom of the controls
 * rather than joining the flow, so the popup keeps its height and nothing the user was
 * reaching for moves. That makes the background opaque a requirement, not a style choice.
 */
export function StoreReviewPrompt() {
  const queryClient = useQueryClient()

  const { data: shouldShow } = useQuery({
    queryKey: STORE_REVIEW_PROMPT_QUERY_KEY,
    queryFn: async () => {
      const [activeDays, dismissed] = await Promise.all([
        getFeatureActiveDays(),
        isStoreReviewPromptDismissed(),
      ])
      return shouldShowStoreReviewPrompt(activeDays.count, dismissed)
    },
  })

  const dismiss = async () => {
    await dismissStoreReviewPrompt()
    await queryClient.invalidateQueries({ queryKey: STORE_REVIEW_PROMPT_QUERY_KEY })
  }

  const handleRate = async () => {
    window.open(getReviewUrl("popup-prompt"), "_blank", "noopener,noreferrer")
    await dismiss()
  }

  if (!shouldShow) return null

  return (
    <div className="absolute inset-x-4 bottom-3 z-10 flex flex-col gap-2 rounded-lg border border-brand/40 bg-background px-3 py-2.5 shadow-lg">
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute top-1.5 right-1.5 text-muted-foreground"
        aria-label={i18n.t("popup.storeReview.dismiss")}
        onClick={() => void dismiss()}
      >
        <Icon icon="tabler:x" />
      </Button>
      <div className="flex flex-col gap-0.5 pr-6">
        <span className="text-[13px] font-medium">{i18n.t("popup.storeReview.title")}</span>
        <span className="text-xs text-muted-foreground">
          {i18n.t("popup.storeReview.description")}
        </span>
      </div>
      <Button variant="brand" size="sm" className="self-start" onClick={() => void handleRate()}>
        <Icon icon="tabler:star-filled" />
        {i18n.t("popup.storeReview.action")}
      </Button>
    </div>
  )
}
