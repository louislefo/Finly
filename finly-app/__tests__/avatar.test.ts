import { describe, it, expect } from "vitest"
import {
  DEFAULT_LINE_FACE_SEEDS,
  getRandomLineFaceSeed,
  getLineFaceAvatarUri,
  getLineFaceAvatarSvg,
} from "@/lib/avatar"

describe("Avatar Utilities", () => {
  it("provides a default line face seeds collection", () => {
    expect(DEFAULT_LINE_FACE_SEEDS).toBeDefined()
    expect(DEFAULT_LINE_FACE_SEEDS.length).toBeGreaterThan(5)
    expect(DEFAULT_LINE_FACE_SEEDS).toContain("felix")
    expect(DEFAULT_LINE_FACE_SEEDS).toContain("luna")
  })

  it("generates a random line face seed from the collection", () => {
    const seed = getRandomLineFaceSeed()
    expect(typeof seed).toBe("string")
    expect(DEFAULT_LINE_FACE_SEEDS).toContain(seed)
  })

  it("generates deterministic data URI for a given seed", () => {
    const uri1 = getLineFaceAvatarUri("felix")
    const uri2 = getLineFaceAvatarUri("felix")
    const uriOther = getLineFaceAvatarUri("luna")

    expect(uri1).toBeTruthy()
    expect(uri1).toBe(uri2)
    expect(uri1).not.toBe(uriOther)
    expect(uri1.startsWith("data:image/svg+xml")).toBe(true)
  })

  it("returns empty string for empty or missing seed", () => {
    expect(getLineFaceAvatarUri("")).toBe("")
    expect(getLineFaceAvatarUri(null as any)).toBe("")
    expect(getLineFaceAvatarUri(undefined as any)).toBe("")
  })

  it("preserves custom image data URIs, URLs, and relative paths directly", () => {
    const customDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
    const remoteUrl = "https://example.com/avatar.png"
    const staticPath = "/custom-avatar.png"

    expect(getLineFaceAvatarUri(customDataUri)).toBe(customDataUri)
    expect(getLineFaceAvatarUri(remoteUrl)).toBe(remoteUrl)
    expect(getLineFaceAvatarUri(staticPath)).toBe(staticPath)
  })

  it("generates raw SVG string for seeds", () => {
    const svg = getLineFaceAvatarSvg("oliver")
    expect(svg).toBeTruthy()
    expect(svg.includes("<svg")).toBe(true)
  })
})
