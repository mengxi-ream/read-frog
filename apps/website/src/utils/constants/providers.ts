import deeplxLogoDark from 'public/providers/deeplx-dark.svg'
import deeplxLogoLight from 'public/providers/deeplx-light.svg'
import openaiCompatibleLogoDark from 'public/providers/openai-compatible-dark.svg'
import openaiCompatibleLogoLight from 'public/providers/openai-compatible-light.svg'
import tensdaqLogoColor from 'public/providers/tensdaq-color.svg'
import { getLobeIconsCDNUrlFn } from '../logo'

export interface Provider { id: string, logo: (isDark: boolean) => string, name: string }

export const CUSTOM_LLM_PROVIDER_NAMES = ['openaiCompatible', 'tensdaq', 'siliconflow', 'ai302'] as const

export type CustomLLMProviderNames = typeof CUSTOM_LLM_PROVIDER_NAMES[number]

export const CUSTOM_PROVIDER_ITEMS: Record<CustomLLMProviderNames, Provider> = {
  openaiCompatible: {
    id: 'OpenAI Compatible',
    logo: (isDark: boolean) => isDark ? openaiCompatibleLogoDark.src : openaiCompatibleLogoLight.src,
    name: 'OpenAI Compatible',
  },
  tensdaq: {
    id: 'TensDAQ',
    logo: () => tensdaqLogoColor.src,
    name: 'TensDAQ',
  },
  siliconflow: {
    id: 'SiliconFlow',
    logo: getLobeIconsCDNUrlFn('siliconcloud-color'),
    name: 'SiliconFlow',
  },
  ai302: {
    id: '302.AI',
    logo: getLobeIconsCDNUrlFn('ai302-color'),
    name: '302.AI',
  },
}

export const NON_CUSTOM_LLM_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter'] as const

export type NonCustomLLMProviderNames = typeof NON_CUSTOM_LLM_PROVIDER_NAMES[number]

export const NON_CUSTOM_LLM_PROVIDER_ITEMS: Record<NonCustomLLMProviderNames, Provider> = {
  openai: {
    id: 'OpenAI',
    logo: getLobeIconsCDNUrlFn('openai'),
    name: 'OpenAI',
  },
  openrouter: {
    id: 'OpenRouter',
    logo: getLobeIconsCDNUrlFn('openrouter'),
    name: 'OpenRouter',
  },
  deepseek: {
    id: 'DeepSeek',
    logo: getLobeIconsCDNUrlFn('deepseek-color'),
    name: 'DeepSeek',
  },
  gemini: {
    id: 'Gemini',
    logo: getLobeIconsCDNUrlFn('gemini-color'),
    name: 'Gemini',
  },
  anthropic: {
    id: 'Anthropic',
    logo: getLobeIconsCDNUrlFn('anthropic'),
    name: 'Anthropic',
  },
  grok: {
    id: 'Grok',
    logo: getLobeIconsCDNUrlFn('grok'),
    name: 'Grok',
  },
  amazonBedrock: {
    id: 'Amazon Bedrock',
    logo: getLobeIconsCDNUrlFn('bedrock-color'),
    name: 'Amazon Bedrock',
  },
  groq: {
    id: 'Groq',
    logo: getLobeIconsCDNUrlFn('groq'),
    name: 'Groq',
  },
  deepinfra: {
    id: 'DeepInfra',
    logo: getLobeIconsCDNUrlFn('deepinfra-color'),
    name: 'DeepInfra',
  },
  mistral: {
    id: 'Mistral AI',
    logo: getLobeIconsCDNUrlFn('mistral-color'),
    name: 'Mistral AI',
  },
  togetherai: {
    id: 'Together.ai',
    logo: getLobeIconsCDNUrlFn('together-color'),
    name: 'Together.ai',
  },
  cohere: {
    id: 'Cohere',
    logo: getLobeIconsCDNUrlFn('cohere-color'),
    name: 'Cohere',
  },
  fireworks: {
    id: 'Fireworks AI',
    logo: getLobeIconsCDNUrlFn('fireworks-color'),
    name: 'Fireworks AI',
  },
  cerebras: {
    id: 'Cerebras',
    logo: getLobeIconsCDNUrlFn('cerebras-color'),
    name: 'Cerebras',
  },
  replicate: {
    id: 'Replicate',
    logo: getLobeIconsCDNUrlFn('replicate'),
    name: 'Replicate',
  },
  perplexity: {
    id: 'Perplexity',
    logo: getLobeIconsCDNUrlFn('perplexity-color'),
    name: 'Perplexity',
  },
  vercel: {
    id: 'Vercel',
    logo: getLobeIconsCDNUrlFn('vercel'),
    name: 'Vercel',
  },
}

export const PURE_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx'] as const

export type PureProviderNames = typeof PURE_PROVIDER_NAMES[number]

export const PURE_PROVIDERS_ITEMS: Record<PureProviderNames, Provider> = {
  google: {
    id: 'Google',
    logo: getLobeIconsCDNUrlFn('google-color'),
    name: 'Google',
  },
  microsoft: {
    id: 'Microsoft',
    logo: getLobeIconsCDNUrlFn('microsoft-color'),
    name: 'Microsoft',
  },
  deeplx: {
    id: 'DeepLX',
    logo: (isDark: boolean) => isDark ? deeplxLogoDark.src : deeplxLogoLight.src,
    name: 'DeepLX',
  },
}
