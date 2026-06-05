export type CsvParticipant = {
  email: string
  stand_number?: string
  pavilion?: string
  floor?: number
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }

  fields.push(current.trim())
  return fields
}

export function parseParticipantsCsv(text: string): CsvParticipant[] {
  const normalized = stripBom(text)
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const first = lines[0].toLowerCase()
  const hasHeader = first.includes('email')
  const rows = hasHeader ? lines.slice(1) : lines

  const parsed: CsvParticipant[] = []
  for (const line of rows) {
    const parts = parseCsvLine(line)
    const email = parts[0]?.toLowerCase()
    if (!email || !email.includes('@')) continue
    parsed.push({
      email,
      stand_number: parts[1] || undefined,
      pavilion: parts[2] || undefined,
      floor: parts[3] ? parseInt(parts[3], 10) : undefined,
    })
  }
  return parsed
}
