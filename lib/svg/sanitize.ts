import DOMPurify from 'isomorphic-dompurify'

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover'],
    ADD_TAGS: ['use'],
  })
}

export function extractSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/)
  if (!match) return null
  const parts = match[1].split(/\s+/).map(Number)
  if (parts.length !== 4) return null
  return { width: parts[2], height: parts[3] }
}

export function ensureSvgViewBox(svg: string): string {
  if (extractSvgViewBox(svg)) return svg
  return svg.replace(/<svg([^>]*)>/i, '<svg$1 viewBox="0 0 1000 700">')
}

export function isValidSvg(svg: string): boolean {
  return /<svg[\s>]/i.test(svg)
}
