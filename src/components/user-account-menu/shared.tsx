import { IconLogout, IconWorld } from "@tabler/icons-react"
import { useMutation } from "@tanstack/react-query"
import guest from "@/assets/icons/avatars/guest.svg"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/base-ui/avatar"
import { DropdownMenuItem } from "@/components/ui/base-ui/dropdown-menu"
import { env } from "@/env"
import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

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
  const { data, isPending } = authClient.useSession()
  const user = data?.user
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw error
    },
    meta: { errorDescription: i18n.t("account.logoutError") },
  })

  const state: AccountState = isPending
    ? ACCOUNT_STATE.LOADING
    : !user
      ? ACCOUNT_STATE.GUEST
      : ACCOUNT_STATE.AUTHED

  return {
    state,
    user,
    isPending,
    logout,
    displayName: user?.name?.trim() || "Guest",
    avatarSrc: user ? user.image : guest,
    fallbackText: user ? getUserInitials(user.name) : "G",
  }
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
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium text-foreground">{account.displayName}</span>
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
