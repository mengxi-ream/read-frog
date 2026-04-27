import guest from "@/assets/icons/avatars/guest.svg"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/base-ui/avatar"
import { Button } from "@/components/ui/base-ui/button"
import { env } from "@/env"
import { authClient } from "@/utils/auth/auth-client"
import { cn } from "@/utils/styles/utils"

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

export function UserAccount() {
  const { data, isPending } = authClient.useSession()
  const user = data?.user
  const displayName = user?.name?.trim() || "Guest"
  const avatarSrc = user ? user.image : guest
  const fallbackText = user ? getUserInitials(user.name) : "G"

  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm" className={cn(isPending && "animate-pulse")}>
        <AvatarImage src={avatarSrc || ""} alt={displayName} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      {isPending ? "Loading..." : displayName}
      {!isPending && !user && (
        <Button
          size="xs"
          variant="outline"
          onClick={() =>
            window.open(`${env.WXT_WEBSITE_URL}/log-in`, "_blank")}
        >
          Log in
        </Button>
      )}
    </div>
  )
}
