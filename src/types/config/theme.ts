import z from "zod"

export const themeModes = ["system", "light", "dark"] as const
export type ThemeMode = (typeof themeModes)[number]
export const themeModeSchema = z.enum(themeModes)
export type Theme = "light" | "dark"
export const DEFAULT_THEME_MODE: ThemeMode = "system"
