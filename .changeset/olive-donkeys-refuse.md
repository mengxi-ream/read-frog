---
"@read-frog/extension": patch
---

fix(translate): stop long-page freezes and drain cancelled translation queues (#1881)

- Split giant observed paragraphs (e.g. a flat 185k-px article labeled as one paragraph) into their descendant paragraphs so viewport-lazy translation actually applies instead of enqueueing the whole page at once
- Cap concurrent spinner animations and cancel them via stored handles — thousands of live WAAPI animations were driving continuous full-page style recalcs
- Cancel a page-translation session's queued/in-flight background requests on toggle-off, tab close, or restart (scoped per tab + session, dedup-shared requests are refcounted)
- Time-slice the initial DOM labeling walk and pace subtree translation so the main thread stays responsive on huge pages
