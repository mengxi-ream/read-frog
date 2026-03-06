export const themeModes = ["system", "light", "dark"] as const
export type ThemeMode = (typeof themeModes)[number]
export type Theme = "light" | "dark"
export const DEFAULT_THEME_MODE: ThemeMode = "system"
