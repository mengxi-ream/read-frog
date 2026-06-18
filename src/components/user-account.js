import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import guest from "@/assets/icons/avatars/guest.svg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/base-ui/avatar";
import { Button } from "@/components/ui/base-ui/button";
import { env } from "@/env";
import { authClient } from "@/utils/auth/auth-client";
import { cn } from "@/utils/styles/utils";
function getUserInitials(name) {
    const normalizedName = name?.trim();
    if (!normalizedName)
        return "U";
    const parts = normalizedName.split(/\s+/);
    const initials = parts.length > 1
        ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`
        : Array.from(normalizedName).slice(0, 2).join("");
    return initials.toUpperCase();
}
export function UserAccount() {
    const { data, isPending } = authClient.useSession();
    const user = data?.user;
    const displayName = user?.name?.trim() || "Guest";
    const avatarSrc = user ? user.image : guest;
    const fallbackText = user ? getUserInitials(user.name) : "G";
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Avatar, { size: "sm", className: cn(isPending && "animate-pulse"), children: [_jsx(AvatarImage, { src: avatarSrc || "", alt: displayName }), _jsx(AvatarFallback, { children: fallbackText })] }), isPending ? "Loading..." : displayName, !isPending && !user && (_jsx(Button, { size: "xs", variant: "outline", onClick: () => window.open(`${env.WXT_WEBSITE_URL}/log-in`, "_blank"), children: "Log in" }))] }));
}
