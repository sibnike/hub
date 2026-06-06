import sanitizeHtml from 'sanitize-html'

const ALLOWED_SVG_TAGS = [
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'filter',
  'feGaussianBlur',
  'feOffset',
  'feBlend',
  'feMerge',
  'feMergeNode',
  'feColorMatrix',
  'feFlood',
  'feComposite',
  'pattern',
  'mask',
  'clipPath',
  'image',
]

const ALLOWED_SVG_ATTRS = [
  'id',
  'class',
  'style',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
  'd',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-opacity',
  'fill-opacity',
  'opacity',
  'transform',
  'preserveAspectRatio',
  'xmlns',
  'xmlns:xlink',
  'version',
  'href',
  'xlink:href',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'offset',
  'stop-color',
  'stop-opacity',
  'in',
  'in2',
  'result',
  'mode',
  'type',
  'values',
  'stdDeviation',
  'flood-color',
  'flood-opacity',
  'patternUnits',
  'patternContentUnits',
  'maskUnits',
  'clipPathUnits',
  'text-anchor',
  'font-family',
  'font-size',
  'font-weight',
  'dominant-baseline',
  'alignment-baseline',
  'data-stand-id',
  'data-pavilion',
]

export function sanitizeSvg(svg: string): string {
  return sanitizeHtml(svg, {
    allowedTags: ALLOWED_SVG_TAGS,
    allowedAttributes: ALLOWED_SVG_TAGS.reduce(
      (acc, tag) => {
        acc[tag] = ALLOWED_SVG_ATTRS
        return acc
      },
      {} as Record<string, string[]>
    ),
    allowedSchemes: ['data', 'https'],
    allowedSchemesByTag: {
      image: ['data', 'https'],
      use: ['data'],
    },
    disallowedTagsMode: 'discard',
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
  })
}

export function extractSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/i)
  if (!match) return null
  const parts = match[1].split(/\s+/).map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return { width: parts[2], height: parts[3] }
}

export function ensureSvgViewBox(svg: string): string {
  if (extractSvgViewBox(svg)) return svg
  return svg.replace(/<svg([^>]*)>/i, '<svg$1 viewBox="0 0 1000 700">')
}

export function isValidSvg(svg: string): boolean {
  return /<svg[\s>]/i.test(svg)
}
