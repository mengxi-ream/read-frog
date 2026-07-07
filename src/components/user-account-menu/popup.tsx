import { match } from "ts-pattern"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { i18n } from "@/utils/i18n"
import {
  ACCOUNT_STATE,
  AccountAvatar,
  AccountDropdownContent,
  openLogIn,
  useUserAccountMenu,
} from "./shared"

export function UserAccountMenuPopup() {
  const account = useUserAccountMenu()
  const { displayName } = account

  const avatar = <AccountAvatar account={account} />

  return match(account.state)
    .with(ACCOUNT_STATE.LOADING, () => (
      <div className="flex items-center gap-2">
        {avatar}
      </div>
    ))
    .with(ACCOUNT_STATE.GUEST, () => (
      <div className="flex items-center gap-2">
        {avatar}
        <span className="text-sm text-muted-foreground">{displayName}</span>
        <Button size="xs" variant="outline" onClick={openLogIn}>
          {i18n.t("account.login")}
        </Button>
      </div>
    ))
    .with(ACCOUNT_STATE.AUTHED, () => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(
            <button
              type="button"
              className="group/account flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent active:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-accent"
            />
          )}
        >
          {avatar}
          <span className="truncate text-sm font-medium">{displayName}</span>
        </DropdownMenuTrigger>
        <AccountDropdownContent account={account} align="end" side="bottom" />
      </DropdownMenu>
    ))
    .exhaustive()
}
