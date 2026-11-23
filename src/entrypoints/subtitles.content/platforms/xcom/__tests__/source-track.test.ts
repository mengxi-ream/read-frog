import { describe, expect, it } from "vitest"
import {
  XCOM_AUTO_GENERATED_TRACK_MARK,
  XCOM_RENDER_TRACK_LABEL,
} from "@/utils/constants/subtitles"
import { isXcomSourceTrack } from ".."

// Kinds and labels as X's player reports them, read from its tracks on x.com.
describe("isXcomSourceTrack", () => {
  it.each([
    { kind: "subtitles", label: "Voyager_One Light Day Activation_UHD for Social.en_US.srt" },
    { kind: "subtitles", label: `en ${XCOM_AUTO_GENERATED_TRACK_MARK}` },
  ] as const)("reads the uploaded or generated track $label", (track) => {
    expect(isXcomSourceTrack(track)).toBe(true)
  })

  it.each([
    { kind: "captions", label: "SERVICE1" },
    { kind: "subtitles", label: XCOM_RENDER_TRACK_LABEL },
  ] as const)("leaves the $kind track $label", (track) => {
    expect(isXcomSourceTrack(track)).toBe(false)
  })
})
