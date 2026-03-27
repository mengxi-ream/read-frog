// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

import { renderPersistentReactRoot, unmountPersistentReactRoot } from "../react-root"

const createRootMock = vi.hoisted(() => vi.fn())

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}))

const REACT_ROOT_REGISTRY_KEY = Symbol.for("read-frog.react-root-registry")

function createMockRoot() {
  return {
    render: vi.fn(),
    unmount: vi.fn(),
  }
}

describe("react root registry", () => {
  afterEach(() => {
    createRootMock.mockReset()
    delete (globalThis as Record<PropertyKey, unknown>)[REACT_ROOT_REGISTRY_KEY]
    document.body.innerHTML = ""
  })

  it("reuses the same root for repeated renders on one container", () => {
    const root = createMockRoot()
    createRootMock.mockReturnValue(root)
    const container = document.createElement("div")

    renderPersistentReactRoot(container, "first render")
    renderPersistentReactRoot(container, "second render")

    expect(createRootMock).toHaveBeenCalledTimes(1)
    expect(createRootMock).toHaveBeenCalledWith(container)
    expect(root.render).toHaveBeenNthCalledWith(1, "first render")
    expect(root.render).toHaveBeenNthCalledWith(2, "second render")
  })

  it("creates separate roots for different containers", () => {
    const firstRoot = createMockRoot()
    const secondRoot = createMockRoot()
    createRootMock
      .mockReturnValueOnce(firstRoot)
      .mockReturnValueOnce(secondRoot)

    const firstContainer = document.createElement("div")
    const secondContainer = document.createElement("div")

    renderPersistentReactRoot(firstContainer, "first")
    renderPersistentReactRoot(secondContainer, "second")

    expect(createRootMock).toHaveBeenCalledTimes(2)
    expect(firstRoot.render).toHaveBeenCalledWith("first")
    expect(secondRoot.render).toHaveBeenCalledWith("second")
  })

  it("unmounts and removes a cached root so the container can create a new one later", () => {
    const firstRoot = createMockRoot()
    const secondRoot = createMockRoot()
    createRootMock
      .mockReturnValueOnce(firstRoot)
      .mockReturnValueOnce(secondRoot)

    const container = document.createElement("div")

    renderPersistentReactRoot(container, "first")
    unmountPersistentReactRoot(container)
    renderPersistentReactRoot(container, "second")

    expect(firstRoot.unmount).toHaveBeenCalledTimes(1)
    expect(createRootMock).toHaveBeenCalledTimes(2)
    expect(secondRoot.render).toHaveBeenCalledWith("second")
  })
})
