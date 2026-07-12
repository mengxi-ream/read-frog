---
"@read-frog/extension": patch
---

fix(translate): store translationOnly original-content snapshots in a WeakMap so elements removed by the site (SPA re-renders, infinite scroll) no longer retain detached DOM nodes and their HTML strings for the page's lifetime
