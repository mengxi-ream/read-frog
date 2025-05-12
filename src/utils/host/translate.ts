import { generateText } from "ai";

import { langCodeToEnglishName } from "@/types/config/languages";

import { INLINE_TRANSLATE_TAGS } from "../constants/dom";
import { getTranslateLinePrompt } from "../prompts/translate-line";
import { getTextContent, selectNode, smashTruncationStyle } from "./dom";

const translatingNodes = new Set<HTMLElement>();

export function handleShowOrHideTranslationAction(
  mouseX: number,
  mouseY: number,
) {
  if (!globalConfig) return;

  const node = selectNode(mouseX, mouseY);

  if (!node || !(node instanceof HTMLElement) || !shouldTriggerAction(node))
    return;

  const translatedWrapperNode = node.querySelector(".notranslate");

  if (translatedWrapperNode) {
    translatedWrapperNode.remove();
  } else {
    // prevent too quick hotkey trigger
    if (translatingNodes.has(node)) return;
    translatingNodes.add(node);
    translateNode(node);
  }
}

function shouldTriggerAction(node: Node) {
  return node.textContent?.trim();
}

async function translateNode(node: HTMLElement) {
  try {
    smashTruncationStyle(node);
    // while currentNode only has one children, and no text node, choose the children
    let targetNode = node;
    while (
      targetNode &&
      targetNode.childNodes.length === 1 &&
      targetNode.children.length === 1
    ) {
      targetNode = targetNode.children[0] as HTMLElement;
    }

    const textContent = getTextContent(targetNode);
    if (!textContent) return;

    const spinner = document.createElement("span");
    spinner.className = "read-frog-spinner";
    targetNode.appendChild(spinner);
    const translatedText = await translateText(textContent);
    spinner.remove();
    if (!translatedText) return;

    const translatedWrapperNode = createTranslatedWrapperNode(
      targetNode,
      translatedText,
    );

    targetNode.appendChild(translatedWrapperNode);
  } catch (error) {
    console.error(error);
  } finally {
    translatingNodes.delete(node);
  }
}

function createTranslatedWrapperNode(
  targetNode: HTMLElement,
  translatedText: string,
) {
  const translatedWrapperNode = document.createElement("span");
  translatedWrapperNode.className =
    "notranslate read-frog-translated-content-wrapper";

  const translatedNode = document.createElement("span");

  if (INLINE_TRANSLATE_TAGS.has(targetNode.tagName)) {
    const spaceNode = document.createElement("span");
    spaceNode.innerHTML = "&nbsp;&nbsp;";
    translatedWrapperNode.appendChild(spaceNode);
    translatedNode.className =
      "notranslate read-frog-translated-inline-content";
  } else {
    const brNode = document.createElement("br");
    translatedWrapperNode.appendChild(brNode);
    translatedNode.className = "notranslate read-frog-translated-block-content";
  }

  translatedNode.textContent = translatedText ?? "";
  translatedWrapperNode.appendChild(translatedNode);

  return translatedWrapperNode;
}

async function translateText(sourceText: string) {
  if (!globalConfig) return;
  const registry = await getProviderRegistry();
  const provider = globalConfig.provider;
  const model = globalConfig.providersConfig[provider].model;

  // TODO: retry logic + cache logic
  const { text } = await generateText({
    model: registry.languageModel(`${provider}:${model}`),
    prompt: getTranslateLinePrompt(
      langCodeToEnglishName[globalConfig.language.targetCode],
      sourceText,
    ),
  });

  // LLM models can't return empty text, so we need to return empty string if the translation is the same as the source text
  return text === sourceText ? "" : text;
}
