---
"@read-frog/extension": patch
---

fix(translate): stop page-translation flicker on same-origin navigation

Fixes two independent bugs that each caused translations to disappear and
reappear around SPA route changes:

1. The same-origin URL-change handler tore down every translation wrapper and
   rebuilt the session. Both Navigation API events fire synchronously inside
   `pushState` — before the router swaps the DOM — so the teardown always hit
   the still-visible previous page. The handler now keeps the session and
   wrappers mounted (the live MutationObserver walks the new route's DOM) and
   only swaps path-scoped site CSS, in place.

2. URL-change detection listened to the Navigation API `navigate` event, which
   also fires for cross-document navigations and pre-commit (cancellable)
   ones — running a full translation restart on pages about to unload and
   desyncing the tracked URL on cancelled navigations. Detection now uses
   `currententrychange`, which only fires for committed same-document changes.
