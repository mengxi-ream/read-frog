---
"@read-frog/extension": patch
---

fix(subtitles): make "Request AI subtitles" work on Firefox

Two Firefox-only issues in the extension's request path blocked AI subtitle
requests:

- `normalizeHeaders` spread `Headers.entries()`, whose iterator is not iterable
  across the Firefox extension realm ("headersInit.entries() is not iterable").
  Collect entries with `Headers.forEach` instead.
- The proxy-fetch dropped the POST body because `Request.body` is null for
  content-script requests on Firefox. Read the body with `request.text()`
  directly so the payload is forwarded (fixed the `create` 400 "expected object,
  received undefined").
