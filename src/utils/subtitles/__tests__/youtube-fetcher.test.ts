// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { SUBTITLE_INTERCEPT_MESSAGE_TYPE } from '@/utils/constants/subtitles'
import { YoutubeSubtitlesFetcher } from '../fetchers/youtube'

function createCcButton() {
  const button = document.createElement('button')
  button.className = 'ytp-subtitles-button'
  button.setAttribute('aria-pressed', 'false')
  button.setAttribute('aria-disabled', 'false')
  document.body.appendChild(button)
  return button
}

describe('youtube subtitles fetcher', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('ignores unrelated postMessage events while waiting', async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    fetcher.initialize()
    createCcButton()

    const promise = fetcher.fetch()

    let settled: 'resolved' | 'rejected' | null = null
    void promise.then(
      () => {
        settled = 'resolved'
      },
      () => {
        settled = 'rejected'
      },
    )

    window.dispatchEvent(new MessageEvent('message', {
      data: { foo: 'bar' },
      origin: window.location.origin,
    }))

    await Promise.resolve()
    expect(settled).toBeNull()

    fetcher.cleanup()
  })

  it('does not miss interceptor messages dispatched synchronously from click', async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    fetcher.initialize()

    const ccButton = createCcButton()
    ccButton.addEventListener('click', () => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          type: SUBTITLE_INTERCEPT_MESSAGE_TYPE,
          payload: '',
          lang: 'en',
          kind: '',
          url: `${window.location.origin}/api/timedtext?v=abc`,
          errorStatus: 404,
        },
      }))
    })

    await expect(fetcher.fetch()).rejects.toThrow('subtitles.errors.http404')

    fetcher.cleanup()
  })
})
