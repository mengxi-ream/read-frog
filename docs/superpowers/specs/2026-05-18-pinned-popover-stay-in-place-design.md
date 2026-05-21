# Pinned Popover: Stay in Place on Re-trigger

## Problem

When the selection translation popover is pinned, triggering a new selection translation causes the popover to move to the new mouse position and lose its pinned state. Users expect a pinned popover to stay in place and only update its translation content.

## Root Cause

Three places unconditionally reset pinned state or reposition:

1. `SelectionPopover.Trigger.handleClick` always calls `setPinned(false)` and `setAnchor(newPos)` before reopening
2. `SelectionPopoverRoot.setOpen(false)` always calls `setPinned(false)`, so the close-then-reopen cycle loses pinned
3. `SelectionTranslationProvider.handleOpenChange(true)` always sets the new anchor, and the layout hook repositions on anchor change

## Design

### Goal

When the popover is pinned and the user triggers a new selection translation:
- **Do not move** — skip anchor update, skip layout repositioning
- **Do not unpin** — keep pinned state
- **Update content** — increment session key to trigger new translation

When the popover is closed and reopened:
- **Remember pinned** — persist pinned state to an atom, restore on next open

### Changes

#### 1. `selection-toolbar/atoms.ts` — New atom

Add `selectionPopoverPinnedAtom` to persist pinned state across popover lifecycle:

```ts
export const selectionPopoverPinnedAtom = atomWithDefault(() => false)
```

#### 2. `selection-popover/index.tsx` — SelectionPopoverRoot

- Accept optional `pinnedAtom` prop (Jotai atom)
- Initialize `pinned` state from the atom value (or `false` if no atom)
- `setPinned` writes through to the atom
- `setOpen(false)` no longer resets pinned — the atom preserves it

#### 3. `selection-popover/index.tsx` — SelectionPopoverTrigger.handleClick

When `pinned` is true:
- Skip `setPinned(false)` and `setAnchor()`
- Only call `restartPopoverSession()` to trigger content refresh

When `pinned` is false:
- Current behavior unchanged

#### 4. `selection-popover/index.tsx` — Peer popover mutual exclusion

When receiving `SELECTION_POPOVER_OPEN_EVENT` from a peer:
- If self is pinned, do not close — stay open with current content
- If self is not pinned, close as before

#### 5. `provider.tsx` — handleOpenChange

When `nextOpen === true` and pinned is true:
- Do not update anchor from pending request
- Still increment `popoverSessionKey` and update `activeSession` to trigger new translation
- Still hide the toolbar

When `nextOpen === true` and pinned is false:
- Current behavior unchanged

Pass `selectionPopoverPinnedAtom` to `SelectionPopover.Root` as the `pinnedAtom` prop.

#### 6. `use-selection-popover-layout.ts` — Anchor change guard

Add a `isPinned` option to `useSelectionPopoverLayout`. When `isPinned` is true, skip the `useLayoutEffect` that repositions on anchor change.

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Pinned + re-trigger selection | Stay in place, translate new content |
| Pinned + close + reopen | Restore pinned state, position at new anchor |
| Pinned + click close button | Close, remember pinned=true |
| Pinned + peer popover opens | Stay open, do not close self |
| Not pinned + re-trigger | Move to new position (current behavior) |
| Pinned + drag to new position | Move to dragged position, stay pinned |

### Out of Scope

- Changing pin button appearance or behavior
- Multi-popover support (two popovers simultaneously)
- Persisting pinned state across page navigations
