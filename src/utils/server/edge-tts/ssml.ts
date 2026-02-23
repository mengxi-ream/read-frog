import type { EdgeTTSRequestParams } from './types'
import { EdgeTTSError } from './errors'

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeInputText(text: string): string {
  const chars = [...text]
  for (let index = 0; index < chars.length; index++) {
    const codePoint = chars[index]?.codePointAt(0) ?? 0
    if ((codePoint >= 0 && codePoint <= 8) || (codePoint >= 11 && codePoint <= 12) || (codePoint >= 14 && codePoint <= 31)) {
      chars[index] = ' '
    }
  }
  return chars.join('')
}

export function buildSSMLRequest(params: EdgeTTSRequestParams): string {
  const cleanText = sanitizeInputText(params.text).trim()
  if (!cleanText) {
    throw new EdgeTTSError('INVALID_TEXT', 'Text to speech input is empty')
  }

  const locale = params.voice.split('-').slice(0, 2).join('-') || 'zh-CN'
  const rate = params.rate ?? '+0%'
  const pitch = params.pitch ?? '+0Hz'
  const volume = params.volume ?? '+0%'
  const escapedLocale = escapeXml(locale)
  const escapedVoice = escapeXml(params.voice)
  const escapedRate = escapeXml(rate)
  const escapedPitch = escapeXml(pitch)
  const escapedVolume = escapeXml(volume)

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapedLocale}"><voice name="${escapedVoice}"><prosody rate="${escapedRate}" pitch="${escapedPitch}" volume="${escapedVolume}">${escapeXml(cleanText)}</prosody></voice></speak>`
}
