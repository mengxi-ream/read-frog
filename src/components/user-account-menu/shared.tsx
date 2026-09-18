import { IconLogout, IconWorld } from "@tabler/icons-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import guest from "@/assets/icons/avatars/guest.svg"
import { PlanBadge } from "@/components/badges/plan-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/base-ui/avatar"
import { DropdownMenuItem } from "@/components/ui/base-ui/dropdown-menu"
import { env } from "@/env"
import { authClient } from "@/utils/auth/auth-client"
import {
  hasAccountHostPermission,
  requestAccountHostPermission,
} from "@/utils/auth/host-permission"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { orpc } from "@/utils/orpc/client"
import { cn } from "@/utils/styles/utils"

const HOST_PERMISSION_QUERY_KEY = ["account", "hostPermission"] as const

export const ACCOUNT_STATE = {
  LOADING: "loading",
  GUEST: "guest",
  AUTHED: "authed",
} as const

type AccountState = (typeof ACCOUNT_STATE)[keyof typeof ACCOUNT_STATE]
type AccountMenu = ReturnType<typeof useUserAccountMenu>

function getUserInitials(name: string | null | undefined) {
  const normalizedName = name?.trim()
  if (!normalizedName) return "U"

  const parts = normalizedName.split(/\s+/)
  const initials =
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`
      : Array.from(normalizedName).slice(0, 2).join("")

  return initials.toUpperCase()
}

export function openLogIn() {
  window.open(`${env.WXT_WEBSITE_URL}/log-in`, "_blank")
}

export function openWebApp() {
  window.open(`${env.WXT_WEBSITE_URL}/home`, "_blank")
}

export function useUserAccountMenu() {
  const session = authClient.useSession()
  const { data, isPending } = session
  const user = data?.user
  const plan = useAccountPlan(user?.id)
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw error
    },
    meta: { errorDescription: i18n.t("account.logoutError") },
  })

  const hostPermission = useQuery({
    queryKey: HOST_PERMISSION_QUERY_KEY,
    queryFn: hasAccountHostPermission,
    staleTime: 30_000,
    meta: { suppressToast: true },
  })

  const grantAccess = useMutation({
    mutationFn: async () => {
      const granted = await requestAccountHostPermission()
      if (!granted) return

      // Ordered on purpose. The background caches the session verdict for 24h
      // and only evicts it on a cookie change, which granting a permission is
      // not — refetching first would just re-serve the stale "signed out".
      await sendMessage("invalidateAuthCache")
      await Promise.all([hostPermission.refetch(), session.refetch()])
    },
    meta: { errorDescription: i18n.t("account.grantAccessError") },
  })

  const state: AccountState = isPending
    ? ACCOUNT_STATE.LOADING
    : !user
      ? ACCOUNT_STATE.GUEST
      : ACCOUNT_STATE.AUTHED

  return {
    state,
    user,
    plan,
    isPending,
    logout,
    grantAccess,
    // Only meaningful while signed out. Without the host permission the session
    // read can never carry the cookie, so "Guest" here is a withheld permission
    // wearing a signed-out costume — and sending the user to the login page
    // just loops them back to this same state.
    needsHostPermission: state === ACCOUNT_STATE.GUEST && hostPermission.data === false,
    displayName: user?.name?.trim() || "Guest",
    avatarSrc: user ? user.image : guest,
    fallbackText: user ? getUserInitials(user.name) : "G",
  }
}

/**
 * The plan this account is on, or `undefined` while it is unknown — signed out,
 * still loading, or the lookup failed. Every caller renders nothing in that
 * case, so a billing outage costs a badge, never a broken account menu.
 *
 * Scoped by user id for the same reason `useHostedAiStatus` is: oRPC's
 * generated key ignores identity, so without the suffix a sign-out followed by
 * a different sign-in would keep showing the previous account's plan until the
 * entry went stale. Suffixing leaves `orpc.billing.key()` invalidation
 * prefix-matching intact.
 */
function useAccountPlan(userId: string | undefined) {
  const query = useQuery(
    orpc.billing.status.queryOptions({
      queryKey: [...orpc.billing.status.queryKey(), userId ?? "guest"],
      enabled: userId !== undefined,
      retry: false,
      staleTime: 5 * 60_000,
      meta: { suppressToast: true },
    }),
  )
  return query.data?.plan
}

/**
 * The account's name with its plan beside it. `min-w-0` is what makes the
 * truncation actually happen: a flex item defaults to `min-width: auto`, which
 * refuses to shrink below its content, so without it a long name pushes the
 * badge (and in the popup, the icon row) out of the container instead of
 * ellipsing. The badge itself never shrinks — a squashed "Ultra" is worse than
 * a shorter name.
 */
export function AccountNameWithPlan({
  account,
  className,
}: {
  account: AccountMenu
  className?: string
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate font-medium">{account.displayName}</span>
      {account.plan && <PlanBadge plan={account.plan} className="shrink-0" />}
    </span>
  )
}

export function AccountAvatar({
  account,
  size = "sm",
}: {
  account: AccountMenu
  size?: "default" | "sm" | "lg"
}) {
  return (
    <Avatar size={size} className={cn(account.isPending && "animate-pulse")}>
      <AvatarImage src={account.avatarSrc || ""} alt={account.displayName} />
      <AvatarFallback>{account.fallbackText}</AvatarFallback>
    </Avatar>
  )
}

export function AccountDetails({ account }: { account: AccountMenu }) {
  return (
    <div className="flex items-center gap-2 px-1.5 py-1.5">
      <AccountAvatar account={account} />
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <AccountNameWithPlan account={account} className="text-foreground" />
        {account.user?.email && (
          <span className="truncate text-xs font-normal text-muted-foreground">
            {account.user.email}
          </span>
        )}
      </div>
    </div>
  )
}

export function WebAppMenuItem() {
  return (
    <DropdownMenuItem onClick={openWebApp} className="cursor-pointer transition-colors">
      <IconWorld aria-hidden />
      {i18n.t("account.webApp")}
    </DropdownMenuItem>
  )
}

export function LogoutMenuItem({ account }: { account: AccountMenu }) {
  const { logout } = account
  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={logout.isPending}
      onClick={() => logout.mutate()}
      className="cursor-pointer transition-colors"
    >
      <IconLogout aria-hidden className={cn(logout.isPending && "animate-pulse")} />
      {i18n.t("account.logout")}
    </DropdownMenuItem>
  )
}
