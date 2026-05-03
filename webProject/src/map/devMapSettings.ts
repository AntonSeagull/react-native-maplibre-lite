import type { StyleSpecification } from 'maplibre-gl';

import { isDEV } from '../devFlags';
import {
  DEMO_STYLE_URL,
  fetchStyleFromUrl,
} from './demoStyle';
import { normalizeGraphhopperBaseUrl } from './graphhopperUrl';

const LS_MAP_STYLE_URL = 'maplite-dev-mapStyleUrl'
const LS_GRAPHHOPPER_BASE = 'maplite-dev-graphhopperUrl'

function assertDevUi(): void {
  if (!isDEV) {
    throw new Error('devMapSettings: только для локальной панели (localhost:5175)')
  }
}

function readDevStoredMapStyleUrl(): string | null {
  try {
    const v = localStorage.getItem(LS_MAP_STYLE_URL)
    const t = v?.trim()
    return t || null
  } catch {
    return null
  }
}

function readDevStoredGraphhopperUrl(): string | null {
  try {
    const v = localStorage.getItem(LS_GRAPHHOPPER_BASE)
    const t = v?.trim()
    return t || null
  } catch {
    return null
  }
}

/**
 * Стиль карты: из localStorage или один prompt; при отмене prompt — демо-стиль без записи в LS.
 */
export async function resolveDevMapStyle(): Promise<StyleSpecification> {
  assertDevUi()
  let urlToUse = readDevStoredMapStyleUrl()
  if (!urlToUse) {
    const entered = window.prompt(
      'URL стиля карты (style.json).\nПример: https://demotiles.maplibre.org/style.json',
      DEMO_STYLE_URL
    )
    if (entered === null) {
      urlToUse = DEMO_STYLE_URL
    } else {
      urlToUse = entered.trim() || DEMO_STYLE_URL
      try {
        localStorage.setItem(LS_MAP_STYLE_URL, urlToUse)
      } catch {
        /* ignore */
      }
    }
  }
  return fetchStyleFromUrl(urlToUse)
}

/**
 * Базовый URL GraphHopper для навигатора: из localStorage или prompt.
 * При отмене / пустом вводе — undefined (маршруты через API недоступны).
 */
export function resolveDevGraphhopperUrl(): string | undefined {
  assertDevUi()
  const stored = normalizeGraphhopperBaseUrl(readDevStoredGraphhopperUrl())
  if (stored) return stored

  const entered = window.prompt(
    'Базовый URL GraphHopper (без пути /route)'
  )
  if (entered === null) return undefined
  const n = normalizeGraphhopperBaseUrl(entered)
  if (!n) return undefined
  try {
    localStorage.setItem(LS_GRAPHHOPPER_BASE, n)
  } catch {
    /* ignore */
  }
  return n
}
