# Workflow

## Real-Browser Repro Checklist

1. Build the browser-specific artifact.
2. Verify the manifest in the expected output directory.
3. Launch a fresh browser instance with the unpacked extension.
4. Confirm DevTools targets before continuing.
5. Reproduce the issue.
6. Read live DOM state after the repro, not just screenshots.
7. If needed, add temporary instrumentation to the extension-local layer and rebuild.

## DevTools Automation Pattern

For Chromium-family browsers, a minimal Node script using:
- `fetch` to read `/json/list`
- `WebSocket` to connect to `webSocketDebuggerUrl`
- `Runtime.evaluate`
- `Input.dispatchMouseEvent`

is usually enough.

Use it for:
- selecting text
- clicking toolbar buttons
- hovering triggers
- checking popup and tooltip state

## How to Reason About UI Bugs

### Tooltip / Popover Bugs

Do not stop at "the node still exists."

Inspect:
- `data-open`
- `data-closed`
- `data-starting-style`
- `data-ending-style`
- computed `opacity`
- computed `visibility`
- computed `pointer-events`
- whether the close event actually fired

Important distinction:
- If `onOpenChange(false)` never fires, the event chain is wrong.
- If `onOpenChange(false)` fires but the element remains visible, the closed-state styling or unmount flow is wrong.

### Hover Bugs

Inspect `relatedTarget` on leave events.

If the pointer leaves the trigger and lands on the tooltip's own overlay or positioner, the hover chain is contaminated. In those cases:
- the tooltip overlay may need `pointer-events-none`
- the extension-local tooltip wrapper may need a stronger closed-state style

### Build-Only Bugs

When a bug appears only after `build`:
- reproduce against the built artifact first
- do not assume the dev server path is relevant
- compare dev/build only after you have real evidence from the built version

## Fix Scope Guidance

Prefer the narrowest layer that actually owns the problem:

- Shared primitive only if the same bug exists across unrelated surfaces
- Extension-local wrapper if the bug is specific to content-script overlays or injected UI
- Feature-local component if only one trigger path is affected

When a shared primitive is used by safe surfaces like options or popup pages, be careful not to push a content-script-specific workaround into that shared layer unless you have evidence that every surface needs it.
