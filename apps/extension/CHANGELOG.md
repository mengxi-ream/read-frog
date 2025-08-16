# @read-frog/extension

## 1.4.1

### Patch Changes

- [`35c6d73`](https://github.com/mengxi-ream/read-frog/commit/35c6d73688d484b6bdcd9daeb12fcaad72dcf271) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - perf: redirect auth endpoint to /api/identity

## 1.4.0

### Minor Changes

- [#346](https://github.com/mengxi-ream/read-frog/pull/346) [`1fe2780`](https://github.com/mengxi-ream/read-frog/commit/1fe2780b559f3392bec7f0be7755f8b4e34dc5fe) Thanks [@sedationh](https://github.com/sedationh)! - fix: when drag float button, should keep hover state

### Patch Changes

- [#349](https://github.com/mengxi-ream/read-frog/pull/349) [`7c0ce5d`](https://github.com/mengxi-ream/read-frog/commit/7c0ce5dc71b62f5429a2b54554aabd6f81c99e5d) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: host content style missing

- [#335](https://github.com/mengxi-ream/read-frog/pull/335) [`e044745`](https://github.com/mengxi-ream/read-frog/commit/e044745ca4395cc553829f657f846c9171796f0b) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: try catch readability

## 1.3.0

### Minor Changes

- [#315](https://github.com/mengxi-ream/read-frog/pull/315) [`9d378a9`](https://github.com/mengxi-ream/read-frog/commit/9d378a9029e1d59ea6eefbd84de3c07010943da1) Thanks [@sedationh](https://github.com/sedationh)! - feat: warn user that the source language is the same as the target language

### Patch Changes

- [#331](https://github.com/mengxi-ream/read-frog/pull/331) [`92e855a`](https://github.com/mengxi-ream/read-frog/commit/92e855a8c2cddc4493d056df63d6f1ebe8d3ea58) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: reduce concurrent request capacity

- [#330](https://github.com/mengxi-ream/read-frog/pull/330) [`5e75705`](https://github.com/mengxi-ream/read-frog/commit/5e75705adbede1cd8c317559e640165cf7383465) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: hide floating button when printing web

- [#333](https://github.com/mengxi-ream/read-frog/pull/333) [`f5c2c10`](https://github.com/mengxi-ream/read-frog/commit/f5c2c1082daa03e7118b3f4e4dbb8663fb834736) Thanks [@sedationh](https://github.com/sedationh)! - fix: Shouldn't override Ctrl+Shift+A hotkey https://github.com/mengxi-ream/read-frog/issues/318

## 1.2.2

### Patch Changes

- [#324](https://github.com/mengxi-ream/read-frog/pull/324) [`1d5472e`](https://github.com/mengxi-ream/read-frog/commit/1d5472e10e44ff27d31e0e691825c859b7f4d732) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - perf: cache auth client by proxy

- [#321](https://github.com/mengxi-ream/read-frog/pull/321) [`e531adc`](https://github.com/mengxi-ream/read-frog/commit/e531adc1abdcc1f481184e5ae042aea7d12e3945) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: weird format when translating reddit

## 1.2.1

### Patch Changes

- [#308](https://github.com/mengxi-ream/read-frog/pull/308) [`ac96b1c`](https://github.com/mengxi-ream/read-frog/commit/ac96b1c18960d0c169feaa1dea9ee46468c83ba6) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: Language selector text is unreadable in Dark Mode

- [#312](https://github.com/mengxi-ream/read-frog/pull/312) [`5120759`](https://github.com/mengxi-ream/read-frog/commit/5120759a1a18e92431ea0d184056ba727ff4e999) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: popup ui

- [#319](https://github.com/mengxi-ream/read-frog/pull/319) [`4dc2106`](https://github.com/mengxi-ream/read-frog/commit/4dc2106b220a1b332b53afd3c65808a0f1a55ace) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: custom models in option page

- [#319](https://github.com/mengxi-ream/read-frog/pull/319) [`4dc2106`](https://github.com/mengxi-ream/read-frog/commit/4dc2106b220a1b332b53afd3c65808a0f1a55ace) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - perf: improve speed for gemini thinking models

## 1.2.0

### Minor Changes

- [#275](https://github.com/mengxi-ream/read-frog/pull/275) [`7d6714f`](https://github.com/mengxi-ream/read-frog/commit/7d6714f8e8dbce5cd0cbd5f54505ae7affed941b) Thanks [@AnotiaWang](https://github.com/AnotiaWang)! - feat: added new translation style `weakened`

### Patch Changes

- [#295](https://github.com/mengxi-ream/read-frog/pull/295) [`5e849b3`](https://github.com/mengxi-ream/read-frog/commit/5e849b3951783cc67081683d13d0d931073fb725) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: can't translate selection text with deeplx

- [#290](https://github.com/mengxi-ream/read-frog/pull/290) [`d392aae`](https://github.com/mengxi-ream/read-frog/commit/d392aae9e81758e2fb7ae8d9e987a0a24ed06781) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: custom prompt textarea size

- [#273](https://github.com/mengxi-ream/read-frog/pull/273) [`12624be`](https://github.com/mengxi-ream/read-frog/commit/12624be6c5cbfcc9097a9c5c2c519a74e12a055f) Thanks [@taiiiyang](https://github.com/taiiiyang)! - refactor: extract ui, themes and cn to @repo/ui

## 1.1.0

### Minor Changes

- [#254](https://github.com/mengxi-ream/read-frog/pull/254) [`3f9ae9c`](https://github.com/mengxi-ream/read-frog/commit/3f9ae9c6aa979c22a975e6009cbcdc8239a94504) Thanks [@shuimu5418](https://github.com/shuimu5418)! - feat: add DeepLX translation provider

- [#281](https://github.com/mengxi-ream/read-frog/pull/281) [`63986bf`](https://github.com/mengxi-ream/read-frog/commit/63986bfb431b333f9418458d10d17399aca9dab8) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add gemini to read feature and add gpt-5

### Patch Changes

- [#283](https://github.com/mengxi-ream/read-frog/pull/283) [`04cb32a`](https://github.com/mengxi-ream/read-frog/commit/04cb32a9b59a9cfac2c84125e8fac1fb82840af4) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: deeplx api call

## 1.0.1

### Patch Changes

- [#271](https://github.com/mengxi-ream/read-frog/pull/271) [`5dcce6f`](https://github.com/mengxi-ream/read-frog/commit/5dcce6ff27d7e74acb66f04ad0c72b172330799d) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: shortcut to full translate

- [#276](https://github.com/mengxi-ream/read-frog/pull/276) [`e3a675a`](https://github.com/mengxi-ream/read-frog/commit/e3a675a82ba8d3c6b2bde805206abb3a86fddf38) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: show scoped block custom style

- [#278](https://github.com/mengxi-ream/read-frog/pull/278) [`cff4fdf`](https://github.com/mengxi-ream/read-frog/commit/cff4fdfaaef9026021ebba2b8fb59a07fca39fbd) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - build: upgrade ai package

## 1.0.0

### Major Changes

- [#232](https://github.com/mengxi-ream/read-frog/pull/232) [`c5c062e`](https://github.com/mengxi-ream/read-frog/commit/c5c062ea0ff71c6e0b96396e780406a4a1de18b5) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: integrate trpc

### Minor Changes

- [#191](https://github.com/mengxi-ream/read-frog/pull/191) [`31f816f`](https://github.com/mengxi-ream/read-frog/commit/31f816fbd8b69a1a4781dc2210636344a11144b8) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add selection content

- [`3c745d2`](https://github.com/mengxi-ream/read-frog/commit/3c745d2b10af534119066b9627edeaeefe3bc9e6) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: save vocabulary

- [#231](https://github.com/mengxi-ream/read-frog/pull/231) [`b213a41`](https://github.com/mengxi-ream/read-frog/commit/b213a41ce93c624c7663df8e52d960bd3b8a855a) Thanks [@taiiiyang](https://github.com/taiiiyang)! - implement custom translation node style

- [#201](https://github.com/mengxi-ream/read-frog/pull/201) [`3ddfc81`](https://github.com/mengxi-ream/read-frog/commit/3ddfc816ef008a0bb221b56c288665463887b770) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: stream translate selected text

- [#201](https://github.com/mengxi-ream/read-frog/pull/201) [`3ddfc81`](https://github.com/mengxi-ream/read-frog/commit/3ddfc816ef008a0bb221b56c288665463887b770) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - ai: deprecate openrouter and ollma provider

- [#260](https://github.com/mengxi-ream/read-frog/pull/260) [`2bbe950`](https://github.com/mengxi-ream/read-frog/commit/2bbe950600bea6b6bc1c3dcfce8c59b2a39ac9e4) Thanks [@sedationh](https://github.com/sedationh)! - add blockquote translate style

- [#187](https://github.com/mengxi-ream/read-frog/pull/187) [`0f6d20a`](https://github.com/mengxi-ream/read-frog/commit/0f6d20aff5ff23557bd880ab5eabc4765268c969) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add google oauth login

### Patch Changes

- [`ab2e8af`](https://github.com/mengxi-ream/read-frog/commit/ab2e8afb8da1614a8599d9757aac894f5943beae) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: floating button position range

- [#256](https://github.com/mengxi-ream/read-frog/pull/256) [`b418c79`](https://github.com/mengxi-ream/read-frog/commit/b418c7946db90a2ca010df08990e9398967092ca) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - perf: increase default translate limit

- [#190](https://github.com/mengxi-ream/read-frog/pull/190) [`adffd4d`](https://github.com/mengxi-ream/read-frog/commit/adffd4dd30aed74e22cc6f672ada1b2b3a052195) Thanks [@taiiiyang](https://github.com/taiiiyang)! - expose the rate config of translate request

- [#218](https://github.com/mengxi-ream/read-frog/pull/218) [`3d5f791`](https://github.com/mengxi-ream/read-frog/commit/3d5f791ca79676b59b98d46c0da81e7ab0dedfd2) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: integrate gemini api

- [#228](https://github.com/mengxi-ream/read-frog/pull/228) [`3e4f885`](https://github.com/mengxi-ream/read-frog/commit/3e4f8850507dad971fed84143a658220ab33b124) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - style: change more icons to iconify

- [#219](https://github.com/mengxi-ream/read-frog/pull/219) [`f6fd1eb`](https://github.com/mengxi-ream/read-frog/commit/f6fd1eb561604675ad753a0c876c71bd739e1cf2) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: fix style issue for step 2 and 3

- [#220](https://github.com/mengxi-ream/read-frog/pull/220) [`b3481d7`](https://github.com/mengxi-ream/read-frog/commit/b3481d750923b8ee92f2839424453cb422d67eb7) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - style: change ui lib to iconify

- [#210](https://github.com/mengxi-ream/read-frog/pull/210) [`9c583c8`](https://github.com/mengxi-ream/read-frog/commit/9c583c8399814b12835a6e017b8d6c070607be61) Thanks [@Andrew-Tan](https://github.com/Andrew-Tan)! - feat: added hot key for toggling translation

## 0.11.3

### Patch Changes

- [#183](https://github.com/mengxi-ream/read-frog/pull/183) [`a44530a`](https://github.com/mengxi-ream/read-frog/commit/a44530a357bc6af583f1f1a028d74f86fa6804ae) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add translated cache by dexie

- [#181](https://github.com/mengxi-ream/read-frog/pull/181) [`7072612`](https://github.com/mengxi-ream/read-frog/commit/7072612ac0bf19628c4a699dcec4f81c54396e53) Thanks [@iuhoay](https://github.com/iuhoay)! - fix: improve node translation toggle logic to handle translated content

## 0.11.2

### Patch Changes

- [`b11a650`](https://github.com/mengxi-ream/read-frog/commit/b11a65087e2cf9a37a4da6b2d200f94aabc86bdb) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: don't warning for pure translate provider

## 0.11.1

### Patch Changes

- [#177](https://github.com/mengxi-ream/read-frog/pull/177) [`7572871`](https://github.com/mengxi-ream/read-frog/commit/75728718ed313a6ecf3d2fa7d528ac9cd841dfff) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: allow export and import custom translate prompts

- [#175](https://github.com/mengxi-ream/read-frog/pull/175) [`6242002`](https://github.com/mengxi-ream/read-frog/commit/6242002efa97da7c7c13bde8650826fad0f547e0) Thanks [@zmrlft](https://github.com/zmrlft)! - fix: use customModel if isCustomModel is true

## 0.11.0

### Minor Changes

- [#174](https://github.com/mengxi-ream/read-frog/pull/174) [`8c27264`](https://github.com/mengxi-ream/read-frog/commit/8c272640997f9754ee0f69248dbe55a3b5767561) Thanks [@taiiiyang](https://github.com/taiiiyang)! - support personalized translate prompt

### Patch Changes

- [#165](https://github.com/mengxi-ream/read-frog/pull/165) [`dbf42cd`](https://github.com/mengxi-ream/read-frog/commit/dbf42cd4ceb0632f6e857c06c04444518f10abf9) Thanks [@taiiiyang](https://github.com/taiiiyang)! - add reset config button

## 0.10.9

### Patch Changes

- [#163](https://github.com/mengxi-ream/read-frog/pull/163) [`4db3247`](https://github.com/mengxi-ream/read-frog/commit/4db32471d4da1e92726be34e716f2814bd305a77) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - i18n: add korean to extension ui

## 0.10.8

### Patch Changes

- [#157](https://github.com/mengxi-ream/read-frog/pull/157) [`6f53060`](https://github.com/mengxi-ream/read-frog/commit/6f5306042639cae07fe56e5d69d353020aa16614) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: clean up translate utils

- [#156](https://github.com/mengxi-ream/read-frog/pull/156) [`c795431`](https://github.com/mengxi-ream/read-frog/commit/c795431ad4b8091fcb511afd7b79eda68d384200) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: support markdown file export; fix scroll style in side.content

  style: optimize ui in guide page

## 0.10.7

### Patch Changes

- [#149](https://github.com/mengxi-ream/read-frog/pull/149) [`0ccc7f5`](https://github.com/mengxi-ream/read-frog/commit/0ccc7f5aa403db8ed5b84552d4891833b59305af) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: load config to content script

- [#149](https://github.com/mengxi-ream/read-frog/pull/149) [`0ccc7f5`](https://github.com/mengxi-ream/read-frog/commit/0ccc7f5aa403db8ed5b84552d4891833b59305af) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: translation control"

## 0.10.6

### Patch Changes

- [#146](https://github.com/mengxi-ream/read-frog/pull/146) [`df733d4`](https://github.com/mengxi-ream/read-frog/commit/df733d415b04ecb17c42b54b8cea0d59d459b664) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: set target language right after entering guide step 1

- [#144](https://github.com/mengxi-ream/read-frog/pull/144) [`5d3ac93`](https://github.com/mengxi-ream/read-frog/commit/5d3ac93d84fc501b6c2af3ced5000fb877067e1d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - chore: add neat reader url on popup

## 0.10.5

### Patch Changes

- [#140](https://github.com/mengxi-ream/read-frog/pull/140) [`63f19d8`](https://github.com/mengxi-ream/read-frog/commit/63f19d84980f92d74d6aba463de2ca9b0f19fa08) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - ci: changelog from changeset

## 0.10.4

### Patch Changes

- [#138](https://github.com/mengxi-ream/read-frog/pull/138) [`dd1689e`](https://github.com/mengxi-ream/read-frog/commit/dd1689e802cee10775965d7e89244283ef4df17f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - ci: release multiple packages

## 0.10.3

### Patch Changes

- [#137](https://github.com/mengxi-ream/read-frog/pull/137) [`307f672`](https://github.com/mengxi-ream/read-frog/commit/307f672a26b600b2b765c3d3612c440d71908027) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - chore: move the website code to this monorepo

- [#133](https://github.com/mengxi-ream/read-frog/pull/133) [`31ecd4d`](https://github.com/mengxi-ream/read-frog/commit/31ecd4d21686bf6d02bb4a91c0c6aea4d09e7ffe) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: flicker of the always translate switch

## 0.10.2

### Patch Changes

- [#134](https://github.com/mengxi-ream/read-frog/pull/134) [`c4af768`](https://github.com/mengxi-ream/read-frog/commit/c4af768f2b02ab17032163e3e773b884a7886d98) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - style: update translation error button style

- [#130](https://github.com/mengxi-ream/read-frog/pull/130) [`e48ffda`](https://github.com/mengxi-ream/read-frog/commit/e48ffda23588c5d1e45f57642794b749a2522e5c) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: add shadow root for error ui

- [#132](https://github.com/mengxi-ream/read-frog/pull/132) [`034d0b8`](https://github.com/mengxi-ream/read-frog/commit/034d0b8b15ad2c8c1ad42ceb53bf0023152d405c) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: disable the translate switch for ignore tabs

## 0.10.1

### Patch Changes

- [`e819cf1`](https://github.com/mengxi-ream/read-frog/commit/e819cf12534d0afa04475f45570e31cbcfd9ed7c) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: don't translate code block

- [`928c086`](https://github.com/mengxi-ream/read-frog/commit/928c0862ab84bbaee74c58f86074ddc8de1f864b) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - perf: concurrent translation

## 0.10.0

### Minor Changes

- [#106](https://github.com/mengxi-ream/read-frog/pull/106) [`e5ead6f`](https://github.com/mengxi-ream/read-frog/commit/e5ead6fc7991b97ea41affe40e49513bd2237b84) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add retry and error ui for translation

### Patch Changes

- [#120](https://github.com/mengxi-ream/read-frog/pull/120) [`9805559`](https://github.com/mengxi-ream/read-frog/commit/9805559ec48e0141c3ca0b20721fa8d2090c4688) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: allow auto translation in iframe and shadow roots

- [`d8a128a`](https://github.com/mengxi-ream/read-frog/commit/d8a128adc38a5089e9ad63738ce274dc5123dfc6) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: add tab permission to set always translation domain

- [#115](https://github.com/mengxi-ream/read-frog/pull/115) [`281f823`](https://github.com/mengxi-ream/read-frog/commit/281f82371f4add0fb695eccd595cc84a133e2709) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: translate to zh-TW when user select cmn-Hant

- [`a67ae31`](https://github.com/mengxi-ream/read-frog/commit/a67ae312f24eb8048b62648b4aa22fe4b8b30b36) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: send message when clicking read button on popup page

## 0.9.1

### Patch Changes

- [#104](https://github.com/mengxi-ream/read-frog/pull/104) [`22967a0`](https://github.com/mengxi-ream/read-frog/commit/22967a07ee99c1c144d181aab1688938649806cf) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: integrate request queue with translation api

## 0.9.0

### Minor Changes

- [#97](https://github.com/mengxi-ream/read-frog/pull/97) [`43ca08f`](https://github.com/mengxi-ream/read-frog/commit/43ca08face81df6c64c278fc485c2c4c5ab54337) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add request queue without retry mechanism

- [#99](https://github.com/mengxi-ream/read-frog/pull/99) [`0d70375`](https://github.com/mengxi-ream/read-frog/commit/0d703751c46055bb0adba383e920b7938fa7a34d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: retry and timeout mechanism of request queue

## 0.8.2

### Patch Changes

- [#89](https://github.com/mengxi-ream/read-frog/pull/89) [`d103106`](https://github.com/mengxi-ream/read-frog/commit/d1031063c58b4c0b1cabea7da19b06ed7120d5dc) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(translate): connection race condition to push the port

- [#87](https://github.com/mengxi-ream/read-frog/pull/87) [`ea25cff`](https://github.com/mengxi-ream/read-frog/commit/ea25cff5644439daa56e251ab0eb58d9bc30613a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(traversal): combine consecutive inline nodes together to translate in block-inline-mixed paragraph

- [#85](https://github.com/mengxi-ream/read-frog/pull/85) [`03a8c21`](https://github.com/mengxi-ream/read-frog/commit/03a8c21060cef31c8fcc479b0e5afa3a0ad75967) Thanks [@LixWyk5](https://github.com/LixWyk5)! - underline anchor elements in translated content

## 0.8.1

### Patch Changes

- [#82](https://github.com/mengxi-ream/read-frog/pull/82) [`91bab3e`](https://github.com/mengxi-ream/read-frog/commit/91bab3eef28d308dfb705ccd0779dfaaddac9b36) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - test ci release action

## 0.8.0

### Minor Changes

- [#72](https://github.com/mengxi-ream/read-frog/pull/72) [`2ef529e`](https://github.com/mengxi-ream/read-frog/commit/2ef529e30cee105754e956b131b2a1a1403867ea) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: enable auto translation for certain url pattern

### Patch Changes

- [#79](https://github.com/mengxi-ream/read-frog/pull/79) [`df67a59`](https://github.com/mengxi-ream/read-frog/commit/df67a59140cdf9287e857fc7862126dec6e917b7) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: smash style in class by computed style

- [#80](https://github.com/mengxi-ream/read-frog/pull/80) [`1af9574`](https://github.com/mengxi-ream/read-frog/commit/1af95743b8c64e7c6e12eb3c541e2ff914bb8e9b) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: detect added container itself for autotranslate

## 0.7.5

### Patch Changes

- [#67](https://github.com/mengxi-ream/read-frog/pull/67) [`0818ad2`](https://github.com/mengxi-ream/read-frog/commit/0818ad22612e6e2a018929b96e0e0c47288f818a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add four finger touch trigger

- [#61](https://github.com/mengxi-ream/read-frog/pull/61) [`cd5e64f`](https://github.com/mengxi-ream/read-frog/commit/cd5e64f1c107b9bf987247cc138de7872e674ab0) Thanks [@zmrlft](https://github.com/zmrlft)! - feat: the feature integrate ollama

- [#65](https://github.com/mengxi-ream/read-frog/pull/65) [`9433dd8`](https://github.com/mengxi-ream/read-frog/commit/9433dd8400b1b299266c2fdc9fd9ec0e223e91d3) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: only select editable area when select all in these elements

## 0.7.4

### Patch Changes

- [`837fcc6`](https://github.com/mengxi-ream/read-frog/commit/837fcc63330897341e0a5df208ff964a9fa72f99) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(traversal): find deepest element from point

- [`af0da30`](https://github.com/mengxi-ream/read-frog/commit/af0da303e77fa5d88e408e95b9e1d0c2f8c234a8) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add new user guide

- [#58](https://github.com/mengxi-ream/read-frog/pull/58) [`e5d4107`](https://github.com/mengxi-ream/read-frog/commit/e5d41079f7b2fd98a7e35de04c71e1dffa6538c6) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - allow read frog website to set target language code

## 0.7.3

### Patch Changes

- [#54](https://github.com/mengxi-ream/read-frog/pull/54) [`7a5f187`](https://github.com/mengxi-ream/read-frog/commit/7a5f1873257dc6f09e76209c3c174564a8746a94) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - send isPinned to read frog website

## 0.7.2

### Patch Changes

- [`cefe29f`](https://github.com/mengxi-ream/read-frog/commit/cefe29f7af4ff6da87c5ed10ecd7cbcfdc4208d7) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - direct url to translation guide after installation

## 0.7.1

### Patch Changes

- [#37](https://github.com/mengxi-ream/read-frog/pull/37) [`60f16cc`](https://github.com/mengxi-ream/read-frog/commit/60f16cc41496941b0738e5cfe7b865646827b232) Thanks [@missuo](https://github.com/missuo)! - add base URL configuration for providers

- [#40](https://github.com/mengxi-ream/read-frog/pull/40) [`3db9d83`](https://github.com/mengxi-ream/read-frog/commit/3db9d8376ce67490d8c043b750f510510a3a4182) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - improve options page ui

## 0.7.0

### Minor Changes

- [#34](https://github.com/mengxi-ream/read-frog/pull/34) [`5de10ce`](https://github.com/mengxi-ream/read-frog/commit/5de10ced51f3dd88dadaa0cfa32c2984d9eca854) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add support to openrouter and support different model config for reading and translating

## 0.6.1

### Patch Changes

- [`d457f8e`](https://github.com/mengxi-ream/read-frog/commit/d457f8e562007a71d25ffc4642f532c786fb0b74) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix can't use normal translator when no api key

## 0.6.0

### Minor Changes

- [#25](https://github.com/mengxi-ream/read-frog/pull/25) [`054a767`](https://github.com/mengxi-ream/read-frog/commit/054a7674283c6767f57eddbcd85ebaf382372e07) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add normal translation service from google and microsoft

### Patch Changes

- [#27](https://github.com/mengxi-ream/read-frog/pull/27) [`bf00519`](https://github.com/mengxi-ream/read-frog/commit/bf00519a2e4135f59ead03042be1d5df4089a15a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix extract old article

## 0.5.4

### Patch Changes

- [`487b78f`](https://github.com/mengxi-ream/read-frog/commit/487b78f97ca8b942fa86c3c9a3d36fec108c9adb) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - clean zero-width space in sourcetext for translate

## 0.5.3

### Patch Changes

- [`2656a99`](https://github.com/mengxi-ream/read-frog/commit/2656a998f2925195337332e9a4e62dba0bb34704) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - don't read dummy node

## 0.5.2

### Patch Changes

- [`59ee40b`](https://github.com/mengxi-ream/read-frog/commit/59ee40bf26d6e71b6504561fad6e744ea6e6e1f7) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - don't walk into hidden element

## 0.5.1

### Patch Changes

- [`60b5f42`](https://github.com/mengxi-ream/read-frog/commit/60b5f42ce12c16a16cde5bc9f57e6e29c8715d27) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add read floating button

- [`8162458`](https://github.com/mengxi-ream/read-frog/commit/81624587dd25c676d03a1362558b50eee499dbd7) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add popup and warning i18n

## 0.5.0

### Minor Changes

- [`cd59435`](https://github.com/mengxi-ream/read-frog/commit/cd59435805fe55ef530526ed13c6fee2883475cf) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - translate the whole page with button on popup and content script

## 0.4.8

### Patch Changes

- [#13](https://github.com/mengxi-ream/read-frog/pull/13) [`8eb0e9e`](https://github.com/mengxi-ream/read-frog/commit/8eb0e9ee82f8a0b824532d5b37b40e565703ed65) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - import pollute the css in host

- [`db6fe75`](https://github.com/mengxi-ream/read-frog/commit/db6fe756410473bb1a39d01bc20cb4aee68f4dcd) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add ci stuff

## 0.4.7

### Patch Changes

- [#11](https://github.com/mengxi-ream/read-frog/pull/11) [`1337030`](https://github.com/mengxi-ream/read-frog/commit/1337030f10de66ef32f5849f702886f1f117b4f2) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - import pollute the css in host

## 0.4.6

### Patch Changes

- [#8](https://github.com/mengxi-ream/read-frog/pull/8) [`328afd9`](https://github.com/mengxi-ream/read-frog/commit/328afd9f556a960cc770647dd9947443b4c15c96) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - remove ctx

## 0.4.5

### Patch Changes

- [`856ca46`](https://github.com/mengxi-ream/read-frog/commit/856ca46e17383e91ff8035b65dff31633b3f20a0) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - allow tag for private package

## 0.4.4

### Patch Changes

- [`c7090e1`](https://github.com/mengxi-ream/read-frog/commit/c7090e1826a81897c78ebc4f93720bab69893fb6) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - change release script

## 0.4.3

### Patch Changes

- [`41ffa3c`](https://github.com/mengxi-ream/read-frog/commit/41ffa3c6c67a0cc6bddeaf0702411a5a6315839a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add github release

- [`07e79c3`](https://github.com/mengxi-ream/read-frog/commit/07e79c359e4493b2d6d83c3b47e86c80a98fa0b0) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - add changelog-github

## 0.4.2

### Patch Changes

- e865d09: add changeset release action
- 58c5af7: install changesets
