const OMIT = Symbol('omit-masked-value')

export function isMaskedSecret(value: unknown): value is string {
  return typeof value === 'string' && /^\*+$/.test(value.trim())
}

function sanitize(original: unknown, edited: unknown): unknown | typeof OMIT {
  if (isMaskedSecret(original)) {
    if (edited === '' || edited === original || isMaskedSecret(edited)) return OMIT
    return edited
  }

  if (Array.isArray(edited)) {
    return edited
      .map((item, index) => sanitize(Array.isArray(original) ? original[index] : undefined, item))
      .filter((item) => item !== OMIT)
  }

  if (edited && typeof edited === 'object') {
    const originalObject =
      original && typeof original === 'object' && !Array.isArray(original)
        ? (original as Record<string, unknown>)
        : {}
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(edited as Record<string, unknown>)) {
      const sanitized = sanitize(originalObject[key], value)
      if (sanitized !== OMIT) result[key] = sanitized
    }
    return result
  }

  return edited
}

export function stripUnchangedMaskedSecrets(originalJson: string, editedJson: string) {
  try {
    const original = JSON.parse(originalJson) as unknown
    const edited = JSON.parse(editedJson) as unknown
    return JSON.stringify(sanitize(original, edited), null, 2)
  } catch {
    return editedJson
  }
}
