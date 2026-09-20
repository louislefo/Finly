import { Style, Avatar } from "@dicebear/core"
import lineFaceDefinition from "@dicebear/styles/line-face.json"

const lineFaceStyle = new Style(lineFaceDefinition)

/**
 * Generates a Line Face avatar as a data URI for a given seed.
 * Deterministic: the same seed always produces the same avatar.
 */
export function getLineFaceAvatarUri(seed: string): string {
  try {
    const avatar = new Avatar(lineFaceStyle, {
      seed: seed.trim().toLowerCase(),
    })
    return avatar.toDataUri()
  } catch {
    return ""
  }
}

/**
 * Generates a Line Face avatar as raw SVG string.
 */
export function getLineFaceAvatarSvg(seed: string): string {
  try {
    const avatar = new Avatar(lineFaceStyle, {
      seed: seed.trim().toLowerCase(),
    })
    return avatar.toString()
  } catch {
    return ""
  }
}
