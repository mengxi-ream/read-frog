export function isBotAuthor(user = null) {
  const login = typeof user?.login === "string" ? user.login.trim() : ""
  const type = typeof user?.type === "string" ? user.type : ""

  return type === "Bot" || login.toLowerCase().endsWith("[bot]")
}

export function getBotAuthorSkipReason(user = null) {
  if (!isBotAuthor(user))
    return null

  const login = typeof user?.login === "string" ? user.login.trim() : ""
  return login ? `bot-authored PR by @${login}` : "bot-authored PR"
}
