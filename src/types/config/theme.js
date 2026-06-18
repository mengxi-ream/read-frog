import z from "zod";
export const themeModes = ["system", "light", "dark"];
export const themeModeSchema = z.enum(themeModes);
export const DEFAULT_THEME_MODE = "system";
