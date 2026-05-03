/**
 * База GraphHopper без завершающего слэша (для `…/route`).
 */
export function normalizeGraphhopperBaseUrl(url: string | undefined | null): string | null {
  if (url == null || typeof url !== 'string') return null
  const t = url.trim()
  if (!t) return null
  return t.replace(/\/+$/, '')
}
