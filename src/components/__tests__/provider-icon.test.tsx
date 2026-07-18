// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ProviderIcon from "../provider-icon"

const {
  resolveContentScriptAssetBlobMock,
  shouldProxyAssetUrlMock,
  createImageBitmapMock,
  clearRectMock,
  drawImageMock,
  setTransformMock,
} = vi.hoisted(() => ({
  resolveContentScriptAssetBlobMock: vi.fn<(...args: any[]) => any>(),
  shouldProxyAssetUrlMock: vi.fn<(...args: any[]) => any>(),
  createImageBitmapMock: vi.fn<(...args: any[]) => any>(),
  clearRectMock: vi.fn<(...args: any[]) => any>(),
  drawImageMock: vi.fn<(...args: any[]) => any>(),
  setTransformMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/content-script/background-asset-url", () => ({
  resolveContentScriptAssetBlob: resolveContentScriptAssetBlobMock,
  shouldProxyAssetUrl: shouldProxyAssetUrlMock,
}))

describe("provider icon", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("createImageBitmap", createImageBitmapMock)
    Object.defineProperty(globalThis, "devicePixelRatio", {
      configurable: true,
      value: 1,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn<(...args: any[]) => any>(() => ({
        clearRect: clearRectMock,
        drawImage: drawImageMock,
        setTransform: setTransformMock,
      })),
    })
  })

  it("renders a normal image when the logo does not need proxying", () => {
    shouldProxyAssetUrlMock.mockReturnValue(false)

    render(<ProviderIcon logo="https://cdn.example.com/logo.webp" name="OpenAI" size="md" />)

    expect(screen.getByRole("img", { name: "OpenAI" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/logo.webp",
    )
    expect(resolveContentScriptAssetBlobMock).not.toHaveBeenCalled()
  })

  it("normalizes local extension asset paths before rendering", () => {
    shouldProxyAssetUrlMock.mockReturnValue(false)

    render(<ProviderIcon logo="/assets/providers/deeplx-light.svg" name="DeepLX" size="md" />)

    const image = screen.getByRole("img", { name: "DeepLX" })
    expect(image.getAttribute("src")).not.toBe("/assets/providers/deeplx-light.svg")
    expect(image.getAttribute("src")).toMatch(/assets\/providers\/deeplx-light\.svg$/)
  })

  it("renders proxied logos through a canvas instead of an img tag", async () => {
    const bitmap = {
      width: 32,
      height: 16,
      close: vi.fn<(...args: any[]) => any>(),
    }

    shouldProxyAssetUrlMock.mockReturnValue(true)
    resolveContentScriptAssetBlobMock.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3])], { type: "image/webp" }),
    )
    createImageBitmapMock.mockResolvedValue(bitmap)

    const view = render(
      <ProviderIcon logo="https://cdn.example.com/logo.webp" name="OpenAI" size="md" />,
    )

    await waitFor(() => {
      expect(resolveContentScriptAssetBlobMock).toHaveBeenCalledWith(
        "https://cdn.example.com/logo.webp",
      )
    })
    await waitFor(() => {
      expect(drawImageMock).toHaveBeenCalledWith(bitmap, 0, 5, 20, 10)
    })

    expect(view.container.querySelector("canvas")).toBeInTheDocument()
    expect(view.container.querySelector("img")).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "OpenAI" }).tagName).toBe("CANVAS")

    view.unmount()
    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })
})
