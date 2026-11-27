---
"@read-frog/extension": patch
---

perf(difficult-words): stop asking the server whether a signed-out reader can use difficult words

When the browser has no Read Frog session cookie, the extension now answers "signed out" without sending a request. Opening the popup also uses the saved answer instead of asking the server each time; signing in or out still clears the saved answer.
