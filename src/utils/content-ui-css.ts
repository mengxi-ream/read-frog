import textSmallCSS from "@/assets/styles/text-small.css?inline"
import themeCSS from "@/assets/styles/theme.css?inline"
import { OVERLAY_SHADOW_ROOT_CSS } from "@/utils/shadow-root"

// The selection toolbar and the side UI used to be separate content scripts
// with `cssInjectionMode: "ui"`, which made WXT emit a 230 KB stylesheet per
// script and fetch it on mount. The shared content runtime bundles the theme
// once instead. Same order and `:root` → `:host` rewrite as WXT's loader.
function toShadowCss(css: string) {
  return css.replaceAll(":root", ":host")
}

export const SELECTION_UI_CSS = `${OVERLAY_SHADOW_ROOT_CSS}\n${toShadowCss(themeCSS)}`

export const SIDE_UI_CSS = `${OVERLAY_SHADOW_ROOT_CSS}\n${toShadowCss(`${themeCSS}\n${textSmallCSS}`)}`
