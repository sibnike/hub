export const MAX_SVG_BYTES = 2 * 1024 * 1024

export function validateSvgSize(content: string): string | null {
  const bytes = new TextEncoder().encode(content).length
  if (bytes > MAX_SVG_BYTES) {
    return `SVG слишком большой (${Math.round(bytes / 1024)} КБ). Максимум ${MAX_SVG_BYTES / 1024 / 1024} МБ`
  }
  return null
}
