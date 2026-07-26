---
"@read-frog/extension": patch
---

fix(network): preserve proxied request headers and bodies on Firefox

Two Firefox-only issues in the extension's shared request path blocked AI
subtitle requests and Notebase loading:

- `normalizeHeaders` spread `Headers.entries()`, whose iterator is not iterable
  across the Firefox extension realm ("headersInit.entries() is not iterable").
  Collect entries with `Headers.forEach` instead.
- The proxy-fetch dropped the POST body because `Request.body` is null for
  some extension requests on Firefox. Read the body with `request.text()`
  directly so the payload is forwarded instead of producing 400 "expected
  object, received undefined" responses.
