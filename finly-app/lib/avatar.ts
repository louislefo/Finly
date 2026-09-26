import { Style, Avatar } from "@dicebear/core"
import lineFaceDefinition from "@dicebear/styles/line-face.json"

const lineFaceStyle = new Style(lineFaceDefinition)

export const DEFAULT_LINE_FACE_SEEDS = [
  "felix",
  "luna",
  "oliver",
  "maya",
  "alex",
  "chloe",
  "milo",
  "sophie",
  "leo",
  "nina",
  "sam",
  "emma",
  "noah",
  "zoe",
  "lucas",
  "eva",
]

/**
 * Returns a random line face seed from the curated pool.
 */
export function getRandomLineFaceSeed(): string {
  const index = Math.floor(Math.random() * DEFAULT_LINE_FACE_SEEDS.length)
  return DEFAULT_LINE_FACE_SEEDS[index]
}

/**
 * Generates a Line Face avatar as a data URI for a given seed or returns custom image URI.
 * Deterministic: the same seed always produces the same avatar.
 */
export function getLineFaceAvatarUri(seedOrUrl?: string | null): string {
  if (!seedOrUrl) return ""
  const trimmed = seedOrUrl.trim()
  if (!trimmed) return ""

  // If already a custom data URI, remote URL or static path, return directly
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }

  try {
    const avatar = new Avatar(lineFaceStyle, {
      seed: trimmed.toLowerCase(),
    })
    return avatar.toDataUri()
  } catch {
    return ""
  }
}

/**
 * Generates a Line Face avatar as raw SVG string.
 */
export function getLineFaceAvatarSvg(seedOrUrl?: string | null): string {
  if (!seedOrUrl) return ""
  const trimmed = seedOrUrl.trim()
  if (!trimmed) return ""

  if (trimmed.startsWith("<svg")) {
    return trimmed
  }

  try {
    const avatar = new Avatar(lineFaceStyle, {
      seed: trimmed.toLowerCase(),
    })
    return avatar.toString()
  } catch {
    return ""
  }
}
