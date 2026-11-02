import { addIcon } from "@iconify/react"

/**
 * Icons the extension's own controls use, shipped with it: an `<Icon>`
 * otherwise fetches its data through the background at first render, which
 * is fine for an action's icon but not for a button that is always there.
 *
 * `pen-tool-flat` is from Streamline Color, by Streamline
 * (https://github.com/webalys-hq/streamline-vectors), CC BY 4.0, as
 * distributed by Iconify.
 */
export const ANNOTATION_ICON = "streamline-color:pen-tool-flat"

const PEN_TOOL_FLAT_BODY =
  '<g fill="none"><path fill="#8fbffa" d="M1.381 5.254L.107 13.32a.5.5 0 0 0 .572.572l8.067-1.274a1 1 0 0 0 .838-.877L10 8L6 4l-3.742.416a1 1 0 0 0-.877.838"/><path fill="#2859c5" fill-rule="evenodd" d="M1.05 13.834L4 10.884l.308.308a.625.625 0 1 0 .884-.884l-1.5-1.5a.625.625 0 1 0-.884.884l.308.308l-2.95 2.95l-.059.37a.5.5 0 0 0 .572.573z" clip-rule="evenodd"/><path fill="#2859c5" d="M8.308.922L6 4l4 4l3.078-2.308a1 1 0 0 0 .107-1.507L9.815.815a1 1 0 0 0-1.507.107"/></g>'

let registered = false

export function registerBundledIcons() {
  if (registered) return
  registered = true
  addIcon(ANNOTATION_ICON, { body: PEN_TOOL_FLAT_BODY, width: 14, height: 14 })
}
