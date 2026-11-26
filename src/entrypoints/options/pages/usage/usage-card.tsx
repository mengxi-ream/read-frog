import type { Icon as TablerIcon } from "@tabler/icons-react"
import type { ReactNode } from "react"
import { IconGift, IconSparkles } from "@tabler/icons-react"
import { PlanBadge } from "@/components/badges/plan-badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/base-ui/card"
import { Separator } from "@/components/ui/base-ui/separator"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import {
  ACCOUNT_STATE,
  AccountAvatar,
  useUserAccountMenu,
} from "@/components/user-account-menu/shared"
import { useFeatureOn } from "@/hooks/use-feature-on"
import { billingUrl, pricingUrl } from "@/utils/error-action"
import { i18n } from "@/utils/i18n"
import { AiSubtitlesUsage } from "./ai-subtitles-usage"
import { BuiltInAiUsage } from "./built-in-ai-usage"

type Account = ReturnType<typeof useUserAccountMenu>

function openInNewTab(url: string) {
  window.open(url, "_blank")
}

/**
 * The account, its plan, and every quota it draws on, in one card. Whatever
 * the reader can do next — log in, upgrade — sits in the footer, so the quota
 * groups only ever say a line about why a bar is missing.
 */
export function UsageCard() {
  const account = useUserAccountMenu()
  // Simple mode: with video subtitles off, its quota leaves along with its pages.
  const subtitlesOn = useFeatureOn("videoSubtitles")

  return (
    <Card>
      <AccountHeader account={account} />
      <CardContent className="flex flex-col gap-5">
        <BuiltInAiUsage />
        {subtitlesOn && (
          <>
            <Separator />
            <AiSubtitlesUsage />
          </>
        )}
      </CardContent>
      <UsageFooter
        state={account.state}
        plan={account.plan}
        logIn={account.logIn}
        logInAnchorRef={account.logInAnchorRef}
      />
    </Card>
  )
}

/**
 * Name, plan and email — deliberately no renewal date or billing interval.
 * A date on this page reads as a reminder to cancel; subscribers find it, and
 * everything else about billing, behind "Manage subscription".
 */
function AccountHeader({ account }: { account: Account }) {
  const isGuest = account.state === ACCOUNT_STATE.GUEST
  const isPaid = account.plan === "pro" || account.plan === "ultra"

  return (
    <CardHeader className="border-b">
      <div className="flex min-w-0 items-center gap-3">
        <AccountAvatar account={account} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          {account.state === ACCOUNT_STATE.LOADING ? (
            <>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-44" />
            </>
          ) : (
            <>
              <CardTitle className="flex min-w-0 items-center gap-2">
                <span className="truncate">
                  {isGuest ? i18n.t("options.usage.notSignedIn") : account.displayName}
                </span>
                {account.plan && (
                  <PlanBadge plan={account.plan} size="default" className="shrink-0" />
                )}
              </CardTitle>
              <CardDescription className="truncate text-[13px]">
                {isGuest ? i18n.t("options.usage.guest") : account.user?.email}
              </CardDescription>
            </>
          )}
        </div>
      </div>
      {isPaid && (
        <CardAction className="self-center">
          <Button variant="outline" size="sm" onClick={() => openInNewTab(billingUrl())}>
            {i18n.t("options.usage.manageSubscription")}
          </Button>
        </CardAction>
      )}
    </CardHeader>
  )
}

/**
 * One prompt for whoever can still get more: a guest logs in for the weekly
 * free quota, a free account upgrades. Paid plans, and an account whose plan
 * is still loading or failed to load, get no footer at all.
 */
function UsageFooter({
  state,
  plan,
  logIn,
  logInAnchorRef,
}: Pick<Account, "state" | "plan" | "logIn" | "logInAnchorRef">) {
  if (state === ACCOUNT_STATE.GUEST) {
    return (
      <FooterPrompt icon={IconGift} text={i18n.t("options.usage.footer.logIn")}>
        {/* The anchor for the grant-access toast `logIn` raises when the extension
            cannot see the website session. */}
        <Button ref={logInAnchorRef} variant="accent" size="sm" onClick={logIn}>
          {i18n.t("account.login")}
        </Button>
      </FooterPrompt>
    )
  }

  if (plan === "free") {
    return (
      <FooterPrompt icon={IconSparkles} text={i18n.t("options.usage.footer.upgrade")}>
        <Button
          variant="accent"
          size="sm"
          onClick={() => openInNewTab(pricingUrl("extension_upgrade"))}
        >
          {i18n.t("options.usage.footer.upgradeAction")}
        </Button>
      </FooterPrompt>
    )
  }

  return null
}

function FooterPrompt({
  icon: PromptIcon,
  text,
  children,
}: {
  icon: TablerIcon
  text: string
  children: ReactNode
}) {
  return (
    <CardFooter className="flex-wrap justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
        {/* Accent is tuned as a fill on the dark page and is too dim as a glyph
            colour there; the 300 step reads, as on the selection popover's
            review-due tab. */}
        <PromptIcon
          aria-hidden
          className="size-4 shrink-0 text-accent dark:text-[var(--rf-cornflower-300)]"
        />
        {text}
      </span>
      {children}
    </CardFooter>
  )
}
