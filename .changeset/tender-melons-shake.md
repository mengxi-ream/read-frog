---
"@read-frog/extension": patch
---

fix(translate): stop the giant-paragraph split from stranding a container's own text

Tall containers are split into their descendant paragraphs so viewport-lazy translation still applies (#1881). That split silently drops any text the container holds directly, which is harmless on a nested `<article>` but catastrophic on `<br>`-delimited article bodies, where the bare text _is_ the article — a Blogger post kept 8% of its text and paulgraham.com/greatwork.html kept 1.1%, while the incidental inline `<i>` got its own translation inserted mid-sentence.

- Refuse the split when the container owns prose of its own and has a block-level child, so the translate path re-segments it into per-line runs instead
- Keep splitting when the container owns no prose (unchanged for docs.docker.com), when its own text carries no letters (separators, dates), when it has no block child to re-segment on, when it is `<body>`, or when the split already yields more units than the gating cap
- Apply the same guard on the translate side's giant fallback, so both paths make one decision
