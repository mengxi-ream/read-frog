# @read-frog/extension

## 1.26.1

### Patch Changes

- [`e1943f1`](https://github.com/mengxi-ream/read-frog/commit/e1943f1643fd70b035e583eaa75150d8cd10c416) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: firefox extension id

- [#958](https://github.com/mengxi-ream/read-frog/pull/958) [`f74d826`](https://github.com/mengxi-ream/read-frog/commit/f74d8267839359851adb126809c4e35202f8380b) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix(extension): fix hidden elements being translated

- [#995](https://github.com/mengxi-ream/read-frog/pull/995) [`59f9bac`](https://github.com/mengxi-ream/read-frog/commit/59f9bace3dcfe5a8964205a8143a0077665de49a) Thanks [@cesaryuan](https://github.com/cesaryuan)! - fix(api-providers): sync provider options editor when switching providers

- [#1006](https://github.com/mengxi-ream/read-frog/pull/1006) [`74b8744`](https://github.com/mengxi-ream/read-frog/commit/74b8744843c797cf9b7e87c4ae5d6b52747709ab) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix(extension): prevent spinner from being distorted into ellipse by host page CSS

- [#1009](https://github.com/mengxi-ream/read-frog/pull/1009) [`c942331`](https://github.com/mengxi-ream/read-frog/commit/c9423310a9f8e4d754478b744bb20463b69af402) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): fix subtitles flickering on Firefox by moving display decisions into Jotai atoms

- [#1008](https://github.com/mengxi-ream/read-frog/pull/1008) [`7e822cb`](https://github.com/mengxi-ream/read-frog/commit/7e822cb73881715f248afcea955f76d59da8689e) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: replace agentation dev toolbar with draggable help button

- [#1007](https://github.com/mengxi-ream/read-frog/pull/1007) [`5ae4de0`](https://github.com/mengxi-ream/read-frog/commit/5ae4de063c18045b2b22cf5425046b39479f883c) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: make comment in youtube as block

## 1.26.0

### Minor Changes

- [#993](https://github.com/mengxi-ream/read-frog/pull/993) [`79827cd`](https://github.com/mengxi-ream/read-frog/commit/79827cda9d0f28403b3ac969c7e492c9328cfa65) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat(tts): add Edge TTS as free text-to-speech provider with per-language voice config

- [#982](https://github.com/mengxi-ream/read-frog/pull/982) [`d578d6a`](https://github.com/mengxi-ream/read-frog/commit/d578d6a4c486a4461c7ed565647f668852688ba4) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: remove read provider and unify per-feature provider model

### Patch Changes

- [#988](https://github.com/mengxi-ream/read-frog/pull/988) [`e211d9c`](https://github.com/mengxi-ream/read-frog/commit/e211d9c4eaeb1edf40b9ce1fcad7f573471334b7) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat(api-providers): add feature provider toggles and badge refactor

- [#997](https://github.com/mengxi-ream/read-frog/pull/997) [`d1ee33d`](https://github.com/mengxi-ream/read-frog/commit/d1ee33d9d51b084af72dbfd132e5e9a3f0b14820) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(subtitles): enable video subtitles in default config and remove subtitle beta labels in ui/docs

- [#957](https://github.com/mengxi-ream/read-frog/pull/957) [`d2ee3d6`](https://github.com/mengxi-ream/read-frog/commit/d2ee3d618d0cc05252d7a7b045a3c1d31e792340) Thanks [@ishiko732](https://github.com/ishiko732)! - fix: update website URL for custom provider to correct path

- [#992](https://github.com/mengxi-ream/read-frog/pull/992) [`52b6bca`](https://github.com/mengxi-ream/read-frog/commit/52b6bca44bb3b5db52085c0ba09a1f4e72385d16) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): fast detect no-subtitles before fetching

- [#998](https://github.com/mengxi-ream/read-frog/pull/998) [`a745724`](https://github.com/mengxi-ream/read-frog/commit/a745724f49a3953e60f14cb93528bc662a486614) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat(tts): add offscreen audio playback and LLM language detection mode

- [#954](https://github.com/mengxi-ream/read-frog/pull/954) [`306659f`](https://github.com/mengxi-ream/read-frog/commit/306659fad27d3e3c67ad2cdbd17e22bf0f33c0dd) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(selection): route selection stream requests through background to bypass CORS restrictions

- [#961](https://github.com/mengxi-ream/read-frog/pull/961) [`6f24070`](https://github.com/mengxi-ream/read-frog/commit/6f240701899419c3be1b704b461075393ab6bdd1) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): enable text selection and copy in subtitle container

- [#962](https://github.com/mengxi-ream/read-frog/pull/962) [`67b75c6`](https://github.com/mengxi-ream/read-frog/commit/67b75c6836519ed6dac39e4ac323fe12f25c2253) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): add RTL direction and lang attributes to translation subtitles

- [#1004](https://github.com/mengxi-ream/read-frog/pull/1004) [`0126569`](https://github.com/mengxi-ream/read-frog/commit/012656911820ee56a79cb760673e086b28316c3a) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: css size escape character

- [#989](https://github.com/mengxi-ream/read-frog/pull/989) [`6c807ae`](https://github.com/mengxi-ream/read-frog/commit/6c807aee3f377e1a12f49d30ec575d1a6decaf77) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: merge site control settings into general page

- [#1000](https://github.com/mengxi-ream/read-frog/pull/1000) [`1f3fc14`](https://github.com/mengxi-ream/read-frog/commit/1f3fc141ebce81c815a9d2f376298e89538b212e) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - chore: upgrade deps

- [#981](https://github.com/mengxi-ream/read-frog/pull/981) [`e0d68dd`](https://github.com/mengxi-ream/read-frog/commit/e0d68dd8011acca991659f34eac6377897162ff3) Thanks [@taiiiyang](https://github.com/taiiiyang)! - refactor(subtitles): simplify state machine and improve loading display

- [#1003](https://github.com/mengxi-ream/read-frog/pull/1003) [`7c99db6`](https://github.com/mengxi-ream/read-frog/commit/7c99db6a169d09a052ba8c9b2821149b43c62772) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - build: firefox build scripts and remove useless base ui fix

- [#990](https://github.com/mengxi-ream/read-frog/pull/990) [`3df025f`](https://github.com/mengxi-ream/read-frog/commit/3df025f2fdf837da5789c624db52f9013ce765ed) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - style: refine UI components, extract shared MultiLanguageCombobox, and clean up unused components

## 1.25.1

### Patch Changes

- [#951](https://github.com/mengxi-ream/read-frog/pull/951) [`af2e930`](https://github.com/mengxi-ream/read-frog/commit/af2e930ff9a3db661ef56b6a30ffb94b12126273) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(ui): fix slider track collapse on wide screen in video subtitles settings

- [#953](https://github.com/mengxi-ream/read-frog/pull/953) [`e27858d`](https://github.com/mengxi-ream/read-frog/commit/e27858de1a833950417680cf74907fc31ef06e1e) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): fallback to show original subtitle in bilingual mode on translation error

## 1.25.0

### Minor Changes

- [#930](https://github.com/mengxi-ream/read-frog/pull/930) [`a1ec67a`](https://github.com/mengxi-ream/read-frog/commit/a1ec67a8cb246843abf7a1dbe7d3c4b3e09217c1) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(subtitles): improve subtitle container positioning and visual effects

- [#933](https://github.com/mengxi-ream/read-frog/pull/933) [`4928469`](https://github.com/mengxi-ream/read-frog/commit/4928469699596946a5acec15b15b62bb992cb0c3) Thanks [@taiiiyang](https://github.com/taiiiyang)! - refactor(subtitles): replace XHR interception with direct fetch for YouTube subtitles

- [#932](https://github.com/mengxi-ream/read-frog/pull/932) [`aa6cc36`](https://github.com/mengxi-ream/read-frog/commit/aa6cc36cf1d76bc3732c47a1489e4d720dfffdce) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor(ui): migrate shadcn components to base-ui

### Patch Changes

- [#943](https://github.com/mengxi-ream/read-frog/pull/943) [`d0986d4`](https://github.com/mengxi-ream/read-frog/commit/d0986d42081c3c6dcc77944fc4fc4646da0ef72b) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor(ui): consolidate UI components under src/components/ui/

- [#923](https://github.com/mengxi-ream/read-frog/pull/923) [`955dafd`](https://github.com/mengxi-ream/read-frog/commit/955dafd7594d9f67d66c70f9e7b2c820fb78c6e4) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: add custom prompts support for video subtitles translation

- [#945](https://github.com/mengxi-ream/read-frog/pull/945) [`d721988`](https://github.com/mengxi-ream/read-frog/commit/d72198852a507a855906957be4510d45848d8c1b) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(subtitles): ensure CC enabled to trigger YouTube BotGuard POT token generation

- [#947](https://github.com/mengxi-ream/read-frog/pull/947) [`011519c`](https://github.com/mengxi-ream/read-frog/commit/011519c9616ebc848476fc4676002058ee75b783) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(ui): close AlertDialog on action button click

- [#939](https://github.com/mengxi-ream/read-frog/pull/939) [`01f0e95`](https://github.com/mengxi-ream/read-frog/commit/01f0e95a987cf5cda06177b650b7acc848189a0a) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): respect user's selected subtitle track on YouTube

- [#929](https://github.com/mengxi-ream/read-frog/pull/929) [`ddbc50d`](https://github.com/mengxi-ream/read-frog/commit/ddbc50d4ed5b139a5b9d26f4290b89df2a801dec) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): prevent navigation events from hiding subtitles unexpectedly and improve AI error messages

- [#924](https://github.com/mengxi-ream/read-frog/pull/924) [`d7e8c23`](https://github.com/mengxi-ream/read-frog/commit/d7e8c235c17709f7b4a872dffee6a549a0013ff0) Thanks [@sdxdlgz](https://github.com/sdxdlgz)! - fix(subtitles): auto-hide error state and harden YouTube fetcher

- [#914](https://github.com/mengxi-ream/read-frog/pull/914) [`79f8702`](https://github.com/mengxi-ream/read-frog/commit/79f870279e014f6f38f739eae06c1a6b00e8e6e1) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: handle unknown HTTP error status in YouTube subtitle fetcher

- [#922](https://github.com/mengxi-ream/read-frog/pull/922) [`fa99c8a`](https://github.com/mengxi-ream/read-frog/commit/fa99c8a29bd6889e0eceb16d06cfd860129d8b55) Thanks [@flowKKo](https://github.com/flowKKo)! - feat: add retry button for translation cards

- [#946](https://github.com/mengxi-ream/read-frog/pull/946) [`1f61823`](https://github.com/mengxi-ream/read-frog/commit/1f6182333746d7e3ad54e0b51cbc1a0163d9232b) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat(ui): replace model selector popover with searchable combobox

- [#949](https://github.com/mengxi-ream/read-frog/pull/949) [`67a9310`](https://github.com/mengxi-ream/read-frog/commit/67a9310a90bbd210aac6af66edd27b02bd51397b) Thanks [@taiiiyang](https://github.com/taiiiyang)! - refactor(subtitles): replace block-based translation with on-demand strategy

- [#936](https://github.com/mengxi-ream/read-frog/pull/936) [`ef84d44`](https://github.com/mengxi-ream/read-frog/commit/ef84d4445808cdfeceec51a992fd19b53c7b567a) Thanks [@ishiko732](https://github.com/ishiko732)! - perf(logger): show caller source location in browser console by using `console.bind` instead of wrapper functions

- [#950](https://github.com/mengxi-ream/read-frog/pull/950) [`2d6fa6f`](https://github.com/mengxi-ream/read-frog/commit/2d6fa6f9d1242068d495ab7d1d7f71fc13c2fe02) Thanks [@taiiiyang](https://github.com/taiiiyang)! - i18n: shorten survey sidebar text and add gift emoji

- [#937](https://github.com/mengxi-ream/read-frog/pull/937) [`adab0ac`](https://github.com/mengxi-ream/read-frog/commit/adab0ac62efcfec8aab0d121e213e0a844d7ca04) Thanks [@taiiiyang](https://github.com/taiiiyang)! - refactor(subtitles): unify noise filtering to fetcher layer

- [#944](https://github.com/mengxi-ream/read-frog/pull/944) [`6dc3562`](https://github.com/mengxi-ream/read-frog/commit/6dc3562a991d244ffcd8d9d55b36cacbe4f9d003) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - chore: upgrade AI SDK and other dependencies

## 1.24.0

### Minor Changes

- [#875](https://github.com/mengxi-ream/read-frog/pull/875) [`e456666`](https://github.com/mengxi-ream/read-frog/commit/e45666685fd152d38688573522f87790efadd276) Thanks [@flowKKo](https://github.com/flowKKo)! - feat: implement multi-api translation feature

### Patch Changes

- [#903](https://github.com/mengxi-ream/read-frog/pull/903) [`7cbc45f`](https://github.com/mengxi-ream/read-frog/commit/7cbc45f048ce8f48ebf7329ef7cb4bcc7d2eef4e) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: github translation rule

- [#901](https://github.com/mengxi-ream/read-frog/pull/901) [`e06df1d`](https://github.com/mengxi-ream/read-frog/commit/e06df1de8b4ff4ea12b71cb4afae98b38e373beb) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(ai): configure reasoning effort per GPT-5 model variant

  - GPT-5.2 and GPT-5.1+ don't support 'minimal', now use 'none'
  - gpt-5-pro uses 'high', gpt-5.2-pro uses 'medium'
  - gpt-5.x-chat-latest models use 'medium'
  - GPT-5 (before 5.1) and o1/o3 models keep 'minimal'

- [#910](https://github.com/mengxi-ream/read-frog/pull/910) [`6a56694`](https://github.com/mengxi-ream/read-frog/commit/6a56694e30892fedfb64c74b315471564bafedcd) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(video): prevent subtitle container unmounting to fix drag becoming unresponsive

- [#912](https://github.com/mengxi-ream/read-frog/pull/912) [`693f1f2`](https://github.com/mengxi-ream/read-frog/commit/693f1f29a99e17682e5155448f9a71126f529fbe) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - refactor: improve translation hub

- [#907](https://github.com/mengxi-ream/read-frog/pull/907) [`8292480`](https://github.com/mengxi-ream/read-frog/commit/829248065bddc3e41cd321b9ede5494277b72680) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(ui): add ON/OFF badge to subtitle toggle button

- [#896](https://github.com/mengxi-ream/read-frog/pull/896) [`4f24028`](https://github.com/mengxi-ream/read-frog/commit/4f24028821a9aaa1ed5d07652ef9c267e1b51dd9) Thanks [@moxi000](https://github.com/moxi000)! - feat: add support for local HTML file (file://) translation

- [#902](https://github.com/mengxi-ream/read-frog/pull/902) [`77d081f`](https://github.com/mengxi-ream/read-frog/commit/77d081f256b36ea8b11814d0ed727a34e364137c) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: replace feature suggestion survey with subtitle translation survey

- [#888](https://github.com/mengxi-ream/read-frog/pull/888) [`b6ef3c0`](https://github.com/mengxi-ream/read-frog/commit/b6ef3c0d4c5cdcec3603913edb3911bbd3d2d6af) Thanks [@yrom](https://github.com/yrom)! - fix: add crypto.randomUUID polyfill to support HTTP website translation

- [#904](https://github.com/mengxi-ream/read-frog/pull/904) [`0a35256`](https://github.com/mengxi-ream/read-frog/commit/0a3525696c4262c6d2a2276310f01ddca1c138c9) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(ui): improve video subtitle settings cards responsive layout

## 1.23.0

### Minor Changes

- [#894](https://github.com/mengxi-ream/read-frog/pull/894) [`895294d`](https://github.com/mengxi-ream/read-frog/commit/895294d87d11dbc00a2f4e8703d5c82a542fba32) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(subtitles): add AI-powered intelligent sentence segmentation

- [#878](https://github.com/mengxi-ream/read-frog/pull/878) [`59ea5ef`](https://github.com/mengxi-ream/read-frog/commit/59ea5ef812e28ce9ba9f5c4c5daf16f6fca9971f) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat: add global site whitelist mode

  Add a new Site Control feature that allows users to configure the extension to only run on specific whitelisted sites instead of all sites.

- [#882](https://github.com/mengxi-ream/read-frog/pull/882) [`4839415`](https://github.com/mengxi-ream/read-frog/commit/4839415f9b5d8bcbe880d910d4b88e8b9da0bfef) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat: add skip languages feature to preserve paragraphs in specified languages

- [#886](https://github.com/mengxi-ream/read-frog/pull/886) [`76aae58`](https://github.com/mengxi-ream/read-frog/commit/76aae58c29dea465a57fa87e17133e5f727678c8) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(subtitles): add subtitle display mode and custom style settings

### Patch Changes

- [#895](https://github.com/mengxi-ream/read-frog/pull/895) [`793aed0`](https://github.com/mengxi-ream/read-frog/commit/793aed08ba5bf7e72f9276fdafa7d7cb26495303) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(translation): skip usernames, timestamps, and quoted replies on Discord

- [#883](https://github.com/mengxi-ream/read-frog/pull/883) [`5dc9f8c`](https://github.com/mengxi-ream/read-frog/commit/5dc9f8c0315114a0266227c549502c39360f541d) Thanks [@guoyongchang](https://github.com/guoyongchang)! - refactor(input-translation): update config fields design and fix truncation issue

- [#897](https://github.com/mengxi-ream/read-frog/pull/897) [`d5e3c2f`](https://github.com/mengxi-ream/read-frog/commit/d5e3c2f0d6bdf81c33c4b54892422ec0f5d29771) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(subtitles): add independent translation rate configuration for video subtitles

## 1.22.1

### Patch Changes

- [#871](https://github.com/mengxi-ream/read-frog/pull/871) [`3786b10`](https://github.com/mengxi-ream/read-frog/commit/3786b10fcefcd355ce539ce36dfff64ed7914b52) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: allow drag video subtitles

- [#879](https://github.com/mengxi-ream/read-frog/pull/879) [`f303fa9`](https://github.com/mengxi-ream/read-frog/commit/f303fa9ea7931b7bb96f241bc61a1c44464ea1d4) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: prevent node translation from triggering on phantom keyup events

- [#881](https://github.com/mengxi-ream/read-frog/pull/881) [`15a0e38`](https://github.com/mengxi-ream/read-frog/commit/15a0e38d624bce4755e739a35d0002d117837957) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix(subtitles): improve YouTube ASR subtitle segmentation

- [#877](https://github.com/mengxi-ream/read-frog/pull/877) [`97f15c5`](https://github.com/mengxi-ream/read-frog/commit/97f15c5a9f2502dbfe39af134fa7dc05471692e9) Thanks [@taiiiyang](https://github.com/taiiiyang)! - refactor(subtitles): use separate translation queue for subtitles

- [#874](https://github.com/mengxi-ream/read-frog/pull/874) [`ffe6b37`](https://github.com/mengxi-ream/read-frog/commit/ffe6b376f387526f68339501e4fa7c80a41e3b51) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: add auto-start subtitle translation option

- [#880](https://github.com/mengxi-ream/read-frog/pull/880) [`f7d8a82`](https://github.com/mengxi-ream/read-frog/commit/f7d8a82ecd63d785a803908ed9c841c45aa4c7e0) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(subtitles): add subtitle display mode settings with bilingual, original-only, translation-only modes and translation position options

## 1.22.0

### Minor Changes

- [#859](https://github.com/mengxi-ream/read-frog/pull/859) [`ed8ed19`](https://github.com/mengxi-ream/read-frog/commit/ed8ed1946b76a85df1264872bb5dd7459a2d34e5) Thanks [@zmrlft](https://github.com/zmrlft)! - feat: add click and hold to translate

- [#817](https://github.com/mengxi-ream/read-frog/pull/817) [`db45a88`](https://github.com/mengxi-ream/read-frog/commit/db45a88ef4a0c9b8b19fe4e2bd55b2b02ca54c27) Thanks [@guoyongchang](https://github.com/guoyongchang)! - feat: add triple-space input translation feature

- [#856](https://github.com/mengxi-ream/read-frog/pull/856) [`597ce14`](https://github.com/mengxi-ream/read-frog/commit/597ce14e70aae37b5fa6b538e8b02a78ae93ab86) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add minimum characters filter for page translation

### Patch Changes

- [#868](https://github.com/mengxi-ream/read-frog/pull/868) [`ff23528`](https://github.com/mengxi-ream/read-frog/commit/ff2352805ee0923cc761234eeb3d457504c91b1d) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: supplement subtitles sentence end pattern with international punctuation

- [#869](https://github.com/mengxi-ream/read-frog/pull/869) [`98e2edf`](https://github.com/mengxi-ream/read-frog/commit/98e2edfc0bcde7d57c7bc626e9542ffb7c0d7daf) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: force <task-list> to be block in github website

- [#856](https://github.com/mengxi-ream/read-frog/pull/856) [`597ce14`](https://github.com/mengxi-ream/read-frog/commit/597ce14e70aae37b5fa6b538e8b02a78ae93ab86) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: improve floating button drag smoothness by deferring storage writes

- [#862](https://github.com/mengxi-ream/read-frog/pull/862) [`acc7d8d`](https://github.com/mengxi-ream/read-frog/commit/acc7d8d0fe1267fcf4779e17be3ad58d5f3e5dca) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: add minimum words filter for small paragraph translation

- [#866](https://github.com/mengxi-ream/read-frog/pull/866) [`f95cf61`](https://github.com/mengxi-ream/read-frog/commit/f95cf61a4daf87364f7f4fd72166f9309becbca8) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: make video subtitles feature available as public beta

## 1.21.4

### Patch Changes

- [#853](https://github.com/mengxi-ream/read-frog/pull/853) [`42f6b2c`](https://github.com/mengxi-ream/read-frog/commit/42f6b2c3d2098fad7dc5941cd2cad80f4dc14337) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - chore: migrate atomFamily from jotai/utils to jotai-family

- [#851](https://github.com/mengxi-ream/read-frog/pull/851) [`13ae51e`](https://github.com/mengxi-ream/read-frog/commit/13ae51e09d006088d7aa5ddadb31393a83521a68) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - chore: upgrade dependencies

## 1.21.3

### Patch Changes

- [#850](https://github.com/mengxi-ream/read-frog/pull/850) [`4b3ba80`](https://github.com/mengxi-ream/read-frog/commit/4b3ba802218983e0f208618509827d778bbeaa8f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: normalize whitespace without preserving newlines in translation

- [#839](https://github.com/mengxi-ream/read-frog/pull/839) [`ce49281`](https://github.com/mengxi-ream/read-frog/commit/ce49281f254f87456e13a3d2520426ee6a10f835) Thanks [@Yukiniro](https://github.com/Yukiniro)! - chore: replace franc-min with franc

- [#839](https://github.com/mengxi-ream/read-frog/pull/839) [`ce49281`](https://github.com/mengxi-ream/read-frog/commit/ce49281f254f87456e13a3d2520426ee6a10f835) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: upgrade zod and ai packages to solve memory issue of type check

## 1.21.2

### Patch Changes

- [#838](https://github.com/mengxi-ream/read-frog/pull/838) [`dadee30`](https://github.com/mengxi-ream/read-frog/commit/dadee308734ac62b1ce5c3b512be1097e8bbddf6) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: Improve the speed of subtitle translation through block translation

## 1.21.1

### Patch Changes

- [#844](https://github.com/mengxi-ream/read-frog/pull/844) [`6f0f9fa`](https://github.com/mengxi-ream/read-frog/commit/6f0f9fabe02a07af8dfb37f5f6a44443770571e3) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: add drag-and-drop sorting for API provider cards

- [#841](https://github.com/mengxi-ream/read-frog/pull/841) [`33acbfc`](https://github.com/mengxi-ream/read-frog/commit/33acbfc7afa3bc265181bb1e1a1d8222e857df1a) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: ensure language detection only occurs in the top frame to prevent race conditions with iframes

- [#846](https://github.com/mengxi-ream/read-frog/pull/846) [`35eaa5f`](https://github.com/mengxi-ream/read-frog/commit/35eaa5f6aa3eade07b5f6920fe21073784f12b06) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: no new line when translating twitter in translation only mode

## 1.21.0

### Minor Changes

- [#836](https://github.com/mengxi-ream/read-frog/pull/836) [`3119bd4`](https://github.com/mengxi-ream/read-frog/commit/3119bd409bab1da2eae97e54a187fbc8a746d514) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add MiniMax AI provider support

- [#835](https://github.com/mengxi-ream/read-frog/pull/835) [`f817e81`](https://github.com/mengxi-ream/read-frog/commit/f817e81f143ecf4d8729fdea557c029c574c9c9f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add custom provider options and temperature configuration

- [#809](https://github.com/mengxi-ream/read-frog/pull/809) [`aa62e0f`](https://github.com/mengxi-ream/read-frog/commit/aa62e0f11343f4c0fdec2ca7c19d420606426567) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: implement youtube subtitles

- [#834](https://github.com/mengxi-ream/read-frog/pull/834) [`6eaaa95`](https://github.com/mengxi-ream/read-frog/commit/6eaaa958acf6b69930738b341acee882889ea715) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - ai: upgrade AI SDK from v5 to v6

### Patch Changes

- [#827](https://github.com/mengxi-ream/read-frog/pull/827) [`ab0582e`](https://github.com/mengxi-ream/read-frog/commit/ab0582efbc82c25cce8c7173ed746f776b4d8805) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: clear translation state when navigating to a new URL in the same tab

- [#825](https://github.com/mengxi-ream/read-frog/pull/825) [`e259773`](https://github.com/mengxi-ream/read-frog/commit/e259773b2f896ef650a7f8b57255a206e2187fd8) Thanks [@Yukiniro](https://github.com/Yukiniro)! - perf: don't retry when request queue fail in batch queue

- [#830](https://github.com/mengxi-ream/read-frog/pull/830) [`5ed2c53`](https://github.com/mengxi-ream/read-frog/commit/5ed2c536fcfce7b9f1e200f8dcc4e505fd9ff37d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: translation styles not applying inside website Shadow DOMs

- [#825](https://github.com/mengxi-ream/read-frog/pull/825) [`e259773`](https://github.com/mengxi-ream/read-frog/commit/e259773b2f896ef650a7f8b57255a206e2187fd8) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: fixed the thinking error of gemini 3

- [#832](https://github.com/mengxi-ream/read-frog/pull/832) [`aa32739`](https://github.com/mengxi-ream/read-frog/commit/aa32739a50175a06039bac0743e1730e362e5f18) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: re-translate page on translation mode change while active

- [#806](https://github.com/mengxi-ream/read-frog/pull/806) [`7d6465f`](https://github.com/mengxi-ream/read-frog/commit/7d6465fafbd58a5c8e9a1bb16708a27b9ed56906) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat: supports automatic toolbar positioning

## 1.20.7

### Patch Changes

- [`434068d`](https://github.com/mengxi-ream/read-frog/commit/434068d4182900ef49e97e37eb4c914bd414eea0) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - chore: add prompt sharing discussion links

- [#815](https://github.com/mengxi-ream/read-frog/pull/815) [`282a852`](https://github.com/mengxi-ream/read-frog/commit/282a8521e6225d3fd1f547093e0345b4e93c607c) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: treat last synced config as null if it is invalid to unlock sync flow

## 1.20.6

### Patch Changes

- [#813](https://github.com/mengxi-ream/read-frog/pull/813) [`a935d9d`](https://github.com/mengxi-ream/read-frog/commit/a935d9da2615e979c56c9ef515c3c575444851d0) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add export confirmation dialog for config backup items

- [#811](https://github.com/mengxi-ream/read-frog/pull/811) [`dd0a924`](https://github.com/mengxi-ream/read-frog/commit/dd0a924b65b4e915d026a5165a0fa77aee73be16) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: support page translation in iframes via programmatic injection

- [#804](https://github.com/mengxi-ream/read-frog/pull/804) [`d038ce4`](https://github.com/mengxi-ream/read-frog/commit/d038ce4d8cdf8febf96fee0203d06ed1948b0d74) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: fix the thought process in the translation of the custom model.

## 1.20.5

### Patch Changes

- [#807](https://github.com/mengxi-ream/read-frog/pull/807) [`4d98864`](https://github.com/mengxi-ream/read-frog/commit/4d98864480f0aca0791b9288072c760dc1826c12) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: refresh auth data and add email validation in Google Drive sync

## 1.20.4

### Patch Changes

- [#802](https://github.com/mengxi-ream/read-frog/pull/802) [`9de0da8`](https://github.com/mengxi-ream/read-frog/commit/9de0da8d2d055b4bb097dc26c83d598a2269d5e1) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: update model list

- [#802](https://github.com/mengxi-ream/read-frog/pull/802) [`9de0da8`](https://github.com/mengxi-ream/read-frog/commit/9de0da8d2d055b4bb097dc26c83d598a2269d5e1) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: allow fetch model list from custom providers

## 1.20.3

### Patch Changes

- [#797](https://github.com/mengxi-ream/read-frog/pull/797) [`7587b9e`](https://github.com/mengxi-ream/read-frog/commit/7587b9e3bf745b5b77a30be57a9008956900231e) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: split floating button & toolbar into collapsible overlay tools sidebar

- [#799](https://github.com/mengxi-ream/read-frog/pull/799) [`45f3097`](https://github.com/mengxi-ream/read-frog/commit/45f3097f20e00503a6428108bb0843bee3cb0988) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: add custom error type for remote config version too new during Google Drive sync

- [#797](https://github.com/mengxi-ream/read-frog/pull/797) [`7587b9e`](https://github.com/mengxi-ream/read-frog/commit/7587b9e3bf745b5b77a30be57a9008956900231e) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add floating button click action configuration

## 1.20.2

### Patch Changes

- [#793](https://github.com/mengxi-ream/read-frog/pull/793) [`20d9c1b`](https://github.com/mengxi-ream/read-frog/commit/20d9c1b3ed8012b90960ff345cb0fa1f0d647924) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: add systemPrompt to translation prompt export

- [#796](https://github.com/mengxi-ream/read-frog/pull/796) [`b6f74fc`](https://github.com/mengxi-ream/read-frog/commit/b6f74fc09d267d22a3bea5fec1053ee5428f048f) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - build: upgrade packages

- [#790](https://github.com/mengxi-ream/read-frog/pull/790) [`475417b`](https://github.com/mengxi-ream/read-frog/commit/475417bbb24d905c4c3f87c8bf59284fe56b690c) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: refine selection handling in toolbar to ensure button interactions are valid

## 1.20.1

### Patch Changes

- [#788](https://github.com/mengxi-ream/read-frog/pull/788) [`c58f3d0`](https://github.com/mengxi-ream/read-frog/commit/c58f3d08f20067265b4ee7b957a071b66d43e8b3) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: separate Google Drive remote storage functions into dedicated module

- [#780](https://github.com/mengxi-ream/read-frog/pull/780) [`eb82c74`](https://github.com/mengxi-ream/read-frog/commit/eb82c740ab4bef83ead54cbeb3ea90fee1c1bf10) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: fix Google Drive sync with last synced config schema version tracking

- [#781](https://github.com/mengxi-ream/read-frog/pull/781) [`d3bb1a1`](https://github.com/mengxi-ream/read-frog/commit/d3bb1a1c6de340c15d8de1a189d32e7f3a84e5f5) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat: support logout for google drive sync

## 1.20.0

### Minor Changes

- [#726](https://github.com/mengxi-ream/read-frog/pull/726) [`c53e931`](https://github.com/mengxi-ream/read-frog/commit/c53e9318e001ff289f3986c7305b39fe2b58a00c) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat: supports google drive configuration synchronization

### Patch Changes

- [#775](https://github.com/mengxi-ream/read-frog/pull/775) [`cb83fca`](https://github.com/mengxi-ream/read-frog/commit/cb83fca369c441915509893c6f52f82355fb79c2) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - style: clean up field description into hint of translation config

- [#775](https://github.com/mengxi-ream/read-frog/pull/775) [`cb83fca`](https://github.com/mengxi-ream/read-frog/commit/cb83fca369c441915509893c6f52f82355fb79c2) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: support preload config

- [#777](https://github.com/mengxi-ream/read-frog/pull/777) [`1fddcc7`](https://github.com/mengxi-ream/read-frog/commit/1fddcc74b9bb35b867f0aee7f3bc080a7ac58355) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: move detectedCode from config to separate storage location

## 1.19.4

### Patch Changes

- [#771](https://github.com/mengxi-ream/read-frog/pull/771) [`57dcc81`](https://github.com/mengxi-ream/read-frog/commit/57dcc81b5d7ca84438f1bbfcbc671faf785cb79c) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - perf: improve prompt to auto detect language

- [#761](https://github.com/mengxi-ream/read-frog/pull/761) [`2d4bf6c`](https://github.com/mengxi-ream/read-frog/commit/2d4bf6c11b05d43319c48497445ebf817f63baac) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add engoo.com force block translation rule

- [#772](https://github.com/mengxi-ream/read-frog/pull/772) [`f8de893`](https://github.com/mengxi-ream/read-frog/commit/f8de893a51ec37a5805a51c22ec15f7f9fbd2244) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add official volcengine and doubao support

## 1.19.3

### Patch Changes

- [#758](https://github.com/mengxi-ream/read-frog/pull/758) [`c444ef7`](https://github.com/mengxi-ream/read-frog/commit/c444ef73db58a6de0f6eeff93b04b3e5ae9f509d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add site-specific force block translation support

## 1.19.2

### Patch Changes

- [#755](https://github.com/mengxi-ream/read-frog/pull/755) [`e5b8efa`](https://github.com/mengxi-ream/read-frog/commit/e5b8efa086479e4b23d59f8bb175259e98269905) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: exclude detectedCode from translation cache hash

- [#757](https://github.com/mengxi-ream/read-frog/pull/757) [`67502f5`](https://github.com/mengxi-ream/read-frog/commit/67502f54198a0218240b227193728213529e9ec8) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: filter don't walk into and don't translate as child elements in unwrapDeepestOnlyHTMLChild function

- [#757](https://github.com/mengxi-ream/read-frog/pull/757) [`67502f5`](https://github.com/mengxi-ream/read-frog/commit/67502f54198a0218240b227193728213529e9ec8) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: variable shadowing bug in translateWalkedElement that caused async translation promises to not be awaited

## 1.19.1

### Patch Changes

- [#752](https://github.com/mengxi-ream/read-frog/pull/752) [`d3db08c`](https://github.com/mengxi-ream/read-frog/commit/d3db08c684372b7b72402e88150f257b55091292) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: skip aria-hidden elements in translation traversal

- [#749](https://github.com/mengxi-ream/read-frog/pull/749) [`25de809`](https://github.com/mengxi-ream/read-frog/commit/25de8095a717b332c3c9bfd73c1fcd81bf769d25) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add rate us option to popup menu and options sidebar

## 1.19.0

### Minor Changes

- [#718](https://github.com/mengxi-ream/read-frog/pull/718) [`1205620`](https://github.com/mengxi-ream/read-frog/commit/120562069ac2b3a47051677b6b6b0cc3db010318) Thanks [@guoyongchang](https://github.com/guoyongchang)! - feat: add context menu translate option

  Add right-click context menu option for translating pages directly from the browser context menu.

  **Important**: This feature requires a new `contextMenus` permission. When upgrading, your browser may prompt you to approve this new permission and temporarily disable the extension until approved. This is normal browser behavior for permission changes.

### Patch Changes

- [#747](https://github.com/mengxi-ream/read-frog/pull/747) [`8844a84`](https://github.com/mengxi-ream/read-frog/commit/8844a848445bc21af1ca73571440f5f073410cf7) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - style: update shadcn ghost color

- [#747](https://github.com/mengxi-ream/read-frog/pull/747) [`4f76f7b`](https://github.com/mengxi-ream/read-frog/commit/4f76f7b9c8a6507b352e9a8b7ad92ad5ea9b4289) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - style: change more menu icons

## 1.18.1

### Patch Changes

- [`1859c74`](https://github.com/mengxi-ream/read-frog/commit/1859c743d2b1791f20f1639c652649529795fb5f) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - style: llm status indicator color

- [`90001a9`](https://github.com/mengxi-ream/read-frog/commit/90001a9d883e6400ab6d1066057cea6099f2d880) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - i18n: update i18n for custom translation style

- [#742](https://github.com/mengxi-ream/read-frog/pull/742) [`ed8f173`](https://github.com/mengxi-ream/read-frog/commit/ed8f173905d8bc449fb1c28fd571c7011accfbe0) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - style: extension style upgrade

- [#741](https://github.com/mengxi-ream/read-frog/pull/741) [`51d3054`](https://github.com/mengxi-ream/read-frog/commit/51d3054c3a31242c287dff1ec303f1b19bb3538f) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - style: update custom prompt sheet

## 1.18.0

### Minor Changes

- [#735](https://github.com/mengxi-ream/read-frog/pull/735) [`30db212`](https://github.com/mengxi-ream/read-frog/commit/30db2125fc9e6d7f1d32da4082c0d0038afc20e9) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add AI smart context translation for improved translation accuracy

- [#739](https://github.com/mengxi-ream/read-frog/pull/739) [`f1fd0c5`](https://github.com/mengxi-ream/read-frog/commit/f1fd0c5bbab49ceaf6a28d6367816603a863fa86) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add system prompt support and improve prompt for batching

### Patch Changes

- [#738](https://github.com/mengxi-ream/read-frog/pull/738) [`6dce9e1`](https://github.com/mengxi-ream/read-frog/commit/6dce9e1fd26898ef3ff9d38939f14e147cc16120) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - chore: change default translation node style to 'textColor' for new installs

- [#738](https://github.com/mengxi-ream/read-frog/pull/738) [`6dce9e1`](https://github.com/mengxi-ream/read-frog/commit/6dce9e1fd26898ef3ff9d38939f14e147cc16120) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: detect source language before translation to skip if already in target language

- [#719](https://github.com/mengxi-ream/read-frog/pull/719) [`2fafa2a`](https://github.com/mengxi-ream/read-frog/commit/2fafa2add6ab63bcc00a1cff1e7f982d29a297d3) Thanks [@lisongkun](https://github.com/lisongkun)! - fix: domain patterns matching logic

- [#738](https://github.com/mengxi-ream/read-frog/pull/738) [`6dce9e1`](https://github.com/mengxi-ream/read-frog/commit/6dce9e1fd26898ef3ff9d38939f14e147cc16120) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: add fallback values for empty title/summary in translation prompts

## 1.17.3

### Patch Changes

- [#730](https://github.com/mengxi-ream/read-frog/pull/730) [`f06a62c`](https://github.com/mengxi-ream/read-frog/commit/f06a62c78a1dcb61a80584b2814e1c3321c8f48f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add LLM language detection toggle with provider status indicator

- [#727](https://github.com/mengxi-ream/read-frog/pull/727) [`2f1cd26`](https://github.com/mengxi-ream/read-frog/commit/2f1cd265c790cffa3e3e992c221143abf4c57781) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add superRefine validation for custom prompt configuration integrity

- [#727](https://github.com/mengxi-ream/read-frog/pull/727) [`2f1cd26`](https://github.com/mengxi-ream/read-frog/commit/2f1cd265c790cffa3e3e992c221143abf4c57781) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: nx config for proper build caching

- [#727](https://github.com/mengxi-ream/read-frog/pull/727) [`2f1cd26`](https://github.com/mengxi-ream/read-frog/commit/2f1cd265c790cffa3e3e992c221143abf4c57781) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: add prompt into translation hash to invalidate cache when prompt changes

- [#730](https://github.com/mengxi-ream/read-frog/pull/730) [`f06a62c`](https://github.com/mengxi-ream/read-frog/commit/f06a62c78a1dcb61a80584b2814e1c3321c8f48f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: spinner style not correct on some page

- [#727](https://github.com/mengxi-ream/read-frog/pull/727) [`2f1cd26`](https://github.com/mengxi-ream/read-frog/commit/2f1cd265c790cffa3e3e992c221143abf4c57781) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: default prompts no longer stored in storage, only custom prompts persist

- [#727](https://github.com/mengxi-ream/read-frog/pull/727) [`2f1cd26`](https://github.com/mengxi-ream/read-frog/commit/2f1cd265c790cffa3e3e992c221143abf4c57781) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: rename promptsConfig to customPromptsConfig and prompt to promptId for clarity

## 1.17.2

### Patch Changes

- [#723](https://github.com/mengxi-ream/read-frog/pull/723) [`4808a82`](https://github.com/mengxi-ream/read-frog/commit/4808a8295c72af9915703015f589edbe9785fd7f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: skip empty nodes in translation traversal to fix Inoreader style issue

- [#721](https://github.com/mengxi-ream/read-frog/pull/721) [`265e2c7`](https://github.com/mengxi-ream/read-frog/commit/265e2c73ac195beb47192ac1627ef27c5b0e467d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: add ts-reset to fix array.includes type narrowing

## 1.17.1

### Patch Changes

- [`f6d9b3a`](https://github.com/mengxi-ream/read-frog/commit/f6d9b3a503d589ebd304808e5d9520d828394016) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: ollama connection test button style

## 1.17.0

### Minor Changes

- [#713](https://github.com/mengxi-ream/read-frog/pull/713) [`49b33cc`](https://github.com/mengxi-ream/read-frog/commit/49b33ccf694903efcde720cae29fc52f3af0620b) Thanks [@taiiiyang](https://github.com/taiiiyang)! - refactor: make the backend part of the package private and extract the extension separately.

### Patch Changes

- [#715](https://github.com/mengxi-ream/read-frog/pull/715) [`4d2eb83`](https://github.com/mengxi-ream/read-frog/commit/4d2eb83cb0df409fbfa02d2d45236db1101a3a86) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: custom translation style preview not matching actual behavior

- [#713](https://github.com/mengxi-ream/read-frog/pull/713) [`49b33cc`](https://github.com/mengxi-ream/read-frog/commit/49b33ccf694903efcde720cae29fc52f3af0620b) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: race condition of dom batch operation

## 1.16.2

### Patch Changes

- [#686](https://github.com/mengxi-ream/read-frog/pull/686) [`e727b97`](https://github.com/mengxi-ream/read-frog/commit/e727b9758b6f64ad61d6a9fbdc85b6d0af41b211) Thanks [@darmau](https://github.com/darmau)! - feat: rtl languages support.

- [#690](https://github.com/mengxi-ream/read-frog/pull/690) [`377280a`](https://github.com/mengxi-ream/read-frog/commit/377280a12010fb1a91d1d519081e8b3134ccc968) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - perf: batch insert translation wrapper to improve page translation performance

- [#691](https://github.com/mengxi-ream/read-frog/pull/691) [`b281c14`](https://github.com/mengxi-ream/read-frog/commit/b281c1497d7ba580b74737fbabeae1a8c24c2dc7) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - style: apply font families to translated content wrapper and all children elements

## 1.16.1

### Patch Changes

- [#683](https://github.com/mengxi-ream/read-frog/pull/683) [`d97b6ba`](https://github.com/mengxi-ream/read-frog/commit/d97b6ba741618d689ad6fe37bee33d68e1d78957) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): improve select-all behavior to support shadow roots and external apps like Excalidraw

- [#669](https://github.com/mengxi-ream/read-frog/pull/669) [`aee1847`](https://github.com/mengxi-ream/read-frog/commit/aee18477edb4ed7f1bf7d8375801fc5e1ba3c276) Thanks [@darmau](https://github.com/darmau)! - style: set proper font-family for Japanese and Chinese translation, in order to render the right kanjis.

- [#681](https://github.com/mengxi-ream/read-frog/pull/681) [`bfba497`](https://github.com/mengxi-ream/read-frog/commit/bfba497167aaa6bf9339d8f44d733e0868b0d8a2) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - chore: test changeset

## 1.16.0

### Minor Changes

- [#663](https://github.com/mengxi-ream/read-frog/pull/663) [`580549d`](https://github.com/mengxi-ream/read-frog/commit/580549d57226c86825fcc04e58cc92b75a0fd600) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: user can define custom translation css style

### Patch Changes

- [#667](https://github.com/mengxi-ream/read-frog/pull/667) [`4efa7f0`](https://github.com/mengxi-ream/read-frog/commit/4efa7f019825f0b141c7b16c210199b53835d6e4) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - style: refactor Field component usage for consistent responsive layout

- [#659](https://github.com/mengxi-ream/read-frog/pull/659) [`4c19aa9`](https://github.com/mengxi-ream/read-frog/commit/4c19aa9f37075306aeecb9aaf29628f2fa3a5eb1) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: allow jump to specific blog from notification

- [#666](https://github.com/mengxi-ream/read-frog/pull/666) [`e040a4e`](https://github.com/mengxi-ream/read-frog/commit/e040a4ed8a065c9c022abafbfac9abd8f027468f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: move version comparison logic to backend

- [#665](https://github.com/mengxi-ream/read-frog/pull/665) [`4e22813`](https://github.com/mengxi-ream/read-frog/commit/4e228132e71589e1c9d721f9ae856dbc97eff907) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: more powerful css for translation style

- [#664](https://github.com/mengxi-ream/read-frog/pull/664) [`d7b6ec8`](https://github.com/mengxi-ream/read-frog/commit/d7b6ec83849796a870257b4be897b1280c5866ce) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add translation mode selector to popup

## 1.15.2

### Patch Changes

- [#653](https://github.com/mengxi-ream/read-frog/pull/653) [`b20c83a`](https://github.com/mengxi-ream/read-frog/commit/b20c83ad84b2d7c12cc57b025c879e897e75f5f0) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - build: upgrade deps

- [#655](https://github.com/mengxi-ream/read-frog/pull/655) [`27a1346`](https://github.com/mengxi-ream/read-frog/commit/27a13463fff3f0ad0f75659770ae08aa808785f5) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: resolve CSS property conflicts with host pages

## 1.15.1

### Patch Changes

- [#649](https://github.com/mengxi-ream/read-frog/pull/649) [`ba7bc35`](https://github.com/mengxi-ream/read-frog/commit/ba7bc3535dec4fbe67eb5c7a80493a1cccaeff5f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - docs(extension): add descriptions to provider groups in add provider dialog

- [#648](https://github.com/mengxi-ream/read-frog/pull/648) [`087104c`](https://github.com/mengxi-ream/read-frog/commit/087104c02f04ba68a85c9007555cca8b57c8d78f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add node translation shortcut setting on option page

- [#650](https://github.com/mengxi-ream/read-frog/pull/650) [`052c34e`](https://github.com/mengxi-ream/read-frog/commit/052c34e8a2dd11ef7dbe096587ebe6dca188640f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): prevent translation of MathML elements and improve academic content handling

- [#647](https://github.com/mengxi-ream/read-frog/pull/647) [`ab99603`](https://github.com/mengxi-ream/read-frog/commit/ab99603244baf5f08eb81cb3fbaf7cecd73a6ad8) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: prevent node translation trigger with key combinations

- [#651](https://github.com/mengxi-ream/read-frog/pull/651) [`637c7ea`](https://github.com/mengxi-ream/read-frog/commit/637c7ea8b94bdf7819b5e1a9ed8928f006c3e7db) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): prevent double translation on Reddit and improve translation performance

- [#645](https://github.com/mengxi-ream/read-frog/pull/645) [`a9b79e3`](https://github.com/mengxi-ream/read-frog/commit/a9b79e3b6184f58291ecc47d4c623646af95954a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: move auto-translate shortcut to page config

## 1.15.0

### Minor Changes

- [#633](https://github.com/mengxi-ream/read-frog/pull/633) [`58529e1`](https://github.com/mengxi-ream/read-frog/commit/58529e1adf55c5f0e876e278b8aeac7cc4187348) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat(extension): integrate statistics page on options

### Patch Changes

- [#638](https://github.com/mengxi-ream/read-frog/pull/638) [`93c78a0`](https://github.com/mengxi-ream/read-frog/commit/93c78a0a9b4e0b5b0cafdc58f767053e1834a036) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat(extension): support disabling selection-toolbar for specific websites

- [#634](https://github.com/mengxi-ream/read-frog/pull/634) [`2d39087`](https://github.com/mengxi-ream/read-frog/commit/2d390876641036cd5537e0287c896d894a39282a) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: disable floating button or selection toolbar in option page

## 1.14.1

### Patch Changes

- [#628](https://github.com/mengxi-ream/read-frog/pull/628) [`b28efbd`](https://github.com/mengxi-ream/read-frog/commit/b28efbd86f7cece91920fd75cc96e141dfe866e9) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor(extension): use React Activity API for model selector state preservation

## 1.14.0

### Minor Changes

- [#582](https://github.com/mengxi-ream/read-frog/pull/582) [`ab2aedb`](https://github.com/mengxi-ream/read-frog/commit/ab2aedb9ea8730c424b36e945b9d51082d71e55b) Thanks [@darmau](https://github.com/darmau)! - feat: refine AI Button prompt structure to ensure more consistent responses

- [#623](https://github.com/mengxi-ream/read-frog/pull/623) [`9f640c2`](https://github.com/mengxi-ream/read-frog/commit/9f640c2727219fecd7e21c14c5f3cf9cb109039d) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add config backup feature

### Patch Changes

- [#625](https://github.com/mengxi-ream/read-frog/pull/625) [`ebfa592`](https://github.com/mengxi-ream/read-frog/commit/ebfa592703c5899e8d26c04c2e9c81e92b9b9677) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: extract RestoreButton and use ButtonGroup component

- [#627](https://github.com/mengxi-ream/read-frog/pull/627) [`519b5aa`](https://github.com/mengxi-ream/read-frog/commit/519b5aaf172f4ae06e31909f5d59d53ce0267495) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor(extension): use session storage for translation state persistence

  Replace in-memory Map with chrome.storage.session to ensure translation state survives service worker restarts. Simplifies architecture by removing port-based communication.

- [#626](https://github.com/mengxi-ream/read-frog/pull/626) [`e3c015a`](https://github.com/mengxi-ream/read-frog/commit/e3c015aaabef21a11243c730329388b4f1ac4e2d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat(extension): update Gemini model defaults and remove deprecated models

## 1.13.4

### Patch Changes

- [#614](https://github.com/mengxi-ream/read-frog/pull/614) [`96b04ea`](https://github.com/mengxi-ream/read-frog/commit/96b04eaef4145c18f90a9f913e008dfbaf5d6916) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix(extension): improve floating element detection for large initial letters

- [#617](https://github.com/mengxi-ream/read-frog/pull/617) [`0dbdac8`](https://github.com/mengxi-ream/read-frog/commit/0dbdac871256b5d0d556778bbec6c0719aa01202) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add more custom translation style

- [#615](https://github.com/mengxi-ream/read-frog/pull/615) [`a0197ff`](https://github.com/mengxi-ream/read-frog/commit/a0197fffe547966951cbc6ea00e6970b2deb1e6f) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - chore: change default shortcut based on feedback

- [#618](https://github.com/mengxi-ream/read-frog/pull/618) [`421e9ab`](https://github.com/mengxi-ream/read-frog/commit/421e9ab9d92e2de5e13a059beb4052effff4a4e6) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix(extension): disable Google provider in translation-only mode

- [#575](https://github.com/mengxi-ream/read-frog/pull/575) [`46dffff`](https://github.com/mengxi-ream/read-frog/commit/46dffff835991df95e3b2dbf490f0fc4cbb3d36a) Thanks [@mercutiojohn](https://github.com/mercutiojohn)! - feat(extension): improve prompt settings UX with enhanced export mode and radio group selection

## 1.13.3

### Patch Changes

- [#607](https://github.com/mengxi-ream/read-frog/pull/607) [`ab44be5`](https://github.com/mengxi-ream/read-frog/commit/ab44be5644160bd5cbf28786c1b27932de1c0dc6) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): set tts providerId to null in migration and fix selector placeholder

## 1.13.2

### Patch Changes

- [#606](https://github.com/mengxi-ream/read-frog/pull/606) [`e9f6cd3`](https://github.com/mengxi-ream/read-frog/commit/e9f6cd37167c8ebc61deb1b9d48f6409427c1ada) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): prevent selection popup from being translated

## 1.13.1

### Patch Changes

- [#594](https://github.com/mengxi-ream/read-frog/pull/594) [`179ee34`](https://github.com/mengxi-ream/read-frog/commit/179ee34f6000624c745dd600fde2c8098bca0042) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): translation style for flex parent containers

## 1.13.0

### Minor Changes

- [#570](https://github.com/mengxi-ream/read-frog/pull/570) [`1e4e269`](https://github.com/mengxi-ream/read-frog/commit/1e4e269a3c9203c7b2dd2fd0fc8df7275e0d87d2) Thanks [@darmau](https://github.com/darmau)! - feat(extension): add text-to-speech feature for selection toolbar

### Patch Changes

- [#586](https://github.com/mengxi-ream/read-frog/pull/586) [`a74666e`](https://github.com/mengxi-ream/read-frog/commit/a74666e5882b1a9f7edb9e6d18ffd22950031e2e) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix(extension): update custom translation node styles for blockquote and dashed line

- [#584](https://github.com/mengxi-ream/read-frog/pull/584) [`0bcf449`](https://github.com/mengxi-ream/read-frog/commit/0bcf449edffad09f5967f13bdcbf9851db69ff90) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: don't translate code in pre tags

- [#592](https://github.com/mengxi-ream/read-frog/pull/592) [`ae89107`](https://github.com/mengxi-ream/read-frog/commit/ae891071c86298953ca1f0b598d51ebe6eb60208) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: update DeepLX default API URL

- [#586](https://github.com/mengxi-ream/read-frog/pull/586) [`a74666e`](https://github.com/mengxi-ream/read-frog/commit/a74666e5882b1a9f7edb9e6d18ffd22950031e2e) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: style of block node with inline and block children

- [#588](https://github.com/mengxi-ream/read-frog/pull/588) [`f3eed7f`](https://github.com/mengxi-ream/read-frog/commit/f3eed7f85f073ac3ff9869c581dc13daa3e4ddbc) Thanks [@Yukiniro](https://github.com/Yukiniro)! - refactor: support Activity component

## 1.12.1

### Patch Changes

- [#577](https://github.com/mengxi-ream/read-frog/pull/577) [`5fcf03c`](https://github.com/mengxi-ream/read-frog/commit/5fcf03cacbe34871d8d4764c0e27d31cd2bf6b17) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix(extension): fixed behavior when interactive and focus elements differ

- [#580](https://github.com/mengxi-ream/read-frog/pull/580) [`6a1b26a`](https://github.com/mengxi-ream/read-frog/commit/6a1b26a48cb20e3814930a3dcb323946dae4a811) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: forceBlock logic to translate blocks inside inline node

## 1.12.0

### Minor Changes

- [#573](https://github.com/mengxi-ream/read-frog/pull/573) [`f0565e6`](https://github.com/mengxi-ream/read-frog/commit/f0565e6c64d8cf9dbf84caa9b9de39a108b4797c) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat(extension): add survey notification and sidebar i18n support

## 1.11.1

### Patch Changes

- [#572](https://github.com/mengxi-ream/read-frog/pull/572) [`edd167a`](https://github.com/mengxi-ream/read-frog/commit/edd167afe5fb7e4360a9189f538eed441a169d30) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(style): noc header tailwind css for fumadocs

- [#568](https://github.com/mengxi-ream/read-frog/pull/568) [`3b5c37e`](https://github.com/mengxi-ream/read-frog/commit/3b5c37e972e055837f4d729d532664bad1cb6c13) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: add extension version check for blog notifications

## 1.11.0

### Minor Changes

- [#566](https://github.com/mengxi-ream/read-frog/pull/566) [`184d644`](https://github.com/mengxi-ream/read-frog/commit/184d6443062dbf9828fd5f3c29aae020e260b949) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add blog notification indicator for new posts

- [#548](https://github.com/mengxi-ream/read-frog/pull/548) [`ec5b305`](https://github.com/mengxi-ream/read-frog/commit/ec5b305579ee8b16dc1e14e4ebc3a086d4914612) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat(extension): support for batch translation for LLM

### Patch Changes

- [#562](https://github.com/mengxi-ream/read-frog/pull/562) [`73198f6`](https://github.com/mengxi-ream/read-frog/commit/73198f6d2c3dbb03af2a39d97886715f5d27c58d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): hide batch translation behind beta flag

## 1.10.10

### Patch Changes

- [#550](https://github.com/mengxi-ream/read-frog/pull/550) [`a1a6e85`](https://github.com/mengxi-ream/read-frog/commit/a1a6e8516e9cf5c171c8e404578a45f830307c1d) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - docs: add provider config docs

- [#554](https://github.com/mengxi-ream/read-frog/pull/554) [`1cfa6f9`](https://github.com/mengxi-ream/read-frog/commit/1cfa6f91675bce063e7cc74d18f54098eb689f79) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: change default shortcut for translation

- [#558](https://github.com/mengxi-ream/read-frog/pull/558) [`910bc4e`](https://github.com/mengxi-ream/read-frog/commit/910bc4ebaa80a335ec0f1f6f7fab33887971efb5) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - perf: anthropic translation thinking mode disabled

- [#558](https://github.com/mengxi-ream/read-frog/pull/558) [`910bc4e`](https://github.com/mengxi-ream/read-frog/commit/910bc4ebaa80a335ec0f1f6f7fab33887971efb5) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: anthropic api cors bug

- [#550](https://github.com/mengxi-ream/read-frog/pull/550) [`a1a6e85`](https://github.com/mengxi-ream/read-frog/commit/a1a6e8516e9cf5c171c8e404578a45f830307c1d) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: update model for tensdaq

## 1.10.9

### Patch Changes

- [#545](https://github.com/mengxi-ream/read-frog/pull/545) [`0da1d19`](https://github.com/mengxi-ream/read-frog/commit/0da1d19b0cdcda9c45cf58c53d86f6e766c1726b) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: ollama stream text and detect api key logic

- [#535](https://github.com/mengxi-ream/read-frog/pull/535) [`3c711ee`](https://github.com/mengxi-ream/read-frog/commit/3c711eebc99d90ca8bef679b942699a9bae50114) Thanks [@sedationh](https://github.com/sedationh)! - fix: enhance extractTextContext to handle edge cases in text selection

- [#546](https://github.com/mengxi-ream/read-frog/pull/546) [`a94f20e`](https://github.com/mengxi-ream/read-frog/commit/a94f20ec4d85b895856c4171b2ae3dcce0a96f23) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - perf: don't translte numbers

## 1.10.8

### Patch Changes

- [#536](https://github.com/mengxi-ream/read-frog/pull/536) [`8e61c09`](https://github.com/mengxi-ream/read-frog/commit/8e61c098ec32906655f03050eedab8c564f5b4d7) Thanks [@sedationh](https://github.com/sedationh)! - feat: add beta experience configuration and UI component

- [#541](https://github.com/mengxi-ream/read-frog/pull/541) [`f7eb724`](https://github.com/mengxi-ream/read-frog/commit/f7eb7246b8ce5f16ce305bc0bdd6d031cbbee500) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add ollama provider

- [#539](https://github.com/mengxi-ream/read-frog/pull/539) [`3625a9b`](https://github.com/mengxi-ream/read-frog/commit/3625a9b331a3e4be0c9ee4da2ecdd50aa59fea57) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: rename openai compatible provider to custom provider

- [#496](https://github.com/mengxi-ream/read-frog/pull/496) [`3908f22`](https://github.com/mengxi-ream/read-frog/commit/3908f2207334865451226c62ca2335ce734b3571) Thanks [@sedationh](https://github.com/sedationh)! - feat: implement context extraction for selected text in AI popover

- [#532](https://github.com/mengxi-ream/read-frog/pull/532) [`48fd692`](https://github.com/mengxi-ream/read-frog/commit/48fd692aece40504fb8102ebfc83af02aef44176) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: treat inline node with only one block node child as inline node

## 1.10.7

### Patch Changes

- [#528](https://github.com/mengxi-ream/read-frog/pull/528) [`39dd45b`](https://github.com/mengxi-ream/read-frog/commit/39dd45b08ac45570d0b9929fd3a1dc6e27bd30ce) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add openrouter provider

## 1.10.6

### Patch Changes

- [#521](https://github.com/mengxi-ream/read-frog/pull/521) [`1234914`](https://github.com/mengxi-ream/read-frog/commit/1234914daa19e3758648fd818d31590de01351d3) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): replace guest avatar PNG with SVG and add padding

- [#523](https://github.com/mengxi-ream/read-frog/pull/523) [`9e36470`](https://github.com/mengxi-ream/read-frog/commit/9e3647087e5aa680fa55d2f0f6cc197747f41c59) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - style: add hover background to hotkey selector in popup

## 1.10.5

### Patch Changes

- [#516](https://github.com/mengxi-ream/read-frog/pull/516) [`1884fb0`](https://github.com/mengxi-ream/read-frog/commit/1884fb0e3f057006464e8ae88754229c309da40b) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: complete the hash key for translation

- [#515](https://github.com/mengxi-ream/read-frog/pull/515) [`81b0183`](https://github.com/mengxi-ream/read-frog/commit/81b018330134e3c552302fc1bdf9e9e2f6d91e4a) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: crash when delete the first provider

- [#516](https://github.com/mengxi-ream/read-frog/pull/516) [`1884fb0`](https://github.com/mengxi-ream/read-frog/commit/1884fb0e3f057006464e8ae88754229c309da40b) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: translate code inside a paragraph

## 1.10.4

### Patch Changes

- [#512](https://github.com/mengxi-ream/read-frog/pull/512) [`ea6e1a7`](https://github.com/mengxi-ream/read-frog/commit/ea6e1a7b97f6f92737f12d0e37c7aab6799009bf) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add churn feedback survey

## 1.10.3

### Patch Changes

- [#509](https://github.com/mengxi-ream/read-frog/pull/509) [`6928f28`](https://github.com/mengxi-ream/read-frog/commit/6928f28060107cdb4f9fe91718b30e818f535e5f) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: provider selector in side content

## 1.10.2

### Patch Changes

- [#506](https://github.com/mengxi-ream/read-frog/pull/506) [`5eff186`](https://github.com/mengxi-ream/read-frog/commit/5eff186707bad1aaf681cd871deb965a01e1368d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: static import migrations in service worker

- [#508](https://github.com/mengxi-ream/read-frog/pull/508) [`bf0b7cd`](https://github.com/mengxi-ream/read-frog/commit/bf0b7cd0178758706c2e98f7f25e23e6de59e310) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add tensdaq provider

## 1.10.1

### Patch Changes

- [#504](https://github.com/mengxi-ream/read-frog/pull/504) [`d48a78d`](https://github.com/mengxi-ream/read-frog/commit/d48a78d966d3f72a19f765035ee1b9f4e706c1d9) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - chore: add 302 ai to default

## 1.10.0

### Minor Changes

- [#481](https://github.com/mengxi-ream/read-frog/pull/481) [`2d9c9a8`](https://github.com/mengxi-ream/read-frog/commit/2d9c9a82cd47a46bf1d6b4664c360e400070c05e) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: provider option add name, description and enabled settings

- [#492](https://github.com/mengxi-ream/read-frog/pull/492) [`b18e189`](https://github.com/mengxi-ream/read-frog/commit/b18e1891d1ce5e4236922bd9a55b42adbf620593) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add over 20 more llm providers

### Patch Changes

- [#491](https://github.com/mengxi-ream/read-frog/pull/491) [`e3639c2`](https://github.com/mengxi-ream/read-frog/commit/e3639c2562e674ca269a311446a70d4299d89610) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: automatic translation not working correctly

- [#478](https://github.com/mengxi-ream/read-frog/pull/478) [`cf71fa2`](https://github.com/mengxi-ream/read-frog/commit/cf71fa2b070def91518c3df88cbc825485f3d6ea) Thanks [@Yukiniro](https://github.com/Yukiniro)! - refactor: change export type to `esm` and use `js-sha256` replace `crypto-js`

- [#488](https://github.com/mengxi-ream/read-frog/pull/488) [`4686166`](https://github.com/mengxi-ream/read-frog/commit/468616630ee607c707c3a6e06ab77b5bdfbce97f) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - test: have to test every migration script

- [#501](https://github.com/mengxi-ream/read-frog/pull/501) [`1d0ca69`](https://github.com/mengxi-ream/read-frog/commit/1d0ca690ebdc20fc0bf9a84467b083e6ca2b1cfb) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: config being reset to the previous version on edge browser

- [#497](https://github.com/mengxi-ream/read-frog/pull/497) [`f2b74ac`](https://github.com/mengxi-ream/read-frog/commit/f2b74acc035c7bd39af9c97e63dbb3c4ccc2cc89) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: increase disable menu z-index to prevent overlay issue

- [#487](https://github.com/mengxi-ream/read-frog/pull/487) [`2ac5771`](https://github.com/mengxi-ream/read-frog/commit/2ac5771bc9886b3e97de56e3c63fc61ceda61e03) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: no error component after bilingual translation error

- [#482](https://github.com/mengxi-ream/read-frog/pull/482) [`afbd4be`](https://github.com/mengxi-ream/read-frog/commit/afbd4bed8311453297b01d2dbb6f4ad59e019e73) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - style: update select language cells hover color

- [#493](https://github.com/mengxi-ream/read-frog/pull/493) [`dd72ab4`](https://github.com/mengxi-ream/read-frog/commit/dd72ab475f0fa26581a0cac39e8e77934d57be58) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: choose right read or translate provider when delete the previous one

- [#486](https://github.com/mengxi-ream/read-frog/pull/486) [`f20fb67`](https://github.com/mengxi-ream/read-frog/commit/f20fb6769a9e02e6f1dfb145300e4107261398d7) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: translate dom with translate attribute no"

## 1.9.1

### Patch Changes

- [`e0e3be5`](https://github.com/mengxi-ream/read-frog/commit/e0e3be5d531f7edbe6a22e0ca7884b7372b2e0b2) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: remove ai button since the feature is not completed

## 1.9.0

### Minor Changes

- [#463](https://github.com/mengxi-ream/read-frog/pull/463) [`5bbe29e`](https://github.com/mengxi-ream/read-frog/commit/5bbe29e31fe81fe180ba105ca369a7d48986a5cd) Thanks [@sedationh](https://github.com/sedationh)! - feat: add drag feature

- [#450](https://github.com/mengxi-ream/read-frog/pull/450) [`b87fa03`](https://github.com/mengxi-ream/read-frog/commit/b87fa03cc01b504aaa861bcb4cf8b52036d44196) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - refactor: allow arbitraty number of providers

### Patch Changes

- [#458](https://github.com/mengxi-ream/read-frog/pull/458) [`f028439`](https://github.com/mengxi-ream/read-frog/commit/f028439105ecdbb2ce8f8cd9a6b1e06d04c0395f) Thanks [@sedationh](https://github.com/sedationh)! - feat: optimize selection-toolbar popup logic

- [#471](https://github.com/mengxi-ream/read-frog/pull/471) [`d4512ec`](https://github.com/mengxi-ream/read-frog/commit/d4512ecfb8539daba05592cca1b8d6b898de5444) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: implement force don't walk element

- [#464](https://github.com/mengxi-ream/read-frog/pull/464) [`f08001f`](https://github.com/mengxi-ream/read-frog/commit/f08001f3e9c0bf51d7055f68eadcbfa670b1d618) Thanks [@Yukiniro](https://github.com/Yukiniro)! - refactor: use `deepmerge-ts` to replace `deepmerge`

- [#454](https://github.com/mengxi-ream/read-frog/pull/454) [`ee76a28`](https://github.com/mengxi-ream/read-frog/commit/ee76a287f7fb4007269747e45a9779ed1939c4f8) Thanks [@taiiiyang](https://github.com/taiiiyang)! - style: improve button interaction

- [#474](https://github.com/mengxi-ream/read-frog/pull/474) [`d4f1d80`](https://github.com/mengxi-ream/read-frog/commit/d4f1d8061d7953badb1f892d8fe06baef15b4ba3) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - test: add more config test and test series

- [#460](https://github.com/mengxi-ream/read-frog/pull/460) [`9de7995`](https://github.com/mengxi-ream/read-frog/commit/9de7995e1b260bf36a8bae4a6923d3a8f40d17ed) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - refactor: migrate provider logos from images to CDN

- [#463](https://github.com/mengxi-ream/read-frog/pull/463) [`5bbe29e`](https://github.com/mengxi-ream/read-frog/commit/5bbe29e31fe81fe180ba105ca369a7d48986a5cd) Thanks [@sedationh](https://github.com/sedationh)! - feat: add ai button popover

- [#448](https://github.com/mengxi-ream/read-frog/pull/448) [`e83cead`](https://github.com/mengxi-ream/read-frog/commit/e83cead4eb4f6cb49fe79272dfbbdaa6e6be8ead) Thanks [@Yukiniro](https://github.com/Yukiniro)! - fix: use color-scheme to support native components

- [#468](https://github.com/mengxi-ream/read-frog/pull/468) [`2876ea8`](https://github.com/mengxi-ream/read-frog/commit/2876ea8b56d405b27ac34f3dbfa26c685e64d445) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: don't translate some element which should not be walked

- [#469](https://github.com/mengxi-ream/read-frog/pull/469) [`6fc357c`](https://github.com/mengxi-ream/read-frog/commit/6fc357c84b03cf35bb0779a7ef18d124ff6da326) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: translate bug for text with spaces

## 1.8.0

### Minor Changes

- [#436](https://github.com/mengxi-ream/read-frog/pull/436) [`4e90344`](https://github.com/mengxi-ream/read-frog/commit/4e903444ac47528f14044963569c5ef51cf9b787) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat(extension): support automatic translation based on language

### Patch Changes

- [#430](https://github.com/mengxi-ream/read-frog/pull/430) [`bce5170`](https://github.com/mengxi-ream/read-frog/commit/bce517047ab99c7badd8a7a0adca9af6c820a76e) Thanks [@Rafacv23](https://github.com/Rafacv23)! - feat: interactable prompt textarea

- [#441](https://github.com/mengxi-ream/read-frog/pull/441) [`f036a23`](https://github.com/mengxi-ream/read-frog/commit/f036a23ef8865a6a666cdc5db1fdc01799e4ee8d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: prevent infinite loop in MutationObserver causing browser freeze

- [#427](https://github.com/mengxi-ream/read-frog/pull/427) [`c3995f8`](https://github.com/mengxi-ream/read-frog/commit/c3995f83e73a72ddae4fa53ccf664ad937515c59) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: skip empty word when translate

## 1.7.1

### Patch Changes

- [#432](https://github.com/mengxi-ream/read-frog/pull/432) [`d727e1e`](https://github.com/mengxi-ream/read-frog/commit/d727e1ed9e946e9a7afe8f79c0bb1274a8f7844b) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix(extension): add missing v019-to-v020 config migration and schema validation

- [#428](https://github.com/mengxi-ream/read-frog/pull/428) [`d937925`](https://github.com/mengxi-ream/read-frog/commit/d937925da924728c7ff0b987322bf23e063b05e0) Thanks [@taiiiyang](https://github.com/taiiiyang)! - perf: Use requestIdleCallback or requestAnimationFrame to delay the application of smash style to improve the performance of the walk element.

## 1.7.0

### Minor Changes

- [#411](https://github.com/mengxi-ream/read-frog/pull/411) [`1c4fa39`](https://github.com/mengxi-ream/read-frog/commit/1c4fa3989bf3b81a6ec3cd551facd66806407d52) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat(extension): support disabling the floating button on specific websites

### Patch Changes

- [#420](https://github.com/mengxi-ream/read-frog/pull/420) [`bbbea54`](https://github.com/mengxi-ream/read-frog/commit/bbbea54788ed4abfcab5071ab76bf863bbf85afe) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: reinsert when an internal node is removed.

## 1.6.1

### Patch Changes

- [#416](https://github.com/mengxi-ream/read-frog/pull/416) [`9ae6dc7`](https://github.com/mengxi-ream/read-frog/commit/9ae6dc70570f2eb9f0501e6212785f760d67bef9) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: migrate default prompt to the new one

- [#414](https://github.com/mengxi-ream/read-frog/pull/414) [`8f9ef56`](https://github.com/mengxi-ream/read-frog/commit/8f9ef56fbdc18a4d43f1d0da5adf97becb5853ef) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix(extension): don't retranslate the whole ancestor node when auto translate

- [#418](https://github.com/mengxi-ream/read-frog/pull/418) [`80d0302`](https://github.com/mengxi-ream/read-frog/commit/80d0302e805248915694475383424df93054879e) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: avoid recursive translate on translation only

## 1.6.0

### Minor Changes

- [#400](https://github.com/mengxi-ream/read-frog/pull/400) [`28cdf77`](https://github.com/mengxi-ream/read-frog/commit/28cdf771b01a87e6cbd864de989c6dcc6087b50d) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat(extension): support to clear cache

- [#406](https://github.com/mengxi-ream/read-frog/pull/406) [`d8c3902`](https://github.com/mengxi-ream/read-frog/commit/d8c3902b727658a982c4cfad51fe806218accf4e) Thanks [@taiiiyang](https://github.com/taiiiyang)! - feat: implement customize translation shortcut keys

### Patch Changes

- [#393](https://github.com/mengxi-ream/read-frog/pull/393) [`3451481`](https://github.com/mengxi-ream/read-frog/commit/34514811c3a794238d780248bfcd0ad5b48676cb) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): improve BR tag handling and inline element processing

- [#413](https://github.com/mengxi-ream/read-frog/pull/413) [`625e073`](https://github.com/mengxi-ream/read-frog/commit/625e0735fe96b8d5af8b46704a16ef6284904ef9) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: improve translation algorithm and test descriptions

- [#398](https://github.com/mengxi-ream/read-frog/pull/398) [`19960b9`](https://github.com/mengxi-ream/read-frog/commit/19960b90b5d4f63695bbcfec94ba9ac36806e152) Thanks [@Yukiniro](https://github.com/Yukiniro)! - i18n(extension): update the translation of 'always translate' for options page

- [#403](https://github.com/mengxi-ream/read-frog/pull/403) [`25c25e8`](https://github.com/mengxi-ream/read-frog/commit/25c25e81e5a1aec6d252613bffcab0fbf17de6cb) Thanks [@Yukiniro](https://github.com/Yukiniro)! - feat(extension): support border style

- [#396](https://github.com/mengxi-ream/read-frog/pull/396) [`91c07c0`](https://github.com/mengxi-ream/read-frog/commit/91c07c049312edaf18f6fb52a55477fe64e44cb8) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix(extension): don't label too many inline nodes

## 1.5.4

### Patch Changes

- [#391](https://github.com/mengxi-ream/read-frog/pull/391) [`fde3535`](https://github.com/mengxi-ream/read-frog/commit/fde3535c4bebfba81d584f5cde140c4af5f4b6df) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat(extension): add flexible baseURL support for DeepLX providers

## 1.5.3

### Patch Changes

- [#390](https://github.com/mengxi-ream/read-frog/pull/390) [`55462bd`](https://github.com/mengxi-ream/read-frog/commit/55462bdfc3ef3fc4bfbcd0948f28ce606f48e0b9) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix(extension): improve floating element detection in DOM filter

- [#388](https://github.com/mengxi-ream/read-frog/pull/388) [`5846556`](https://github.com/mengxi-ream/read-frog/commit/5846556a5df456e777bfead644228b07c66cbeb6) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - test: enhance Claude Code guidance and standardize test directories

## 1.5.2

### Patch Changes

- [#386](https://github.com/mengxi-ream/read-frog/pull/386) [`08d93dd`](https://github.com/mengxi-ream/read-frog/commit/08d93dd5d91db3599b3556f6afae099c6c16cb8e) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: migrate to new prompt

## 1.5.1

### Patch Changes

- [#382](https://github.com/mengxi-ream/read-frog/pull/382) [`9a1d016`](https://github.com/mengxi-ream/read-frog/commit/9a1d016462d22a9e6b0637264cde32664c040e20) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: collapse config css

## 1.5.0

### Minor Changes

- [#371](https://github.com/mengxi-ream/read-frog/pull/371) [`e63c568`](https://github.com/mengxi-ream/read-frog/commit/e63c568ea46bdde485f794543869b73777e779b4) Thanks [@sedationh](https://github.com/sedationh)! - feat: add config sync feature

- [#381](https://github.com/mengxi-ream/read-frog/pull/381) [`19e9c3f`](https://github.com/mengxi-ream/read-frog/commit/19e9c3fb12263d08c819ba14160d8bbc22f73070) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - feat: add translation only mode

## 1.4.4

### Patch Changes

- [#379](https://github.com/mengxi-ream/read-frog/pull/379) [`6bd176d`](https://github.com/mengxi-ream/read-frog/commit/6bd176d8c618db4c4c4ee5598d4335f1e3af3c1a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: await configPromise in ensureConfig

- [#377](https://github.com/mengxi-ream/read-frog/pull/377) [`873dcb3`](https://github.com/mengxi-ream/read-frog/commit/873dcb3a66f075cab81324def6feb18fa6036646) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - fix: provider test deeplx logic

- [#379](https://github.com/mengxi-ream/read-frog/pull/379) [`6bd176d`](https://github.com/mengxi-ream/read-frog/commit/6bd176d8c618db4c4c4ee5598d4335f1e3af3c1a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: use query client from trpc for side content

- [#363](https://github.com/mengxi-ream/read-frog/pull/363) [`a7c49ce`](https://github.com/mengxi-ream/read-frog/commit/a7c49ce4d9a8d2b968213fac5f5b5658f2624cb1) Thanks [@flowKKo](https://github.com/flowKKo)! - feat: add API providers test feature

## 1.4.3

### Patch Changes

- [#367](https://github.com/mengxi-ream/read-frog/pull/367) [`337abdb`](https://github.com/mengxi-ream/read-frog/commit/337abdb7ff56b9d69d5de24d011643534fde735a) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: unresponsive dropdown when zoom in

- [#368](https://github.com/mengxi-ream/read-frog/pull/368) [`6ddff0f`](https://github.com/mengxi-ream/read-frog/commit/6ddff0f7f2cc4bf1525dee9d58410e7c7e38bb04) Thanks [@ananaBMaster](https://github.com/ananaBMaster)! - perf: only check better-auth.session_token

## 1.4.2

### Patch Changes

- [#354](https://github.com/mengxi-ream/read-frog/pull/354) [`f3fc960`](https://github.com/mengxi-ream/read-frog/commit/f3fc960ef7e0fc2b383357748ba664a9efef8b3d) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - fix: more info and better ui for translation error

- [#348](https://github.com/mengxi-ream/read-frog/pull/348) [`f2e3813`](https://github.com/mengxi-ream/read-frog/commit/f2e3813b44ff3527b4d05bdfa9fdc18ea2a5d6e5) Thanks [@yiyang-fairy](https://github.com/yiyang-fairy)! - feat: add dashed line style

- [#361](https://github.com/mengxi-ream/read-frog/pull/361) [`ad27745`](https://github.com/mengxi-ream/read-frog/commit/ad27745f088d430130496b050d596e955416f83a) Thanks [@mengxi-ream](https://github.com/mengxi-ream)! - feat: add translation mode config

- [#359](https://github.com/mengxi-ream/read-frog/pull/359) [`c16ede2`](https://github.com/mengxi-ream/read-frog/commit/c16ede2b3256e4f26ecdde37c88237a87e39b932) Thanks [@taiiiyang](https://github.com/taiiiyang)! - fix: add dontWalkAttr when translate page

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
