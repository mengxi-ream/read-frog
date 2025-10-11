import customProviderLogo from 'public/providers/custom-provider.svg'
import deeplxLogoDark from 'public/providers/deeplx-dark.svg'
import deeplxLogoLight from 'public/providers/deeplx-light.svg'
import openaiCompatibleLogoDark from 'public/providers/openai-compatible-dark.svg'
import openaiCompatibleLogoLight from 'public/providers/openai-compatible-light.svg'
import tensdaqLogoColor from 'public/providers/tensdaq-color.svg'
import { getLobeIconsCDNUrlFn } from '../logo'

export interface Provider { id: string, logo: (isDark: boolean) => string }

export const CUSTOM_LLM_PROVIDER_NAMES = ['customProvider', 'openaiCompatible', 'tensdaq', 'siliconflow', 'ai302'] as const

export type CustomLLMProviderNames = typeof CUSTOM_LLM_PROVIDER_NAMES[number]

export const CUSTOM_PROVIDER_ITEMS: Record<CustomLLMProviderNames, Provider> = {
  customProvider: {
    id: 'Custom Provider',
    logo: () => customProviderLogo.src,
  },
  openaiCompatible: {
    id: 'OpenAI Compatible',
    logo: (isDark: boolean) => isDark ? openaiCompatibleLogoDark.src : openaiCompatibleLogoLight.src,
  },
  tensdaq: {
    id: 'TensDAQ',
    logo: () => tensdaqLogoColor.src,
  },
  siliconflow: {
    id: 'SiliconFlow',
    logo: getLobeIconsCDNUrlFn('siliconcloud-color'),
  },
  ai302: {
    id: '302.AI',
    logo: getLobeIconsCDNUrlFn('ai302-color'),
  },
}

export const NON_CUSTOM_LLM_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter'] as const

export type NonCustomLLMProviderNames = typeof NON_CUSTOM_LLM_PROVIDER_NAMES[number]

export const NON_CUSTOM_LLM_PROVIDER_ITEMS: Record<NonCustomLLMProviderNames, Provider> = {
  openai: {
    id: 'OpenAI',
    logo: getLobeIconsCDNUrlFn('openai'),
  },
  openrouter: {
    id: 'OpenRouter',
    logo: getLobeIconsCDNUrlFn('openrouter'),
  },
  deepseek: {
    id: 'DeepSeek',
    logo: getLobeIconsCDNUrlFn('deepseek-color'),
  },
  gemini: {
    id: 'Gemini',
    logo: getLobeIconsCDNUrlFn('gemini-color'),
  },
  anthropic: {
    id: 'Anthropic',
    logo: getLobeIconsCDNUrlFn('anthropic'),
  },
  grok: {
    id: 'Grok',
    logo: getLobeIconsCDNUrlFn('grok'),
  },
  amazonBedrock: {
    id: 'Amazon Bedrock',
    logo: getLobeIconsCDNUrlFn('bedrock-color'),
  },
  groq: {
    id: 'Groq',
    logo: getLobeIconsCDNUrlFn('groq'),
  },
  deepinfra: {
    id: 'DeepInfra',
    logo: getLobeIconsCDNUrlFn('deepinfra-color'),
  },
  mistral: {
    id: 'Mistral AI',
    logo: getLobeIconsCDNUrlFn('mistral-color'),
  },
  togetherai: {
    id: 'Together.ai',
    logo: getLobeIconsCDNUrlFn('together-color'),
  },
  cohere: {
    id: 'Cohere',
    logo: getLobeIconsCDNUrlFn('cohere-color'),
  },
  fireworks: {
    id: 'Fireworks AI',
    logo: getLobeIconsCDNUrlFn('fireworks-color'),
  },
  cerebras: {
    id: 'Cerebras',
    logo: getLobeIconsCDNUrlFn('cerebras-color'),
  },
  replicate: {
    id: 'Replicate',
    logo: getLobeIconsCDNUrlFn('replicate'),
  },
  perplexity: {
    id: 'Perplexity',
    logo: getLobeIconsCDNUrlFn('perplexity-color'),
  },
  vercel: {
    id: 'Vercel',
    logo: getLobeIconsCDNUrlFn('vercel'),
  },
}

export const PURE_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx'] as const

export type PureProviderNames = typeof PURE_PROVIDER_NAMES[number]

export const PURE_PROVIDERS_ITEMS: Record<PureProviderNames, Provider> = {
  google: {
    id: 'Google',
    logo: getLobeIconsCDNUrlFn('google-color'),
  },
  microsoft: {
    id: 'Microsoft',
    logo: getLobeIconsCDNUrlFn('microsoft-color'),
  },
  deeplx: {
    id: 'DeepLX',
    logo: (isDark: boolean) => isDark ? deeplxLogoDark.src : deeplxLogoLight.src,
  },
}
