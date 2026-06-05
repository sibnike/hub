const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  қ: 'k', ғ: 'g', ү: 'u', ұ: 'u', ө: 'o', һ: 'h',
}

function transliterateChar(ch: string): string {
  const lower = ch.toLowerCase()
  if (CYRILLIC_MAP[lower] !== undefined) return CYRILLIC_MAP[lower]
  return lower
}

export function slugFromTitle(title: string): string {
  const transliterated = Array.from(title.trim())
    .map((ch) => (/[a-zA-Z0-9]/.test(ch) ? ch.toLowerCase() : transliterateChar(ch)))
    .join('')

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)

  return slug || 'event'
}

export function isValidEventSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug)
}
