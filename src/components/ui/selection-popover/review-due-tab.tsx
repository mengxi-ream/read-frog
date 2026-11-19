import type { ReviewEntrySource } from "@read-frog/definitions"
import { useQuery } from "@tanstack/react-query"
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react"
import { ArrowUpRightIcon } from "@/components/icons/arrow-up-right-icon"
import { env } from "@/env"
import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { orpc } from "@/utils/orpc/client"

// Stands in for the count in the localized text, which sets it in its own style.
const COUNT_MARK = "\uE000"

/**
 * "N cards to review", tucked into the popover's bottom-right corner above the
 * footer: today's cards across the user's awake notebases, the number the
 * website's Start review shows, opening that combined review. Like the
 * website, it adds up `srs.scheduleStatusStats` over the notebases
 * `notebase.list` gives a null `srsSleepingAt`, so sleeping notebases are left
 * out of both. Like the queue, it counts one card per note at a time.
 * Renders nothing for guests, on errors, or when nothing is due.
 */
export function ReviewDueTab({ source }: { source: ReviewEntrySource }) {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const userId = session?.user?.id
  const prefersReducedMotion = useReducedMotion() ?? false
  // Both queries are per user, so a sign-in or account switch never shows
  // another account's count (suffixing keeps `.key()` invalidation
  // prefix-matching).
  const userKey = userId ?? "guest"
  const queryRules = {
    enabled: !isSessionPending && userId !== undefined,
    retry: false,
    staleTime: 60_000,
    meta: { suppressToast: true },
  }
  const listInput = {}
  const { data: notebases } = useQuery(
    orpc.notebase.list.queryOptions({
      input: listInput,
      queryKey: [...orpc.notebase.list.queryKey({ input: listInput }), userKey],
      ...queryRules,
    }),
  )
  const statsInput = { timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone }
  const { data: statsByNotebaseId } = useQuery(
    orpc.srs.scheduleStatusStats.queryOptions({
      input: statsInput,
      queryKey: [...orpc.srs.scheduleStatusStats.queryKey({ input: statsInput }), userKey],
      ...queryRules,
    }),
  )

  let count = 0
  for (const notebase of notebases ?? []) {
    const stats = notebase.srsSleepingAt === null ? statsByNotebaseId?.[notebase.id] : undefined
    if (stats) {
      count += stats.new + stats.learning + stats.review
    }
  }
  if (count === 0) {
    return null
  }

  const [before, after] = i18n
    .t(count === 1 ? "action.reviewDueOne" : "action.reviewDueOther", [COUNT_MARK])
    .split(COUNT_MARK)
  const reviewUrl = new URL("/review", env.WXT_WEBSITE_URL)
  reviewUrl.searchParams.set("source", source)

  return (
    <LazyMotion features={domAnimation}>
      <m.button
        type="button"
        initial="normal"
        whileHover={prefersReducedMotion ? undefined : "animate"}
        className="flex shrink-0 cursor-pointer items-center gap-1 self-end rounded-tl-lg border-t border-l bg-popover py-1 pr-3 pl-2.5 text-xs text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-muted/40"
        onClick={() => {
          void sendMessage("openPage", { url: reviewUrl.toString(), active: true })
        }}
      >
        <span>
          {before}
          {/* The dark accent is a fill (Lc 30 as text on the popover); its 300 step clears Lc 60. */}
          <span className="font-semibold text-accent dark:text-[var(--rf-cornflower-300)]">
            {count}
          </span>
          {after}
        </span>
        <ArrowUpRightIcon className="size-3.5" />
      </m.button>
    </LazyMotion>
  )
}
