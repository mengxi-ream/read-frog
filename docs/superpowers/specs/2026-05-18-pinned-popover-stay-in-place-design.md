# Pinned Popover: Stay in Place on Re-trigger

## Problem

When the selection translation popover is pinned, triggering a new selection translation causes the popover to move to the new mouse position and lose its pinned state. Users expect a pinned popover to stay in place and only update its translation content.

## Root Cause

Three places unconditionally reset pinned state or reposition:

1. `SelectionPopover.Trigger.handleClick` always calls `setPinned(false)` and `setAnchor(newPos)` before reopening
2. `SelectionPopoverRoot.setOpen(false)` always calls `setPinned(false)`, so the close-then-reopen cycle loses pinned
3. `SelectionTranslationProvider.handleOpenChange(true)` always sets the new anchor, and the layout hook repositions on anchor change

Additionally, the current `restartPopoverSession()` approach (close then reopen via `setOpen(false)` + `requestAnimationFrame(setOpen(true))`) combined with `key={popoverSessionKey}` on Content forces a full component remount. This destroys all layout state (position, preferred layout memory, resize observer) and snaps the popover back to the anchor origin — making "stay in place" impossible with the close/reopen cycle.

## Design

### Goal

When the popover is pinned and the user triggers a new selection translation:
- **Do not move** — skip anchor update, skip layout repositioning, skip close/reopen cycle
- **Do not unpin** — keep pinned state
- **Update content** — update active session directly to trigger new translation, without remounting Content

When the popover is closed and reopened:
- **Remember pinned** — persist pinned state to an atom, restore on next open

### Changes

#### 1. `selection-toolbar/atoms.ts` — New atom

Add `selectionPopoverPinnedAtom` to persist pinned state across popover lifecycle:

```ts
export const selectionPopoverPinnedAtom = atom(false)
```

Note: use `atom(false)` (not `atomWithDefault`) since no lazy initialization is needed.

#### 2. `selection-popover/index.tsx` — SelectionPopoverRoot

- Accept optional `pinnedAtom` prop (Jotai atom)
- Replace `useState(false)` for pinned with `useAtom` using the provided atom, or an internal memoized atom as fallback:

```tsx
const internalPinnedAtom = React.useMemo(() => atom(false), [])
const activePinnedAtom = pinnedAtomProp ?? internalPinnedAtom
const [pinned, setPinned] = useAtom(activePinnedAtom)
```

This avoids conditional hooks (cannot call `useAtom` conditionally).

- `setOpen(false)` no longer resets pinned — the atom preserves it. Remove the `setPinned(false)` call from the `setOpen` callback.

#### 3. `selection-popover/index.tsx` — SelectionPopoverTrigger.handleClick

When `pinned` is true and `open` is true:
- **Do not** call `setPinned(false)` or `setAnchor()`
- **Do not** call `restartPopoverSession()` (no close/reopen cycle)
- Instead, call a new callback `onReTrigger()` (passed as prop) that lets the provider update the session content without toggling visibility

When `pinned` is false:
- Current behavior unchanged (setAnchor, restartPopoverSession or setOpen(true))

#### 4. `selection-popover/index.tsx` — Peer popover mutual exclusion

When receiving `SELECTION_POPOVER_OPEN_EVENT` from a peer:
- If self is pinned, do not close — stay open with current content
- If self is not pinned, close as before

#### 5. `provider.tsx` — handleOpenChange and re-trigger

**New re-trigger path for pinned state:**

The provider reads `selectionPopoverPinnedAtom` via `useAtomValue` to check pinned state in `handleOpenChange`.

When a pinned popover is re-triggered (via `onReTrigger` callback from Trigger):
- Do not go through `handleOpenChange` at all
- Instead, directly update `activeSession` with the new selection session
- Increment `popoverSessionKey` only if NOT using it as a Content `key` — use a separate `translationNonce` state that the translation `useEffect` depends on

**Modified `handleOpenChange`:**

When `nextOpen === true` and pinned is true:
- Do not update anchor from pending request
- Still increment translation nonce to trigger new translation
- Still hide the toolbar

When `nextOpen === true` and pinned is false:
- Current behavior unchanged

When `nextOpen === false` and pinned is true:
- Do not clear anchor or reset popover session (the close is intentional, preserve position for potential reopen)
- Do reset `lastTranslationRunKeyRef` (translation state cleanup)

When `nextOpen === false` and pinned is false:
- Current behavior unchanged (full reset including clearAnchor)

**Stop using `popoverSessionKey` as Content `key`:**

The current `<SelectionPopover.Content key={popoverSessionKey}>` forces full remount. Replace this with a separate `translationNonce` that only drives the translation `useEffect`, not the Content key. The Content component stays mounted throughout, preserving all layout state.

#### 6. `use-selection-popover-layout.ts` — Anchor change guard

Add a `isPinned` option to `useSelectionPopoverLayout`. When `isPinned` is true:
- Skip the `useLayoutEffect` that repositions on anchor change (line 489-499)
- Skip the cleanup `useEffect` that resets layout state when `isVisible` becomes false (line 479-487) — but only if the visibility toggle is part of a pinned re-trigger. In practice, since the pinned re-trigger no longer goes through a close/reopen cycle, `isVisible` stays `true` and this effect never fires, so no guard is needed here.

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Pinned + re-trigger selection | Stay in place, translate new content (no close/reopen) |
| Pinned + close + reopen | Restore pinned state, position at new anchor |
| Pinned + click close button | Close, remember pinned=true |
| Pinned + peer popover opens | Stay open, do not close self |
| Not pinned + re-trigger | Move to new position (current behavior) |
| Pinned + drag to new position | Move to dragged position, stay pinned |

### Tests to Update

| Test File | Test Name | Change Needed |
|-----------|-----------|---------------|
| `selection-popover/__tests__/selection-popover.test.tsx` | "closes a pinned popover when another popover opens" | A pinned popover should now stay open when peer opens |
| `selection-popover/__tests__/selection-popover.test.tsx` | "resets the pinned state after closing and reopening" | Pinned state should persist via atom, not reset |
| `selection-popover/__tests__/selection-popover.test.tsx` | "restarts the same popover session when clicking the same trigger again" | Pinned state should persist, not reset to false |

### Out of Scope

- Changing pin button appearance or behavior
- Multi-popover support (two popovers simultaneously)
- Persisting pinned state across page navigations