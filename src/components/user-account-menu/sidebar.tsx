import { IconSelector } from "@tabler/icons-react"
import { match } from "ts-pattern"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"
import {
  ACCOUNT_STATE,
  AccountAvatar,
  LogoutMenuItem,
  WebAppMenuItem,
  openLogIn,
  useUserAccountMenu,
} from "./shared"

function SidebarAccountDropdownContent({
  account,
}: {
  account: ReturnType<typeof useUserAccountMenu>
}) {
  return (
    <DropdownMenuContent align="start" side="bottom" className="min-w-56">
      <WebAppMenuItem />
      <DropdownMenuSeparator />
      <LogoutMenuItem account={account} />
    </DropdownMenuContent>
  )
}

export function UserAccountMenuSidebar() {
  const account = useUserAccountMenu()
  const { displayName } = account

  const avatar = <AccountAvatar account={account} size="default" />

  return match(account.state)
    .with(ACCOUNT_STATE.LOADING, () => (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            {avatar}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    ))
    .with(ACCOUNT_STATE.GUEST, () => (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip={i18n.t("account.login")}
            onClick={openLogIn}
            className="cursor-pointer"
          >
            {avatar}
            <span className="truncate font-medium">{i18n.t("account.login")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    ))
    .with(ACCOUNT_STATE.AUTHED, () => (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  tooltip={displayName}
                  className="cursor-pointer data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
                />
              }
            >
              {avatar}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                {account.user?.email && (
                  <span className="truncate text-xs text-muted-foreground">
                    {account.user.email}
                  </span>
                )}
              </div>
              <IconSelector aria-hidden className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <SidebarAccountDropdownContent account={account} />
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    ))
    .exhaustive()
}
