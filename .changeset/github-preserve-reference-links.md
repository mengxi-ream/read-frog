---
"@read-frog/extension": patch
---

fix(site-rules): keep PR/discussion/commit reference links in GitHub markdown translations

Modern GitHub markup renders references like `#1837` as a bare `a[data-hovercard-type='pull_request']` with no `.issue-link` class, so the broad `a[data-hovercard-type]` exclude dropped them from the translation source (e.g. release notes lost every PR number). Preserve `pull_request`, `discussion`, and `commit` hovercard links inside `.markdown-body` as source text so they survive translation verbatim.
