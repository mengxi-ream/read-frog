<div align="center"><a name="readme-top"></a>

[![Read Frog banner][image-banner]][website]

一款开源的 AI 驱动的浏览器语言学习扩展。<br/>
支持沉浸式翻译、文章分析、多种 AI 模型等功能。<br/>
在浏览器中利用 AI 轻松深入地掌握语言。

[English](./README.md) · **简体中文** · [官方网站](https://readfrog.app) · [教程](https://www.readfrog.app/zh/docs) · [更新日志](https://www.readfrog.app/zh/changelog) · [博客](https://www.readfrog.app/zh/blog)

<!-- SHIELD GROUP -->

[![Release version badge][extension-release-shield]][github-release-link]
[![Chrome version badge][chrome-version-shield]][chrome-store-link]
[![Edge version badge][edge-version-shield]][edge-store-link]
[![Firefox version badge][firefox-version-shield]][firefox-store-link]<br/>
[![Discord badge][discord-shield]][discord-link]
[![Chrome users badge][chrome-users-shield]][chrome-store-link]
[![Edge users badge][edge-users-shield]][edge-store-link]
[![Firefox users badge][firefox-users-shield]][firefox-store-link]<br/>
[![Stars badge][star-history-shield]][star-history-link]
[![Contributors badge][contributors-shield]][contributors-link]
![Last commit badge][last-commit-shield]
[![Issues badge][issues-shield]][issues-link]<br/>
[![Sponsor badge][sponsor-shield]][sponsor-link]

</div>

![2025 Recap](/assets/2025-recap.png)

<details>
<summary><kbd>目录</kbd></summary>

#### 目录

- [📺 演示](#-演示)
- [👋🏻 快速开始 \& 加入我们的社区](#-快速开始--加入我们的社区)
  - [下载](#下载)
  - [社区](#社区)
- [✨ 功能](#-功能)
  - [🔄 双语 / 仅译文](#-双语--仅译文)
  - [🧠 上下文感知翻译](#-上下文感知翻译)
  - [✨ 划词翻译](#-划词翻译)
  - [📝 自定义提示词](#-自定义提示词)
  - [📦 批量请求](#-批量请求)
  - [🤖 20+ AI 服务商](#-20-ai-服务商)
  - [🎬 字幕翻译](#-字幕翻译)
  - [🔊 文字转语音 (TTS)](#-文字转语音-tts)
- [🤝 贡献](#-贡献)
  - [贡献代码](#贡献代码)
- [📜 商业授权](#-商业授权)
- [❤️ 赞助者](#️-赞助者)

<br/>

</details>

## 📺 演示

![Read Frog](/assets/read-demo.gif)

<div align="center">
  <img src="assets/node-translation-demo.gif" width="38%" alt="Read Frog 弹窗界面" />
  <img src="assets/page-translation-demo.gif" width="60%" alt="Read Frog 翻译界面" />
</div>

## 👋🏻 快速开始 & 加入我们的社区

Read Frog 的愿景是为各个级别的语言学习者提供易于使用、智能化和个性化的语言学习体验。这在 AI 时代已成为可能，但市场上很少有产品满足这一需求。因此，我们决定自己动手，最终让世界不再依赖人类语言教师。

无论您是用户还是开发者，Read Frog 都将是您实现这一愿景的方式。请注意，Read Frog 目前正在积极开发中，欢迎对遇到的任何[问题][issues-link]提供反馈。

### 下载

| 浏览器  | 版本                                                                   | 下载                                                             |
| ------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Chrome  | [![Chrome version badge][chrome-version-shield]][chrome-store-link]    | [Chrome 应用商店][chrome-store-link] 或 [中国镜像][crxsoso-link] |
| Edge    | [![Edge version badge][edge-version-shield]][edge-store-link]          | [Microsoft Edge 插件商店][edge-store-link]                       |
| Firefox | [![Firefox version badge][firefox-version-shield]][firefox-store-link] | [Firefox 附加组件][firefox-store-link]                           |

### 社区

| [![Discord badge][discord-shield-badge]][discord-link] | 在 Discord 中提问，与开发者交流。              |
| :----------------------------------------------------- | :--------------------------------------------- |
| [![WeChat badge][wechat-shield-badge]][wechat-link]    | 如果您在中国大陆，可以添加微信账号加入微信群。 |

> \[!IMPORTANT]
>
> **⭐️ 给我们点星**, 您将及时收到来自 GitHub 的所有发布通知 \~

[![Star this repo][image-star]][github-star-link]

<details>
<summary>
  <kbd>Star 历史</kbd>
</summary>

<a href="https://www.star-history.com/#mengxi-ream/read-frog&Timeline">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mengxi-ream/read-frog&type=Timeline&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mengxi-ream/read-frog&type=Timeline" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mengxi-ream/read-frog&type=Timeline" />
 </picture>
</a>

</details>

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## ✨ 功能

借助 Read Frog 的强大功能，将您的日常网页阅读转变为沉浸式语言学习之旅。

<!-- ![][image-feat-bilingual] -->

### 🔄 [双语 / 仅译文][docs-tutorial]

在两种翻译显示模式之间无缝切换。**双语模式**将原文与译文并排显示，非常适合学习和对比。**仅译文模式**完全替换原文，提供更简洁的阅读体验。

当翻译处于激活状态时切换模式，扩展会自动重新翻译所有可见内容，确保平滑过渡，无需刷新页面。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-context] -->

### 🧠 [上下文感知翻译][docs-tutorial]

让 AI 理解您正在阅读内容的完整上下文。启用后，Read Frog 会提取页面标题和简洁的 Markdown 页面内容，将此上下文提供给 AI，以获得更准确、更符合语境的翻译。

这意味着技术术语会在其领域内被正确翻译，文学表达会保持其韵味，歧义短语会根据周围内容而非孤立地进行解释。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-selection] -->

### ✨ [划词翻译][docs-tutorial]

在网页上选择任何文本即可显示智能工具栏。**翻译**实时流式输出翻译结果。**解释**根据您的语言水平提供详细解释。**朗读**使用文字转语音功能朗读文本。

工具栏会智能定位以保持在视口内，支持拖拽交互，并可在所有网站上使用。非常适合阅读时快速查词。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-prompts] -->

### 📝 [自定义提示词][docs-tutorial]

定义您自己的翻译提示词，像专家一样翻译。为技术文档、文学作品或日常内容创建特定领域的提示词。使用 `[TARGET_LANG]`、`[INPUT]`、`[TITLE]` 和 `[SUMMARY]` 等令牌构建动态、上下文感知的提示词。

保存多个提示词模板，根据阅读内容随时切换。您的提示词，您做主。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-batch] -->

### 📦 [批量请求][docs-tutorial]

通过智能请求批处理节省高达 70% 的 API 成本。Read Frog 将多个翻译请求合并为单次 API 调用，在保持翻译质量的同时减少开销和令牌使用。

系统包含智能重试逻辑，支持指数退避，并在批处理失败时自动回退到单独请求。所有操作都在后台透明处理。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-providers] -->

### 🤖 [20+ AI 服务商][docs-tutorial]

通过 Vercel AI SDK 连接 20+ AI 服务商：OpenAI、DeepSeek、Anthropic Claude、Google Gemini、xAI Grok、Groq、Mistral、Ollama 等。为每个服务商配置自定义端点、API 密钥和模型设置。

此外还有免费翻译选项：Google 翻译、微软翻译和 DeepLX，提供零成本的基础翻译。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-subtitle] -->

### 🎬 [字幕翻译][docs-tutorial]

直接在视频播放器中翻译 YouTube 字幕。观看外语内容时，翻译会与原始字幕一起显示，让视频内容成为语言学习的好帮手。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-tts] -->

### 🔊 [文字转语音 (TTS)][docs-tutorial]

使用高质量 AI 语音朗读任何选中的文本。由 **Edge TTS** 驱动——完全免费，提供 150+ 种语音，覆盖 80+ 种语言，包括中文、英文、日文、韩文等。可自由调节语速、音调和音量。

自动语言检测（基础模式或 LLM 驱动）与按语言映射语音，确保每种语言使用最合适的语音。智能的句子感知分块功能处理长文本时会在自然边界处分割，并预取下一个片段以实现无缝播放。非常适合发音练习和听力学习。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 贡献

我们欢迎各种类型的贡献。

1. 向您的朋友和家人推广 Read Frog。
2. 报告[问题][issues-link]和反馈。
3. 贡献代码。

### 贡献代码

通过 AI 了解项目：[DeepWiki](https://deepwiki.com/mengxi-ream/read-frog)

查看[贡献指南](https://readfrog.app/zh/docs/code-contribution/contribution-guide)了解更多详情。

ReadFrog 采用 GPLv3 和商业许可双重授权。

贡献者许可条款请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)。

<a href="https://github.com/mengxi-ream/read-frog/graphs/contributors">
  <table>
    <tr>
      <th colspan="2">
        <br>
        <img src="https://contrib.rocks/image?repo=mengxi-ream/read-frog" alt="Contributors"><br>
        <br>
      </th>
    </tr>
    <!-- <tr>
      <td>
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-recent-top-contributors/thumbnail.png?repo_id=967738751&image_size=auto&color_scheme=dark" width="373" height="auto">
          <img alt="Top Contributors of mengxi-ream/read-frog - Last 28 days" src="https://next.ossinsight.io/widgets/official/compose-recent-top-contributors/thumbnail.png?repo_id=967738751&image_size=auto&color_scheme=light" width="373" height="auto">
        </picture>
      </td>
      <td rowspan="2">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=967738751&image_size=4x7&color_scheme=dark" width="655" height="auto">
          <img alt="Performance Stats of mengxi-ream/read-frog - Last 28 days" src="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=967738751&image_size=auto&color_scheme=light" width="655" height="auto">
        </picture>
      </td>
    </tr> -->
  </table>
</a>

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 📜 商业授权

<img src="/assets/tabbit.avif" alt="Tabbit" height="20" /> **美团 Tabbit 浏览器团队**：**免费**授权闭源商业使用，授权范围限于 v1.21.3 及之前的版本（commit [`724863f`](https://github.com/mengxi-ream/read-frog/commit/724863fdbc2d777766cada6c111235534ee03ca0)）。授权日期：2026 年 3 月 3 日上午 9:00（温哥华时间，UTC-8）。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## ❤️ 赞助者

每一笔捐赠都帮助我们构建更好的语言学习体验。感谢您支持我们的使命！

[![Sponsors][sponsor-image]][sponsor-link]

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-回到顶部-151515?style=flat-square
[chrome-store-link]: https://chromewebstore.google.com/detail/read-frog-open-source-ai/modkelfkcfjpgbfmnbnllalkiogfofhb
[chrome-users-shield]: https://img.shields.io/chrome-web-store/users/modkelfkcfjpgbfmnbnllalkiogfofhb?style=flat-square&label=Chrome%20用户&color=yellow&labelColor=black
[chrome-version-shield]: https://img.shields.io/chrome-web-store/v/modkelfkcfjpgbfmnbnllalkiogfofhb?style=flat-square&label=Chrome%20版本&labelColor=black&color=yellow
[contributors-link]: https://github.com/mengxi-ream/read-frog/graphs/contributors
[contributors-shield]: https://img.shields.io/github/contributors/mengxi-ream/read-frog?style=flat-square&labelColor=black
[crxsoso-link]: https://www.crxsoso.com/webstore/detail/modkelfkcfjpgbfmnbnllalkiogfofhb
[discord-link]: https://discord.gg/ej45e3PezJ
[discord-shield]: https://img.shields.io/discord/1371229720942874646?style=flat-square&label=Discord&logo=discord&logoColor=white&color=5865F2&labelColor=black
[discord-shield-badge]: https://img.shields.io/badge/聊天-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white&labelColor=black
[edge-store-link]: https://microsoftedge.microsoft.com/addons/detail/read-frog-open-source-a/cbcbomlgikfbdnoaohcjfledcoklcjbo
[firefox-store-link]: https://addons.mozilla.org/firefox/addon/read-frog-open-ai-translator/
[firefox-version-shield]: https://img.shields.io/amo/v/read-frog-open-ai-translator?style=flat-square&label=Firefox%20版本&labelColor=black&color=orange
[firefox-users-shield]: https://img.shields.io/amo/users/read-frog-open-ai-translator?style=flat-square&label=Firefox%20用户&color=orange&labelColor=black
[edge-users-shield]: https://img.shields.io/badge/dynamic/json?style=flat-square&logo=microsoft-edge&label=Edge%20用户&query=%24.activeInstallCount&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fcbcbomlgikfbdnoaohcjfledcoklcjbo&labelColor=black
[edge-version-shield]: https://img.shields.io/badge/dynamic/json?style=flat-square&logo=microsoft-edge&label=Edge%20版本&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fcbcbomlgikfbdnoaohcjfledcoklcjbo&labelColor=black&prefix=v
[extension-release-shield]: https://img.shields.io/github/package-json/v/mengxi-ream/read-frog?filename=package.json&style=flat-square&label=最新版本&color=brightgreen&labelColor=black
[github-release-link]: https://github.com/mengxi-ream/read-frog/releases
[github-star-link]: https://github.com/mengxi-ream/read-frog/stargazers
[image-banner]: /assets/store/large-promo-tile.png
[sponsor-image]: https://cdn.jsdelivr.net/gh/mengxi-ream/static/sponsorkit/sponsors.svg
[image-star]: ./assets/star.png
[issues-link]: https://github.com/mengxi-ream/read-frog/issues
[issues-shield]: https://img.shields.io/github/issues/mengxi-ream/read-frog?style=flat-square&labelColor=black
[last-commit-shield]: https://img.shields.io/github/last-commit/mengxi-ream/read-frog?style=flat-square&label=commit&labelColor=black
[sponsor-link]: https://github.com/sponsors/mengxi-ream
[sponsor-shield]: https://img.shields.io/github/sponsors/mengxi-ream?style=flat-square&label=赞助&color=EA4AAA&labelColor=black
[star-history-link]: https://www.star-history.com/#mengxi-ream/read-frog&Timeline
[star-history-shield]: https://img.shields.io/github/stars/mengxi-ream/read-frog?style=flat-square&label=stars&color=yellow&labelColor=black
[website]: https://readfrog.app
[wechat-link]: ./assets/wechat-account.jpg
[wechat-shield-badge]: https://img.shields.io/badge/聊天-微信-07C160?style=for-the-badge&logo=wechat&logoColor=white&labelColor=black

<!-- Feature docs link -->

[docs-tutorial]: https://readfrog.app/zh/docs
