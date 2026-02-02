// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { PLAYER_DATA_REQUEST_TYPE, PLAYER_DATA_RESPONSE_TYPE } from '@/utils/constants/subtitles'
import { YoutubeSubtitlesFetcher } from '../fetchers/youtube'

describe('youtube subtitles fetcher', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('ignores unrelated postMessage events while waiting', async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, 'location', {
      value: { search: '?v=test123', origin: 'https://www.youtube.com', pathname: '/watch', hostname: 'www.youtube.com' },
      writable: true,
    })

    const promise = fetcher.fetch()

    let settled: 'resolved' | 'rejected' | null = null
    void promise.then(
      () => { settled = 'resolved' },
      () => { settled = 'rejected' },
    )

    window.dispatchEvent(new MessageEvent('message', {
      data: { foo: 'bar' },
      origin: window.location.origin,
    }))

    await Promise.resolve()
    expect(settled).toBeNull()

    fetcher.cleanup()
  })

  it('handles player data response correctly', async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, 'location', {
      value: { search: '?v=test123', origin: 'https://www.youtube.com', pathname: '/watch', hostname: 'www.youtube.com' },
      writable: true,
    })

    window.addEventListener('message', (event) => {
      if (event.data?.type === PLAYER_DATA_REQUEST_TYPE) {
        window.dispatchEvent(new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            type: PLAYER_DATA_RESPONSE_TYPE,
            requestId: event.data.requestId,
            success: false,
            error: 'PLAYER_NOT_FOUND',
          },
        }))
      }
    })

    await expect(fetcher.fetch()).rejects.toThrow('subtitles.errors.fetchSubTimeout')

    fetcher.cleanup()
  })
})
