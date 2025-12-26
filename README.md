<div align="center"><a name="readme-top"></a>

[![][image-banner]][website]

An open-source AI-powered language learning extension for browsers.<br/>
Supports immersive translation, article analysis, multiple AI models, and more.<br/>
Master languages effortlessly and deeply with AI, right in your browser.

**English** · [简体中文](./README.zh-CN.md) · [Official Website](https://readfrog.app) · [Tutorial](https://www.readfrog.app/tutorial) · [Changelog](https://www.readfrog.app/changelog) · [Blog](https://www.readfrog.app/blog)

<!-- SHIELD GROUP -->

[![][extension-release-shield]][github-release-link]
[![][chrome-version-shield]][chrome-store-link]
[![][edge-version-shield]][edge-store-link]<br/>
[![][discord-shield]][discord-link]
[![][chrome-users-shield]][chrome-store-link]
[![][edge-users-shield]][edge-store-link]<br/>
[![][star-history-shield]][star-history-link]
[![][contributors-shield]][contributors-link]
![][last-commit-shield]
[![][issues-shield]][issues-link]<br/>
[![][sponsor-shield]][sponsor-link]

</div>

![2025 Recap](/assets/2025-recap.png)

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [📺 Demo](#-demo)
- [👋🏻 Getting Started \& Join Our Community](#-getting-started--join-our-community)
  - [Download](#download)
  - [Community](#community)
- [✨ Features](#-features)
  - [🔄 Bilingual / Translation Only](#-bilingual--translation-only)
  - [🧠 Context-Aware Translation](#-context-aware-translation)
  - [✨ Selection Translation](#-selection-translation)
  - [📝 Custom Prompts](#-custom-prompts)
  - [📦 Batch Requests](#-batch-requests)
  - [🤖 20+ AI Providers](#-20-ai-providers)
  - [🎬 Subtitle Translation (Beta)](#-subtitle-translation-beta)
  - [🔊 Text-to-Speech (TTS)](#-text-to-speech-tts)
  - [📖 Read Article](#-read-article)
- [🤝 Contribute](#-contribute)
  - [Contribute Code](#contribute-code)
- [❤️ Sponsors](#️-sponsors)

<br/>

</details>

## 📺 Demo

![Read Frog](/assets/read-demo.gif)

<div align="center">
  <img src="assets/node-translation-demo.gif" width="38%" alt="Read Frog Popup Interface" />
  <img src="assets/page-translation-demo.gif" width="60%" alt="Read Frog Translation Interface" />
</div>

## 👋🏻 Getting Started & Join Our Community

Read Frog's vision is to provide an easy-to-use, intelligent, and personalized language learning experience for language learners of all levels. This has become possible in the AI era, but there are few products on the market that meet this demand. Therefore, we decided to take matters into our own hands and ultimately make the world no longer reliant on human language instructors.

Whether you are a user or a developer, Read Frog will be an important part of your journey toward this vision. Please be aware that Read Frog is currently under active development, and feedback is welcome for any [issues][issues-link] encountered.

### Download

| Browser | Version                                         | Download                                                          |
| ------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| Chrome  | [![][chrome-version-shield]][chrome-store-link] | [Chrome Web Store][chrome-store-link] or [中国镜像][crxsoso-link] |
| Edge    | [![][edge-version-shield]][edge-store-link]     | [Microsoft Edge Addons][edge-store-link]                          |

### Community

| [![][discord-shield-badge]][discord-link] | In Discord ask questions, and connect with developers.                                 |
| :---------------------------------------- | :------------------------------------------------------------------------------------- |
| [![][wechat-shield-badge]][wechat-link]   | If you are in mainland China, you can add the WeChat account to join the WeChat group. |

> \[!IMPORTANT]
>
> **⭐️ Star Us**, You will receive all release notifications from GitHub without any delay \~

[![][image-star]][github-star-link]

<details>
<summary>
  <kbd>Star History</kbd>
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

[![][back-to-top]](#readme-top)

</div>

## ✨ Features

Transform your everyday web reading into an immersive language learning journey with Read Frog's powerful features.

<!-- ![][image-feat-bilingual] -->

### 🔄 [Bilingual / Translation Only][docs-tutorial]

Switch seamlessly between two translation display modes. **Bilingual mode** shows the original text alongside its translation, perfect for learning and comparison. **Translation-only mode** replaces the original text entirely for a cleaner reading experience.

The extension automatically re-translates all visible content when you switch modes while translation is active, ensuring a smooth transition without needing to refresh the page.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-context] -->

### 🧠 [Context-Aware Translation][docs-tutorial]

Enable AI to understand the full context of what you're reading. When activated, Read Frog uses Mozilla's Readability library to extract the article's title and content, providing this context to the AI for more accurate, contextually-appropriate translations.

This means technical terms get translated correctly within their domain, literary expressions maintain their nuance, and ambiguous phrases are interpreted based on the surrounding content rather than in isolation.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-selection] -->

### ✨ [Selection Translation][docs-tutorial]

Select any text on a webpage to reveal a smart toolbar with powerful options. **Translate** streams the translation in real-time. **Explain** provides detailed explanations tailored to your language level. **Speak** reads the text aloud using text-to-speech.

The toolbar intelligently positions itself to stay within the viewport, supports drag interactions, and works across all websites. Perfect for quick lookups while reading.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-prompts] -->

### 📝 [Custom Prompts][docs-tutorial]

Define your own translation prompts to translate like an expert. Create domain-specific prompts for technical documents, literary works, or casual content. Use tokens like `[TARGET_LANG]`, `[INPUT]`, `[TITLE]`, and `[SUMMARY]` to build dynamic, context-aware prompts.

Save multiple prompt patterns and switch between them based on what you're reading. Your prompts, your rules.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-batch] -->

### 📦 [Batch Requests][docs-tutorial]

Save up to 70% on API costs with intelligent request batching. Read Frog groups multiple translation requests into single API calls, reducing overhead and token usage while maintaining translation quality.

The system includes smart retry logic with exponential backoff and automatic fallback to individual requests if batch processing fails. All handled transparently in the background.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-providers] -->

### 🤖 [20+ AI Providers][docs-tutorial]

Connect to 20+ AI providers through Vercel AI SDK: OpenAI, DeepSeek, Anthropic Claude, Google Gemini, xAI Grok, Groq, Mistral, Ollama, and many more. Configure custom endpoints, API keys, and model settings for each provider.

Plus free translation options: Google Translate, Microsoft Translate, and DeepLX for cost-free basic translations.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-subtitle] -->

### 🎬 [Subtitle Translation (Beta)][docs-tutorial]

Translate YouTube subtitles directly in the video player. Watch foreign language content with translations displayed alongside the original subtitles, making video content accessible for language learning.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-tts] -->

### 🔊 [Text-to-Speech (TTS)][docs-tutorial]

Listen to any selected text with high-quality AI voices. Powered by OpenAI's TTS models, choose from multiple voices (Alloy, Ash, Coral, Echo, and more) and adjust playback speed from 0.25x to 4x.

Smart sentence-aware chunking handles long text by splitting at natural boundaries and prefetching the next chunk for seamless playback. Perfect for pronunciation practice and auditory learning.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-read] -->

### 📖 [Read Article][docs-tutorial]

One-click deep article analysis. Read Frog extracts the main content using Mozilla's Readability, detects the source language, and generates a summary and introduction in your target language.

Then it provides sentence-by-sentence translations with vocabulary explanations tailored to your language level (beginner, intermediate, or advanced). Each sentence includes key word definitions, grammatical analysis, and contextual explanations. It's like having a personal language tutor analyze every article you read.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🤝 Contribute

Contributions of all types are more than welcome.

1. Promote Read Frog to your friends and family.
2. Report [issues][issues-link] and feedback.
3. Contribute code.

### Contribute Code

Project Structure: [DeepWiki](https://deepwiki.com/mengxi-ream/read-frog)

Ask AI to understand the project: [Dosu](https://app.dosu.dev/29569286-71ba-47dd-b038-c7ab1b9d0df7/documents)

Check out the [Contribution Guide](https://readfrog.app/en/tutorial/code-contribution/contribution-guide) for more details.

<a href="https://github.com/mengxi-ream/read-frog/graphs/contributors">
  <table>
    <tr>
      <th colspan="2">
        <br>
        <img src="https://contrib.rocks/image?repo=mengxi-ream/read-frog"><br>
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

[![][back-to-top]](#readme-top)

</div>

## ❤️ Sponsors

Every donation helps us build a better language learning experience. Thank you for supporting our mission!

[![][sponsor-image]][sponsor-link]

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->

[2025-recap]: /assets/2025-recap.png
[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[chrome-store-link]: https://chromewebstore.google.com/detail/read-frog-open-source-ai/modkelfkcfjpgbfmnbnllalkiogfofhb
[chrome-users-shield]: https://img.shields.io/chrome-web-store/users/modkelfkcfjpgbfmnbnllalkiogfofhb?style=flat-square&label=Chrome%20Users&color=orange&labelColor=black
[chrome-version-shield]: https://img.shields.io/chrome-web-store/v/modkelfkcfjpgbfmnbnllalkiogfofhb?style=flat-square&label=Chrome%20Version&labelColor=black&color=orange
[contributors-link]: https://github.com/mengxi-ream/read-frog/graphs/contributors
[contributors-shield]: https://img.shields.io/github/contributors/mengxi-ream/read-frog?style=flat-square&labelColor=black
[crxsoso-link]: https://www.crxsoso.com/webstore/detail/modkelfkcfjpgbfmnbnllalkiogfofhb
[discord-link]: https://discord.gg/ej45e3PezJ
[discord-shield]: https://img.shields.io/discord/1371229720942874646?style=flat-square&label=Discord&logo=discord&logoColor=white&color=5865F2&labelColor=black
[discord-shield-badge]: https://img.shields.io/badge/chat-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white&labelColor=black
[edge-store-link]: https://microsoftedge.microsoft.com/addons/detail/read-frog-open-source-a/cbcbomlgikfbdnoaohcjfledcoklcjbo
[edge-users-shield]: https://img.shields.io/badge/dynamic/json?style=flat-square&logo=microsoft-edge&label=Edge%20Users&query=%24.activeInstallCount&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fcbcbomlgikfbdnoaohcjfledcoklcjbo&labelColor=black
[edge-version-shield]: https://img.shields.io/badge/dynamic/json?style=flat-square&logo=microsoft-edge&label=Edge%20Version&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fcbcbomlgikfbdnoaohcjfledcoklcjbo&labelColor=black&prefix=v
[extension-release-shield]: https://img.shields.io/github/package-json/v/mengxi-ream/read-frog?filename=package.json&style=flat-square&label=Latest%20Version&color=brightgreen&labelColor=black
[github-release-link]: https://github.com/mengxi-ream/read-frog/releases
[github-star-link]: https://github.com/mengxi-ream/read-frog/stargazers
[image-banner]: /assets/store/large-promo-tile.png
[image-star]: ./assets/star.png
[issues-link]: https://github.com/mengxi-ream/read-frog/issues
[issues-shield]: https://img.shields.io/github/issues/mengxi-ream/read-frog?style=flat-square&labelColor=black
[last-commit-shield]: https://img.shields.io/github/last-commit/mengxi-ream/read-frog?style=flat-square&label=commit&labelColor=black
[sponsor-image]: https://cdn.jsdelivr.net/gh/mengxi-ream/static/sponsorkit/sponsors.svg
[sponsor-link]: https://github.com/sponsors/mengxi-ream
[sponsor-shield]: https://img.shields.io/github/sponsors/mengxi-ream?style=flat-square&label=Sponsor&color=EA4AAA&labelColor=black
[star-history-link]: https://www.star-history.com/#mengxi-ream/read-frog&Timeline
[star-history-shield]: https://img.shields.io/github/stars/mengxi-ream/read-frog?style=flat-square&label=stars&color=yellow&labelColor=black
[website]: https://readfrog.app
[wechat-link]: ./assets/wechat-account.jpg
[wechat-shield-badge]: https://img.shields.io/badge/chat-WeChat-07C160?style=for-the-badge&logo=wechat&logoColor=white&labelColor=black

<!-- Feature images (placeholders) -->

[image-feat-bilingual]: /assets/features/bilingual.png
[image-feat-context]: /assets/features/context-aware.png
[image-feat-selection]: /assets/features/selection.png
[image-feat-prompts]: /assets/features/prompts.png
[image-feat-batch]: /assets/features/batch.png
[image-feat-providers]: /assets/features/providers.png
[image-feat-subtitle]: /assets/features/subtitle.png
[image-feat-tts]: /assets/features/tts.png
[image-feat-read]: /assets/features/read.png

<!-- Feature docs link -->

[docs-tutorial]: https://readfrog.app/tutorial
