import { describe, expect, it } from 'vitest'
import { combineEdgeTTSAudioChunks } from '../synthesize'

describe('combineEdgeTTSAudioChunks', () => {
  it('rejects non-concatenable output formats for multi-chunk synthesis', async () => {
    await expect(combineEdgeTTSAudioChunks([
      {
        text: 'first',
        voice: 'en-US-JennyNeural',
        outputFormat: 'riff-24khz-16bit-mono-pcm',
      },
      {
        text: 'second',
        voice: 'en-US-JennyNeural',
        outputFormat: 'riff-24khz-16bit-mono-pcm',
      },
    ])).rejects.toThrowError(/not safe for multi-chunk concatenation/i)
  })

  it('rejects mixed output formats for multi-chunk synthesis', async () => {
    await expect(combineEdgeTTSAudioChunks([
      {
        text: 'first',
        voice: 'en-US-JennyNeural',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      },
      {
        text: 'second',
        voice: 'en-US-JennyNeural',
        outputFormat: 'raw-24khz-16bit-mono-pcm',
      },
    ])).rejects.toThrowError(/mixed output formats are not supported/i)
  })
})
