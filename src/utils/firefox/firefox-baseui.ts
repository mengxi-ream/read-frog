/**
 * Firefox WebExtension compatibility helpers for Base UI components.
 *
 * Base UI components like Select, Menu, and Popover may close unexpectedly
 * in Firefox extensions due to spurious window-resize events. This utility
 * provides a simple fix using Base UI's cancel() mechanism.
 *
 * @see https://github.com/mui/base-ui/issues/3546
 */

import { getIsFirefoxExtensionEnv } from './firefox-compat'

interface BaseUIEventDetails {
  reason: string
  cancel: () => void
}

const isFirefox = getIsFirefoxExtensionEnv()

/**
 * Wraps an onOpenChange handler to cancel spurious window-resize close events
 * that occur in Firefox browser extensions.
 *
 * @example
 * <Select.Root onOpenChange={withFirefoxFix(setOpen)}>
 */
export function withFirefoxFix<D extends BaseUIEventDetails>(
  onOpenChange?: (open: boolean, details: D) => void,
): (open: boolean, details: D) => void {
  return (open: boolean, details: D) => {
    if (isFirefox && !open && details.reason === 'window-resize') {
      details.cancel()
      return
    }
    onOpenChange?.(open, details)
  }
}
