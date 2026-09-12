---
"@read-frog/extension": patch
---

fix(glossary): say that a website pattern can also end in a wildcard

A glossary's website list explained the leading `*` and nothing else, so the
trailing one was invisible: a pattern can carry a path, and that path can end in
`*`. That is the difference between scoping a glossary to a whole novel site and
scoping it to one book on it — `example.com/novel/12345/*` — and nobody could
find it from the screen.

The line now names all three forms in the space the previous two took:
`example.com` is that address alone, `*.example.com` adds subdomains, and
`example.com/docs/*` narrows to one part of a site.
