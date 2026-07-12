---
"@read-frog/extension": patch
---

fix(translate): make Google/Microsoft requests text-format aware — escape plain text sent to Google translateHtml, decode its output exactly once, use Microsoft plain textType for plain text, and keep the html behavior for translationOnly page-mode markup
