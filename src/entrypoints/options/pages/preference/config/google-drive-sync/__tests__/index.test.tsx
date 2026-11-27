// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isGoogleDriveSyncSupported } from "@/utils/google-drive/auth"
import { GoogleDriveSyncConfigItem } from ".."

const { useGoogleDriveAuthMock } = vi.hoisted(() => ({
  useGoogleDriveAuthMock: vi.fn<() => unknown>(() => ({
    query: { data: { isAuthenticated: false, userInfo: null } },
    invalidate: async () => {},
  })),
}))

vi.mock("@/utils/google-drive/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/google-drive/auth")>()),
  isGoogleDriveSyncSupported: vi.fn<() => boolean>(),
}))

vi.mock("@/hooks/use-google-drive-auth", () => ({ useGoogleDriveAuth: useGoogleDriveAuthMock }))

vi.mock("../use-glossary-sync", () => ({
  useGlossarySync: () => ({
    pendingPlan: null,
    start: async () => {},
    cancel: () => {},
    confirm: async () => {},
  }),
}))

vi.mock("../components/unresolved-dialog", () => ({ UnresolvedDialog: () => null }))

vi.mock("../components/glossary-review-dialog", () => ({ GlossarySyncReviewDialog: () => null }))

describe("GoogleDriveSyncConfigItem", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("says sync isn't available yet, and doesn't set up sign-in, where the browser can't sign in to Google", () => {
    vi.mocked(isGoogleDriveSyncSupported).mockReturnValue(false)

    render(<GoogleDriveSyncConfigItem />)

    expect(
      screen.getByText("options.preference.config.googleDrive.unsupported"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "options.preference.config.googleDrive.sync" }),
    ).toBeDisabled()
    expect(useGoogleDriveAuthMock).not.toHaveBeenCalled()
  })

  it("offers sync where the browser can sign in to Google", () => {
    vi.mocked(isGoogleDriveSyncSupported).mockReturnValue(true)

    render(<GoogleDriveSyncConfigItem />)

    expect(
      screen.getByRole("button", { name: "options.preference.config.googleDrive.sync" }),
    ).toBeEnabled()
    expect(
      screen.queryByText("options.preference.config.googleDrive.unsupported"),
    ).not.toBeInTheDocument()
  })
})
