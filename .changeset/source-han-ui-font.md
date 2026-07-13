---
"@read-frog/extension": patch
---

feat(ui): add 思源黑体 (Source Han Sans / Noto Sans CJK) to the extension UI font fallback stack, after system-ui and before the generic sans-serif, so Chinese UI text resolves to it by name on platforms where it is the default (Android / ChromeOS / Linux) while macOS/Windows keep their lang-correct native PingFang / 微软雅黑
