import { IconLogout } from "@tabler/icons-react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { i18n } from "#imports"
import guest from "@/assets/icons/avatars/guest.svg"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/base-ui/avatar"
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/base-ui/dropdown-menu"
import { env } from "@/env"
import { authClient } from "@/utils/auth/auth-client"
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
  if (!normalizedName)
    return "U"

  const parts = normalizedName.split(/\s+/)
  const initials = parts.length > 1
    ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`
    : Array.from(normalizedName).slice(0, 2).join("")

  return initials.toUpperCase()
}

export function openLogIn() {
  window.open(`${env.WXT_WEBSITE_URL}/log-in`, "_blank")
}

export function useUserAccountMenu() {
  const { data, isPending } = authClient.useSession()
  const user = data?.user
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error)
        throw error
    },
    onError: () => {
      toast.error(i18n.t("account.logoutError"))
    },
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

export function AccountAvatar({ account }: { account: AccountMenu }) {
  return (
    <Avatar size="sm" className={cn(account.isPending && "animate-pulse")}>
      <AvatarImage src={account.avatarSrc || ""} alt={account.displayName} />
      <AvatarFallback>{account.fallbackText}</AvatarFallback>
    </Avatar>
  )
}

export function AccountDropdownContent({
  account,
  align,
  side,
}: {
  account: AccountMenu
  align: "start" | "end"
  side: "top" | "bottom"
}) {
  const { logout } = account
  return (
    <DropdownMenuContent align={align} side={side} className="min-w-56">
      <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
        <span className="truncate text-sm font-medium text-foreground">{account.displayName}</span>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
        className="cursor-pointer transition-colors"
      >
        <IconLogout aria-hidden className={cn(logout.isPending && "animate-pulse")} />
        {i18n.t("account.logout")}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
