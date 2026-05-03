import type { StyleSpecification } from 'maplibre-gl'

export const DEMO_STYLE_URL = 'https://demotiles.maplibre.org/style.json'

export async function fetchStyleFromUrl(styleUrl: string): Promise<StyleSpecification> {
  const res = await fetch(styleUrl)
  if (!res.ok) {
    throw new Error(`Не удалось загрузить стиль (${styleUrl}): HTTP ${res.status}`)
  }
  return res.json() as Promise<StyleSpecification>
}

export async function fetchDemoStyle(): Promise<StyleSpecification> {
  return fetchStyleFromUrl(DEMO_STYLE_URL)
}
