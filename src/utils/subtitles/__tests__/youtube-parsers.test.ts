import type { YoutubeTimedText } from '../fetchers/youtube/types'
import { describe, expect, it } from 'vitest'
import { detectFormat } from '../fetchers/youtube/format-detector'
import { parseKaraokeSubtitles } from '../fetchers/youtube/parser/karaoke-parser'
import { parseScrollingAsrSubtitles } from '../fetchers/youtube/parser/scrolling-asr-parser'
import { optimizeSubtitles } from '../processor/optimizer'

describe('youTube Subtitle Parsers', () => {
  describe('format Detection', () => {
    it('should detect karaoke format (multiple wpWinPosId at same timestamp)', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 1, segs: [{ utf8: 'あ' }] },
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 2, segs: [{ utf8: 'a' }] },
      ]
      expect(detectFormat(events)).toBe('karaoke')
    })

    it('should detect scrolling-asr format (wWinId + aAppend: 1)', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'Hello' }] },
        { tStartMs: 2000, dDurationMs: 1000, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
      ]
      expect(detectFormat(events)).toBe('scrolling-asr')
    })

    it('should default to standard format', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: 'Hello' }] },
        { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: 'World' }] },
      ]
      expect(detectFormat(events)).toBe('standard')
    })

    it('should return standard for empty events', () => {
      expect(detectFormat([])).toBe('standard')
    })
  })

  describe('karaoke Parser', () => {
    it('should select main track (prefer wpWinPosId: 3)', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 1, segs: [{ utf8: 'ruby' }] },
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 3, segs: [{ utf8: '漢字' }] },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('漢字')
    })

    it('should use largest wpWinPosId if 3 is not available', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 1, segs: [{ utf8: 'small' }] },
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 5, segs: [{ utf8: 'large' }] },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('large')
    })

    it('should merge segs within event', () => {
      const events: YoutubeTimedText[] = [
        {
          tStartMs: 1000,
          dDurationMs: 3000,
          wpWinPosId: 3,
          segs: [{ utf8: '今日' }, { utf8: 'は' }, { utf8: '晴れ' }],
        },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('今日は晴れ')
      expect(result[0].start).toBe(1000)
      expect(result[0].end).toBe(4000)
    })

    it('should fix overlap between fragments', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 5000, wpWinPosId: 3, segs: [{ utf8: 'First' }] },
        { tStartMs: 2000, dDurationMs: 3000, wpWinPosId: 3, segs: [{ utf8: 'Second' }] },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result).toHaveLength(2)
      expect(result[0].end).toBe(2000) // Fixed from 6000 to 2000
      expect(result[1].start).toBe(2000)
    })

    it('should deduplicate adjacent identical text', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 1000, wpWinPosId: 3, segs: [{ utf8: 'Same' }] },
        { tStartMs: 2000, dDurationMs: 1000, wpWinPosId: 3, segs: [{ utf8: 'Same' }] },
        { tStartMs: 3000, dDurationMs: 1000, wpWinPosId: 3, segs: [{ utf8: 'Different' }] },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('Same')
      expect(result[0].start).toBe(1000)
      expect(result[0].end).toBe(3000) // Merged time range
      expect(result[1].text).toBe('Different')
    })

    it('should clean zero-width spaces', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 3, segs: [{ utf8: 'Hello\u200BWorld' }] },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result[0].text).toBe('HelloWorld')
    })

    it('should skip empty segs', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 3, segs: [] },
        { tStartMs: 3000, dDurationMs: 2000, wpWinPosId: 3, segs: [{ utf8: 'Valid' }] },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Valid')
    })

    it('should skip events with only whitespace', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wpWinPosId: 3, segs: [{ utf8: '   ' }] },
        { tStartMs: 3000, dDurationMs: 2000, wpWinPosId: 3, segs: [{ utf8: 'Valid' }] },
      ]
      const result = parseKaraokeSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Valid')
    })
  })

  describe('scrolling ASR Parser', () => {
    it('should split at sentence boundary within event', () => {
      // When sentence ends and more text follows in same event, split immediately
      const events: YoutubeTimedText[] = [
        {
          tStartMs: 44840,
          dDurationMs: 3000,
          wWinId: 1,
          segs: [
            { utf8: '0°を超えた瞬間に' },
            { utf8: '氷が溶け始める', tOffsetMs: 500 },
            { utf8: '。', tOffsetMs: 800 },
            { utf8: '今までの温度上昇', tOffsetMs: 1000 },
            { utf8: '。', tOffsetMs: 1500 },
          ],
        },
        { tStartMs: 55310, dDurationMs: 10, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      // Split at first sentence boundary when more text follows
      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('0°を超えた瞬間に氷が溶け始める。')
      expect(result[0].start).toBe(44840)
      expect(result[1].text).toBe('今までの温度上昇。')
      expect(result[1].end).toBe(55320) // separator end time for last fragment
    })

    it('should merge text across events until separator', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 60039, dDurationMs: 3000, wWinId: 1, segs: [{ utf8: '例えば筋トレは' }] },
        { tStartMs: 64670, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 64680, dDurationMs: 3240, wWinId: 1, segs: [{ utf8: '1' }] },
        { tStartMs: 64910, dDurationMs: 3010, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
        {
          tStartMs: 64920,
          dDurationMs: 3000,
          wWinId: 1,
          segs: [
            { utf8: '日やっただけでは' },
            { utf8: '変化がない', tOffsetMs: 500 },
            { utf8: '。', tOffsetMs: 800 },
          ],
        },
        { tStartMs: 75870, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      // Text accumulates across events, outputs at separator after sentence end
      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('例えば筋トレは1日やっただけでは変化がない。')
      expect(result[0].start).toBe(60039)
    })

    it('should use separator to update end time without splitting', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'テスト' }] },
        { tStartMs: 2500, dDurationMs: 1500, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 3000, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: '文章' }, { utf8: '。', tOffsetMs: 500 }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('テスト文章。')
      expect(result[0].start).toBe(1000)
      // end = last seg start (3000 + 500) + ESTIMATED_WORD_DURATION_MS (200) = 3700
      expect(result[0].end).toBe(3700)
    })

    it('should split on sentence boundary with separator events', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'First.' }] },
        { tStartMs: 3000, dDurationMs: 500, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 3500, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'Second.' }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('First.')
      expect(result[1].text).toBe('Second.')
    })

    it('should add space when merging English text across events', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'being' }] },
        { tStartMs: 3000, dDurationMs: 500, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 3500, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'honest.' }] },
      ]
      const result = parseScrollingAsrSubtitles(events, 'en')

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('being honest.')
    })

    it('should not add space for non-English languages', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'です' }] },
        { tStartMs: 3000, dDurationMs: 500, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 3500, dDurationMs: 2000, wWinId: 1, segs: [{ utf8: 'ね。' }] },
      ]
      const result = parseScrollingAsrSubtitles(events, 'ja')

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('ですね。')
    })

    it('should fix overlap between fragments', () => {
      // Test overlap: first fragment's last seg ends after second fragment starts
      const events: YoutubeTimedText[] = [
        {
          tStartMs: 1000,
          dDurationMs: 15000,
          segs: [
            { utf8: 'First' },
            { utf8: '.', tOffsetMs: 4500 }, // segStart = 5500, lastSegEnd = 5700
          ],
        },
        { tStartMs: 5000, dDurationMs: 10000, segs: [{ utf8: 'Second.' }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      expect(result).toHaveLength(2)
      expect(result[0].end).toBe(5000) // Fixed from 5700 to 5000
      expect(result[1].start).toBe(5000)
    })

    it('should handle missing dDurationMs', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 0, segs: [{ utf8: 'Hello.' }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      expect(result).toHaveLength(1)
      // end = tStartMs + ESTIMATED_WORD_DURATION_MS (200)
      expect(result[0].end).toBe(1200)
    })

    it('should merge segs within event', () => {
      const events: YoutubeTimedText[] = [
        {
          tStartMs: 1000,
          dDurationMs: 3000,
          segs: [{ utf8: 'Hello ' }, { utf8: 'World' }],
        },
      ]
      const result = parseScrollingAsrSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Hello World')
    })

    it('should skip events with empty segs', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, segs: [] },
        { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: 'Valid' }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Valid')
    })

    it('should skip events with only whitespace', () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: '   ' }] },
        { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: 'Valid' }] },
      ]
      const result = parseScrollingAsrSubtitles(events)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Valid')
    })

    it('should split CJK lyrics at character limit when no punctuation', () => {
      // Japanese lyrics without sentence-ending punctuation
      // MAX_CHARS_CJK = 30, so text longer than 30 chars should trigger split
      const events: YoutubeTimedText[] = [
        {
          tStartMs: 1280,
          dDurationMs: 6190,
          wWinId: 1,
          segs: [
            { utf8: '水溜り' }, // 3
            { utf8: '映る', tOffsetMs: 1000 }, // 2 -> 5
            { utf8: '光', tOffsetMs: 1919 }, // 1 -> 6
            { utf8: 'に', tOffsetMs: 2400 }, // 1 -> 7
            { utf8: '鮮やか', tOffsetMs: 3400 }, // 3 -> 10
            { utf8: 'な', tOffsetMs: 3960 }, // 1 -> 11
          ],
        },
        { tStartMs: 7470, dDurationMs: 9490, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
        {
          tStartMs: 7480,
          dDurationMs: 9470,
          wWinId: 1,
          segs: [
            { utf8: '景色' }, // 2 -> 13
            { utf8: '君', tOffsetMs: 1400 }, // 1 -> 14
            { utf8: '笑えば', tOffsetMs: 2400 }, // 3 -> 17
            { utf8: 'ほら', tOffsetMs: 3520 }, // 2 -> 19
            { utf8: '雨', tOffsetMs: 4440 }, // 1 -> 20
            { utf8: 'の', tOffsetMs: 5239 }, // 1 -> 21
            { utf8: 'れて', tOffsetMs: 6159 }, // 2 -> 23
            { utf8: '虹', tOffsetMs: 6520 }, // 1 -> 24
            { utf8: 'が', tOffsetMs: 7159 }, // 1 -> 25
            { utf8: 'かかる', tOffsetMs: 8000 }, // 3 -> 28
            { utf8: 'ワン', tOffsetMs: 9000 }, // 2 -> 30 (triggers split)
            { utf8: 'ツー', tOffsetMs: 9400 }, // 2
          ],
        },
        { tStartMs: 16950, dDurationMs: 5370, wWinId: 1, aAppend: 1, segs: [{ utf8: '\n' }] },
      ]
      const result = parseScrollingAsrSubtitles(events, 'ja')

      // Should split when character count reaches 30
      expect(result.length).toBeGreaterThan(1)
      expect(result[0].text.length).toBeLessThanOrEqual(30)
    })
  })

  describe('standard Format + Optimizer', () => {
    it('should merge consecutive fragments', () => {
      const fragments = [
        { text: 'Hello', start: 0, end: 500 },
        { text: 'world.', start: 500, end: 1000 },
      ]
      const result = optimizeSubtitles(fragments, 'en')

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('Hello world.')
    })

    it('should split on sentence boundaries', () => {
      const fragments = [
        { text: 'First sentence.', start: 0, end: 1000 },
        { text: 'Second sentence.', start: 1000, end: 2000 },
      ]
      const result = optimizeSubtitles(fragments, 'en')

      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('First sentence.')
      expect(result[1].text).toBe('Second sentence.')
    })

    it('should split on timeout (gap > 1000ms)', () => {
      const fragments = [
        { text: 'First part', start: 0, end: 1000 },
        { text: 'Second part', start: 2500, end: 3500 },
      ]
      const result = optimizeSubtitles(fragments, 'en')

      expect(result).toHaveLength(2)
    })

    it('should handle CJK languages (no space separator)', () => {
      const fragments = [
        { text: '今日は', start: 0, end: 500 },
        { text: '晴れです。', start: 500, end: 1000 },
      ]
      const result = optimizeSubtitles(fragments, 'ja')

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('今日は晴れです。')
    })

    it('should split Chinese on timeout', () => {
      const fragments = [
        { text: '你好', start: 0, end: 500 },
        { text: '很高兴认识你', start: 2000, end: 3000 }, // gap > 1000ms
      ]
      const result = optimizeSubtitles(fragments, 'zh')

      expect(result).toHaveLength(2)
      expect(result[0].text).toBe('你好')
      expect(result[1].text).toBe('很高兴认识你')
    })

    it('should return empty array for empty input', () => {
      const result = optimizeSubtitles([], 'en')
      expect(result).toEqual([])
    })
  })
})
