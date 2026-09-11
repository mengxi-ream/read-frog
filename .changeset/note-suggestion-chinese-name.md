---
"@read-frog/extension": patch
---

fix(i18n): give the note suggestion feature one Chinese name

In Chinese the feature was 猜你想存 on the card and in the Built-in AI lists, but
保存建议 (儲存建議 in zh-TW) in the settings toggle, the command palette, and the
card's own on/off switch — so searching the settings for the name you saw on the page
turned up nothing (#2176). All of them now read 猜你想存.
