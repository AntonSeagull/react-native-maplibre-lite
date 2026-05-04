import './navigator.css';

import maplibregl, {
  type Map,
  type Marker,
} from 'maplibre-gl';

import {
  navigatorStrings,
  normalizeNavigatorLang,
  type NavigatorLang,
  type NavigatorStrings,
} from './local'

/** [longitude, latitude] — единый формат для Navigator (как в GeoJSON / GraphHopper). */
export type NavigatorPoint = [number, number]

/** Допустимые значения `profile` для GraphHopper `POST …/route` (см. документацию GH). */
export const NAVIGATOR_PROFILE_IDS = [
  'car',
  'car_avoid_motorway',
  'car_avoid_ferry',
  'car_avoid_toll',
  'small_truck',
  'truck',
  'scooter',
  'foot',
  'hike',
  'bike',
  'mtb',
  'racingbike',
  'ecargobike',
] as const

export type NavigatorProfile = (typeof NAVIGATOR_PROFILE_IDS)[number]

/** `init.navigatorProfile` / опция `Navigator`: неизвестное или отсутствие → `car`. */
export function normalizeNavigatorProfile(value: unknown): NavigatorProfile {
  if (typeof value !== 'string') return 'car'
  const v = value.trim()
  return (NAVIGATOR_PROFILE_IDS as readonly string[]).includes(v)
    ? (v as NavigatorProfile)
    : 'car'
}

/**
 * Поворотная инструкция от GraphHopper. Поля документированы тут:
 * https://docs.graphhopper.com/#operation/postRoute (раздел `instructions`).
 *  - `interval[0..1]` — индексы в `paths[0].points.coordinates`, на которые
 *    распространяется эта инструкция;
 *  - `sign` — числовой код манёвра (см. `local.ts` / `getSignIcon`).
 */
export type GraphHopperInstruction = {
  text: string
  street_name?: string
  distance: number
  time: number
  interval: [number, number]
  sign: number
  exit_number?: number
  turn_angle?: number
}

const NAV_ROUTE_SOURCE = 'maplite-navigator-route'
const NAV_ROUTE_LAYER = 'maplite-navigator-route-line'
const NAV_ROUTE_LAYER_BG = 'maplite-navigator-route-bg'

type Rgb = { r: number; g: number; b: number }

const DEF_ROUTE_LINE = '#3b82f6'
const DEF_ROUTE_OUTLINE = '#1e3a8a'
const DEF_ACCENT = '#3b82f6'
const DEF_HUD_BG = 'rgba(15, 23, 42, 0.92)'
const DEF_HUD_FG = '#f8fafc'
const DEF_HUD_MUTED = '#94a3b8'
const DEF_HUD_SUBTLE = '#e2e8f0'
const DEF_HUD_SUMMARY = '#cbd5e1'
const RGB_WHITE: Rgb = { r: 255, g: 255, b: 255 }
const RGB_NEAR_BLACK: Rgb = { r: 2, g: 6, b: 23 }
const RGB_SLATE_SHADOW: Rgb = { r: 15, g: 23, b: 42 }

/** Крупная стрелка только в режиме навигатора (экземпляр `Navigator`). */
const ARROW_BASE_SIZE_PX = 72

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: clamp255(a.r + (b.r - a.r) * t),
    g: clamp255(a.g + (b.g - a.g) * t),
    b: clamp255(a.b + (b.b - a.b) * t),
  }
}

function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Только `#rgb` / `#rrggbb` — для `accent` и смешивания HUD. */
function parseHexColor(input: string | undefined): Rgb | null {
  if (typeof input !== 'string') return null
  const s = input.trim()
  if (!/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s)) return null
  if (s.length === 4) {
    const r = parseInt(s[1]! + s[1]!, 16)
    const g = parseInt(s[2]! + s[2]!, 16)
    const b = parseInt(s[3]! + s[3]!, 16)
    return { r, g, b }
  }
  return {
    r: parseInt(s.slice(1, 3), 16),
    g: parseInt(s.slice(3, 5), 16),
    b: parseInt(s.slice(5, 7), 16),
  }
}

function relLuminance(c: Rgb): number {
  const lin = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  const R = lin(c.r)
  const G = lin(c.g)
  const B = lin(c.b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function rgba(rgb: Rgb, a: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
}

function mixCssHexOr(
  a: string,
  b: string,
  t: number,
  fallback: string
): string {
  const ra = parseHexColor(a)
  const rb = parseHexColor(b)
  if (!ra || !rb) return fallback
  return toHex(mixRgb(ra, rb, t))
}

function dividerFromMutedCss(muted: string): string {
  const m = parseHexColor(muted)
  if (m) return rgba(m, 0.28)
  return 'rgba(148, 163, 184, 0.28)'
}

/**
 * Необязательное оформление навигатора (маршрут, стрелка, верхняя панель).
 * Знак скорости не настраивается — стиль как в CSS по умолчанию.
 */
export type NavigatorChromeParams = {
  /** Акцент: градиент стрелки на карте + плитка иконки манёвра в HUD. */
  accent?: string
  /** Основная линия маршрута. */
  routeLine?: string
  /** Подложка линии (шире, полупрозрачная). */
  routeOutline?: string
  /** Фон панели инструкций (любой валидный CSS `background`). */
  hudBackground?: string
  /** Цвет основных подписей на панели. */
  hudForeground?: string
  /** Приглушённые подписи (улица, сводка, ETA). */
  hudMuted?: string
}

type ResolvedNavigatorChrome = {
  routeLine: string
  routeOutline: string
  arrow: {
    halo: [Rgb, Rgb, Rgb]
    haloOp: [number, number, number]
    face: [Rgb, Rgb, Rgb]
    depth: [Rgb, Rgb]
    stroke: string
    dropShadow: string
  }
  hudVars: Record<string, string>
}

function resolveNavigatorChrome(
  input?: NavigatorChromeParams | null
): ResolvedNavigatorChrome {
  const accentRgb =
    parseHexColor(input?.accent) ?? parseHexColor(DEF_ACCENT) ?? { r: 59, g: 130, b: 246 }

  const routeLine =
    typeof input?.routeLine === 'string' && input.routeLine.trim()
      ? input.routeLine.trim()
      : DEF_ROUTE_LINE
  const routeOutline =
    typeof input?.routeOutline === 'string' && input.routeOutline.trim()
      ? input.routeOutline.trim()
      : DEF_ROUTE_OUTLINE

  const hudBackground =
    typeof input?.hudBackground === 'string' && input.hudBackground.trim()
      ? input.hudBackground.trim()
      : DEF_HUD_BG
  const hudForeground =
    typeof input?.hudForeground === 'string' && input.hudForeground.trim()
      ? input.hudForeground.trim()
      : DEF_HUD_FG
  const hudMuted =
    typeof input?.hudMuted === 'string' && input.hudMuted.trim()
      ? input.hudMuted.trim()
      : DEF_HUD_MUTED

  const hudSubtle = mixCssHexOr(hudForeground, hudMuted, 0.52, DEF_HUD_SUBTLE)
  const hudSummary = mixCssHexOr(hudForeground, hudMuted, 0.3, DEF_HUD_SUMMARY)
  const hudDivider = dividerFromMutedCss(hudMuted)

  const iconFg = toHex(mixRgb(accentRgb, RGB_WHITE, 0.38))
  const iconBg = rgba(accentRgb, 0.18)

  const faceMid = mixRgb(accentRgb, RGB_NEAR_BLACK, 0.22)
  const stroke = relLuminance(faceMid) > 0.52 ? '#0f172a' : '#f8fafc'
  const shadowRgb = mixRgb(accentRgb, RGB_SLATE_SHADOW, 0.55)

  const arrow = {
    halo: [
      mixRgb(accentRgb, RGB_WHITE, 0.48),
      accentRgb,
      mixRgb(accentRgb, RGB_NEAR_BLACK, 0.45),
    ] as [Rgb, Rgb, Rgb],
    haloOp: [0.42, 0.14, 0] as [number, number, number],
    face: [
      mixRgb(accentRgb, RGB_WHITE, 0.78),
      faceMid,
      mixRgb(accentRgb, RGB_NEAR_BLACK, 0.82),
    ] as [Rgb, Rgb, Rgb],
    depth: [mixRgb(accentRgb, RGB_NEAR_BLACK, 0.48), RGB_NEAR_BLACK] as [Rgb, Rgb],
    stroke,
    dropShadow: `drop-shadow(0 4px 6px ${rgba(shadowRgb, 0.45)})`,
  }

  return {
    routeLine,
    routeOutline,
    arrow,
    hudVars: {
      '--nav-hud-bg': hudBackground,
      '--nav-hud-fg': hudForeground,
      '--nav-hud-subtle': hudSubtle,
      '--nav-hud-muted': hudMuted,
      '--nav-hud-summary': hudSummary,
      '--nav-hud-divider': hudDivider,
      '--nav-hud-icon-bg': iconBg,
      '--nav-hud-icon-fg': iconFg,
    },
  }
}

function applyNavigatorHudTheme(
  el: HTMLElement,
  chrome: ResolvedNavigatorChrome
): void {
  for (const [k, v] of Object.entries(chrome.hudVars)) {
    el.style.setProperty(k, v)
  }
}

function createArrowElement(
  gradientUid: string,
  chrome: ResolvedNavigatorChrome
): HTMLElement {
  const { arrow } = chrome
  const h = arrow.halo
  const f = arrow.face
  const d = arrow.depth
  const idHalo = `maplite-nav-halo-${gradientUid}`
  const idFace = `maplite-nav-arrow-face-${gradientUid}`
  const idDepth = `maplite-nav-arrow-depth-${gradientUid}`

  const el = document.createElement('div')
  el.style.width = `${ARROW_BASE_SIZE_PX}px`
  el.style.height = `${ARROW_BASE_SIZE_PX}px`
  el.style.willChange = 'transform'
  el.style.pointerEvents = 'none'
  el.style.filter = arrow.dropShadow
  el.innerHTML = `
    <svg width="${ARROW_BASE_SIZE_PX}" height="${ARROW_BASE_SIZE_PX}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="${idHalo}" cx="50%" cy="52%" r="52%">
          <stop offset="0%" stop-color="${toHex(h[0]!)}" stop-opacity="${arrow.haloOp[0]}"/>
          <stop offset="55%" stop-color="${toHex(h[1]!)}" stop-opacity="${arrow.haloOp[1]}"/>
          <stop offset="100%" stop-color="${toHex(h[2]!)}" stop-opacity="${arrow.haloOp[2]}"/>
        </radialGradient>
        <linearGradient id="${idFace}" x1="28%" y1="12%" x2="72%" y2="92%">
          <stop offset="0%" stop-color="${toHex(f[0]!)}"/>
          <stop offset="38%" stop-color="${toHex(f[1]!)}"/>
          <stop offset="100%" stop-color="${toHex(f[2]!)}"/>
        </linearGradient>
        <linearGradient id="${idDepth}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${toHex(d[0]!)}"/>
          <stop offset="100%" stop-color="${toHex(d[1]!)}"/>
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="22" fill="url(#${idHalo})"/>
      <g>
        <path d="M22 6 L33 32 L22 25 L11 32 Z" fill="url(#${idDepth})"
              transform="translate(1.1 1.6)" stroke="none"/>
        <path d="M22 6 L33 32 L22 25 L11 32 Z"
              fill="url(#${idFace})" stroke="${arrow.stroke}" stroke-width="2.6"
              stroke-linejoin="round"/>
      </g>
    </svg>
  `
  return el
}

/** «Близкий» зум как в навигаторе — видны ближайшие здания и поворот. */
const NAV_ZOOM = 17
/** Наклон камеры: достаточно агрессивный, но 75 keeps headroom for built‑in maxPitch. */
const NAV_PITCH = 60
/** Минимальный maxPitch, который мы форсируем при навигаторе, чтобы NAV_PITCH влезал. */
export const NAVIGATOR_MIN_MAX_PITCH = 75

/**
 * Если пользователь сам сдвинул масштаб/карту, после стольки миллисекунд
 * без жестов камера снова встаёт на маркер с bearing = heading (как в обычном навигаторе).
 */
const NAV_USER_IDLE_RECENTER_MS = 4_000

/** Bearing (degrees, clockwise from north) от точки `from` к точке `to`. */
function bearingBetween(from: NavigatorPoint, to: NavigatorPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const lat1 = toRad(from[1])
  const lat2 = toRad(to[1])
  const dLng = toRad(to[0] - from[0])
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export type RoutePath = {
  coordinates: NavigatorPoint[]
  distanceMeters?: number
  timeMs?: number
  instructions: GraphHopperInstruction[]
  ascendMeters?: number
  descendMeters?: number
  /** Значение `details.max_speed` на первом участке маршрута (км/ч), если API вернул. */
  maxSpeedKmh?: number | null
  /** Сырые интервалы GraphHopper `details.max_speed`: [coordFrom, coordTo, kmh]. */
  maxSpeedDetails?: PathDetailRow[]
}

type PathDetailValue = string | number | null
type PathDetailRow = [number, number, PathDetailValue]
type PathDetails = Record<string, PathDetailRow[]>

function parsePositiveDetailNumber(value: PathDetailValue): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) && n > 0 ? n : null
}

function numericDetailAtSegment(
  rows: PathDetailRow[] | undefined,
  segmentIndex: number
): number | null {
  if (!Array.isArray(rows) || !rows.length) return null
  for (const row of rows) {
    const [from, to, value] = row
    if (segmentIndex < from || segmentIndex >= to) continue
    return parsePositiveDetailNumber(value)
  }
  return null
}

function trimPathDetailRows(
  rows: PathDetailRow[] | undefined,
  firstSegmentIndex: number
): PathDetailRow[] {
  if (!Array.isArray(rows) || !rows.length) return []
  const shifted: PathDetailRow[] = []
  for (const row of rows) {
    const [from, to, value] = row
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= firstSegmentIndex)
      continue
    const shiftedFrom = Math.max(0, from - firstSegmentIndex)
    const shiftedTo = Math.max(0, to - firstSegmentIndex)
    if (shiftedTo > shiftedFrom) shifted.push([shiftedFrom, shiftedTo, value])
  }
  return shifted
}

/**
 * GraphHopper `POST {baseUrl}/route` → массив координат `LineString` + пошаговые
 * инструкции. Используем `points_encoded: false`, чтобы не тащить
 * polyline-декодер на клиенте.
 */
async function fetchRoute(
  baseUrl: string,
  from: NavigatorPoint,
  to: NavigatorPoint,
  signal: AbortSignal | undefined,
  locale: NavigatorLang,
  profile: NavigatorProfile
): Promise<RoutePath> {
  const ghLocale = locale === 'en' ? 'en' : 'ru'
  const basePayload = {
    points: [from, to] as NavigatorPoint[],
    profile,
    points_encoded: false,
    instructions: true,
    locale: ghLocale,
  }
  const url = `${baseUrl}/route`
  const post = (body: object) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

  let res = await post({
    ...basePayload,
    elevation: true,
    details: ['max_speed'],
  })
  if (!res.ok && res.status === 400) {
    res = await post(basePayload)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`route ${res.status}: ${text || res.statusText}`)
  }
  const data = (await res.json()) as {
    paths?: Array<{
      points?: { coordinates?: number[][] }
      distance?: number
      time?: number
      ascend?: number
      descend?: number
      instructions?: GraphHopperInstruction[]
      details?: PathDetails
    }>
  }
  const path = data.paths?.[0]
  const rawCoords = path?.points?.coordinates ?? []
  const coordinates = rawCoords.map(
    (c) => [c[0]!, c[1]!] as NavigatorPoint
  )
  if (coordinates.length < 2) {
    throw new Error('route: пустой/некорректный ответ — нет геометрии')
  }
  return {
    coordinates,
    distanceMeters: path?.distance,
    timeMs: path?.time,
    instructions: path?.instructions ?? [],
    ascendMeters: typeof path?.ascend === 'number' ? path.ascend : undefined,
    descendMeters: typeof path?.descend === 'number' ? path.descend : undefined,
    maxSpeedKmh: numericDetailAtSegment(path?.details?.max_speed, 0),
    maxSpeedDetails: path?.details?.max_speed ?? [],
  }
}

/**
 * SVG-иконка манёвра (24×24 viewBox, `currentColor` для лёгкой перекраски).
 * Линии и стрелки — простые, чтобы хорошо читались в маленьком HUD.
 */
function getSignIcon(sign: number): string {
  const arrow = (rotation: number) =>
    `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${rotation}deg)"><path d="M12 21 V5"/><path d="M5 12 L12 5 L19 12"/></svg>`

  switch (sign) {
    case -3:
      return arrow(-135)
    case -2:
      return arrow(-90)
    case -1:
      return arrow(-45)
    case 0:
      return arrow(0)
    case 1:
      return arrow(45)
    case 2:
      return arrow(90)
    case 3:
      return arrow(135)
    case 4:
      return `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`
    case 5:
      return `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>`
    case 6:
    case -6:
      return `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><path d="M12 18 V21"/><path d="M9 21 H15"/></svg>`
    case -8:
    case 8:
    case -98:
      return `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20 V11 a5 5 0 0 1 10 0 V14"/><path d="M14 18 L18 14 L22 18"/></svg>`
    default:
      return arrow(0)
  }
}

/** ~111 320 м в одном градусе широты (одинаково на всех широтах). */
const METERS_PER_DEG_LAT = 111_320

/**
 * Толерантность «попал в маршрут»: если перпендикуляр от точки до
 * полилинии меньше этого значения — считаем, что пользователь идёт
 * по маршруту, и просто отрезаем уже пройденный кусок (не дёргаем API).
 *
 * 35 м с запасом перекрывает GPS-шум (≈5–15 м), ширину типичной городской
 * улицы и человеческий клик-промах в dev-режиме.
 */
export const ON_ROUTE_TOLERANCE_METERS = 35

/**
 * Толерантность «прибыли»: если позиция пользователя ближе этого значения
 * к точке назначения — фиксируем «Вы приехали», маршрут больше не строим
 * и не пересчитываем, пока не будет вызван `setDestination` с новой точкой.
 *
 * 2 м — запас на ошибку округления и снэппинг GraphHopper'а (он сажает
 * destination на ближайший road-segment, а реальная точка может быть в
 * паре метров сбоку — в подъезде/во дворе).
 */
export const ARRIVAL_TOLERANCE_METERS = 2

/** Расстояние между двумя [lng, lat] в метрах (equirectangular, ОК для города). */
function metersBetween(a: NavigatorPoint, b: NavigatorPoint): number {
  const lat0 = (a[1] + b[1]) / 2
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const dx = (b[0] - a[0]) * cosLat * METERS_PER_DEG_LAT
  const dy = (b[1] - a[1]) * METERS_PER_DEG_LAT
  return Math.hypot(dx, dy)
}

type SnapResult = {
  /** Индекс начала сегмента в массиве `coords` (точка `coords[segmentIndex]`). */
  segmentIndex: number
  /** Параметр положения вдоль сегмента, 0..1 (0 = начало, 1 = конец). */
  t: number
  /** Спроецированная на сегмент точка (в lng/lat). */
  point: NavigatorPoint
  /** Перпендикулярное расстояние от исходной точки до сегмента, в метрах. */
  distanceMeters: number
}

/**
 * Ближайшая точка на отрезке `a→b` к точке `p`. Все три точки в [lng, lat].
 * Проецирует в локальные метры (equirectangular, lat0 = середина сегмента),
 * считает классический dot-product, кламп `t ∈ [0,1]`, возвращает обратно в lng/lat.
 */
function closestPointOnSegment(
  p: NavigatorPoint,
  a: NavigatorPoint,
  b: NavigatorPoint
): { t: number; point: NavigatorPoint; distanceMeters: number } {
  const lat0 = (a[1] + b[1]) / 2
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const bx = (b[0] - a[0]) * cosLat * METERS_PER_DEG_LAT
  const by = (b[1] - a[1]) * METERS_PER_DEG_LAT
  const px = (p[0] - a[0]) * cosLat * METERS_PER_DEG_LAT
  const py = (p[1] - a[1]) * METERS_PER_DEG_LAT
  const lenSq = bx * bx + by * by

  let t = 0
  if (lenSq > 1e-9) {
    t = (px * bx + py * by) / lenSq
    if (t < 0) t = 0
    else if (t > 1) t = 1
  }

  const sx = bx * t
  const sy = by * t
  const distanceMeters = Math.hypot(px - sx, py - sy)
  const point: NavigatorPoint = [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ]
  return { t, point, distanceMeters }
}

/** Ближайшая точка на ломаной (массив [lng,lat]). */
function closestPointOnRoute(
  p: NavigatorPoint,
  coords: NavigatorPoint[]
): SnapResult {
  let best: SnapResult = {
    segmentIndex: 0,
    t: 0,
    point: coords[0] ?? p,
    distanceMeters: Number.POSITIVE_INFINITY,
  }
  for (let i = 0; i < coords.length - 1; i++) {
    const r = closestPointOnSegment(p, coords[i]!, coords[i + 1]!)
    if (r.distanceMeters < best.distanceMeters) {
      best = {
        segmentIndex: i,
        t: r.t,
        point: r.point,
        distanceMeters: r.distanceMeters,
      }
    }
  }
  return best
}

export type NavigatorOptions = {
  /** Стартовая позиция «пользователя». */
  position: NavigatorPoint
  /** Heading в градусах (0 = на север). По-умолчанию 0. */
  heading?: number
  /**
   * Базовый URL GraphHopper (без `/route`). Задаётся из `init.graphhopperUrl`.
   * Если не задан — `setDestination` и пересчёт маршрута вне линии не выполняют HTTP-запросы.
   */
  graphhopperBaseUrl?: string | null
  /**
   * Язык HUD и запросов инструкций GraphHopper (`locale`). По умолчанию `ru`.
   */
  lang?: NavigatorLang
  /**
   * Профиль маршрутизации GraphHopper (`profile` в теле `POST …/route`).
   * Задаётся из `init.navigatorProfile`. По умолчанию `car`.
   */
  navigatorProfile?: unknown
  /** Оформление маршрута / стрелки / панели; из `init.navigatorChrome`. */
  chrome?: NavigatorChromeParams | null
}

/**
 * Управляет «навигаторным» режимом:
 *  - стрелка-маркер положения пользователя (rotation = heading);
 *  - polyline маршрута до точки назначения;
 *  - камера (zoom/pitch/bearing) как в навигационном приложении;
 *  - HUD-плашка сверху со «следующим действием» (как в Google/Yandex/2GIS).
 *
 * Класс самодостаточный: хранит свой источник/слои/DOM и убирает их в `destroy()`.
 */
export class Navigator {
  private readonly map: Map
  private readonly graphhopperBaseUrl: string | null
  private readonly graphhopperProfile: NavigatorProfile
  private readonly lang: NavigatorLang
  private readonly navStrings: NavigatorStrings
  private currentPosition: NavigatorPoint
  private heading: number
  private destination: NavigatorPoint | null = null
  private readonly arrowMarker: Marker
  private routeAbort: AbortController | null = null

  private instructions: GraphHopperInstruction[] = []
  private currentInstructionIndex = 0
  /** Координаты *текущего* маршрута (после возможного trim'а). routeCoords[0] = текущая позиция. */
  private routeCoords: NavigatorPoint[] = []
  /**
   * Индекс первого coord'а каждой инструкции в `routeCoords`. Длина равна
   * `instructions.length`. После trim'а левая часть массивов сдвигается так,
   * что `segmentStartCoordIndices[currentInstructionIndex] === 0`.
   */
  private segmentStartCoordIndices: number[] = []
  /**
   * Подъём / спуск / max speed из последнего ответа GraphHopper (доп. строка HUD).
   */
  private routeApiExtras: {
    ascendMeters?: number
    descendMeters?: number
    maxSpeedKmh?: number | null
    maxSpeedDetails?: PathDetailRow[]
  } | null = null
  /**
   * Геометрическая длина текущей полилинии и сумма `time` инструкций —
   * для ETA «осталось времени» пропорционально оставшемуся пути.
   */
  private routeProgressBaseline: { meters: number; timeMs: number } | null = null
  private readonly hudEl: HTMLDivElement
  /** Активный one-shot click handler «выбрать положение по карте». */
  private cancelPick: (() => void) | null = null
  /**
   * Признак «прибыли в пункт назначения». Сбрасывается только при
   * `setDestination(...)`. Пока true — никаких snap/reroute, чтобы
   * не дёргать API и не подменять «Вы приехали».
   */
  private arrived = false

  private idleRecenterTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * Пользователь жестом сдвинул карту — `setPosition` обновляет только стрелку,
   * камеру не трогает, пока не сработает таймер или не будет смены маршрута / снапа.
   */
  private userAdjustedView = false
  /** `movestart` с `originalEvent` — ждём парный `moveend`, чтобы запустить таймер. */
  private mapGestureFromUser = false

  private readonly onNavigatorMapMoveStart = (e: { originalEvent?: unknown }) => {
    if (e.originalEvent == null) return
    this.mapGestureFromUser = true
    this.clearIdleRecenterTimer()
  }

  private readonly onNavigatorMapMoveEnd = () => {
    if (!this.mapGestureFromUser) return
    this.mapGestureFromUser = false
    this.userAdjustedView = true
    this.scheduleIdleRecenter()
  }

  private readonly chrome: ResolvedNavigatorChrome

  constructor(map: Map, options: NavigatorOptions) {
    this.map = map
    this.lang = normalizeNavigatorLang(options.lang)
    this.navStrings = navigatorStrings(this.lang)
    const gh = options.graphhopperBaseUrl
    this.graphhopperBaseUrl =
      gh == null || typeof gh !== 'string' || !gh.trim()
        ? null
        : gh.trim().replace(/\/+$/, '')
    this.graphhopperProfile = normalizeNavigatorProfile(options.navigatorProfile)
    this.currentPosition = options.position
    this.heading = options.heading ?? 0

    this.chrome = resolveNavigatorChrome(options.chrome)
    const gradientUid = Math.random().toString(36).slice(2, 10)
    const el = createArrowElement(gradientUid, this.chrome)
    this.arrowMarker = new maplibregl.Marker({
      element: el,
      rotationAlignment: 'map',
      pitchAlignment: 'map',
      anchor: 'center',
      rotation: this.heading,
    })
      .setLngLat(options.position)
      .addTo(map)

    this.hudEl = createHudElement()
    applyNavigatorHudTheme(this.hudEl, this.chrome)
    this.map.getContainer().appendChild(this.hudEl)
    this.renderHud()

    this.map.on('movestart', this.onNavigatorMapMoveStart)
    this.map.on('moveend', this.onNavigatorMapMoveEnd)

    this.applyCamera(this.currentPosition, this.heading, false)
  }

  /** Текущая «GPS»-точка пользователя. */
  getPosition(): NavigatorPoint {
    return [...this.currentPosition] as NavigatorPoint
  }

  /**
   * Обновляет позицию пользователя (имитация GPS-тика). Если передан
   * `heading` — поворачивает стрелку и камеру под него.
   */
  setPosition(position: NavigatorPoint, heading?: number): void {
    this.currentPosition = position
    if (heading != null) this.heading = heading
    this.arrowMarker.setLngLat(position)
    this.arrowMarker.setRotation(this.heading)
    if (!this.userAdjustedView) {
      this.applyCamera(position, this.heading, true)
    }
    if (this.instructions.length > 0 && this.routeCoords.length >= 2) {
      this.renderHud()
    }
  }

  /**
   * Запрашивает маршрут от текущей позиции до `destination`,
   * рисует polyline, поворачивает камеру и показывает HUD первой инструкции.
   */
  async setDestination(destination: NavigatorPoint): Promise<RoutePath> {
    if (!this.graphhopperBaseUrl) {
      throw new Error('graphhopperUrl не передан в init() — построение маршрута отключено')
    }
    if (this.routeAbort) this.routeAbort.abort()
    const ctrl = new AbortController()
    this.routeAbort = ctrl

    const path = await fetchRoute(
      this.graphhopperBaseUrl,
      this.currentPosition,
      destination,
      ctrl.signal,
      this.lang,
      this.graphhopperProfile
    )
    if (ctrl.signal.aborted) return path

    this.clearUserExplorationState()

    this.destination = destination
    this.arrived = false
    this.instructions = path.instructions
    this.currentInstructionIndex = 0
    this.routeCoords = path.coordinates.slice()
    this.segmentStartCoordIndices = path.instructions.map((inst) => inst.interval[0])
    this.routeApiExtras = {
      ascendMeters: path.ascendMeters,
      descendMeters: path.descendMeters,
      maxSpeedKmh: path.maxSpeedKmh ?? null,
      maxSpeedDetails: path.maxSpeedDetails ?? [],
    }
    this.renderRoute(this.routeCoords)
    this.refreshRouteProgressBaseline()
    this.renderHud()

    const next = this.routeCoords[1] ?? this.routeCoords[0]!
    const bearing = bearingBetween(this.currentPosition, next)
    this.heading = bearing
    this.arrowMarker.setRotation(bearing)
    this.applyCamera(this.currentPosition, bearing, true)

    return path
  }

  /** Перейти к следующей инструкции (для теста без реального GPS). */
  advanceInstruction(): GraphHopperInstruction | null {
    if (!this.instructions.length) return null
    const last = this.instructions.length - 1
    if (this.currentInstructionIndex >= last) {
      this.renderHud()
      return this.instructions[last] ?? null
    }
    this.currentInstructionIndex += 1
    this.renderHud()
    return this.instructions[this.currentInstructionIndex] ?? null
  }

  /**
   * Текущая показанная инструкция HUD (или null, если маршрут не построен).
   */
  getCurrentInstruction(): GraphHopperInstruction | null {
    return this.instructions[this.currentInstructionIndex] ?? null
  }

  /**
   * Тип результата `pickPosition()` — описывает, каким путём обновили позицию:
   *  - `noRoute`   — маршрут не задан, просто переместили стрелку;
   *  - `arrived`   — пользователь в `ARRIVAL_TOLERANCE_METERS` от destination
   *                   (или уже был в этом состоянии) — маршрут заморожен;
   *  - `snapped`   — точка попала на маршрут, отрезали пройденный кусок (без сети);
   *  - `rerouted`  — точка вне маршрута, перестроили route через GraphHopper.
   */

  /**
   * Применяет «новое положение пользователя» с экономией запросов к API:
   *   • если позиция в `ARRIVAL_TOLERANCE_METERS` от destination — фиксируем
   *     «Вы приехали», маршрут больше не пересчитываем;
   *   • если точка ближе `ON_ROUTE_TOLERANCE_METERS` к текущей полилинии —
   *     отрезаем пройденный кусок маршрута и сдвигаем индексы инструкций
   *     (сетевого запроса нет);
   *   • иначе — перестраиваем маршрут от новой позиции до того же destination.
   *
   * Если маршрут ещё не построен — просто двигаем маркер.
   */
  async pickPosition(point: NavigatorPoint): Promise<{
    mode: 'noRoute' | 'arrived' | 'snapped' | 'rerouted'
    distanceFromRouteMeters: number
  }> {
    if (this.routeCoords.length < 2 || !this.destination) {
      this.setPosition(point)
      return { mode: 'noRoute', distanceFromRouteMeters: 0 }
    }

    const distToDestination = metersBetween(point, this.destination)

    /**
     * Уже приехали — заморожены до новой точки назначения. Двигаем только
     * маркер (даже если пользователь уехал > 2 м), чтобы не штурмовать API
     * на каждом GPS-тике после прибытия.
     */
    if (this.arrived) {
      this.currentPosition = point
      this.arrowMarker.setLngLat(point)
      return { mode: 'arrived', distanceFromRouteMeters: distToDestination }
    }

    if (distToDestination <= ARRIVAL_TOLERANCE_METERS) {
      this.markArrived(point)
      return { mode: 'arrived', distanceFromRouteMeters: distToDestination }
    }

    const snap = closestPointOnRoute(point, this.routeCoords)

    if (snap.distanceMeters <= ON_ROUTE_TOLERANCE_METERS) {
      this.snapToRoute(snap)
      return { mode: 'snapped', distanceFromRouteMeters: snap.distanceMeters }
    }

    /**
     * Точка вне маршрута: меняем «GPS»-позицию и просим GraphHopper
     * актуальный маршрут от неё. Все ранее просчитанные шаги отбрасываются.
     */
    this.currentPosition = point
    this.arrowMarker.setLngLat(point)
    this.applyCamera(point, this.heading, true)
    await this.setDestination(this.destination)
    return { mode: 'rerouted', distanceFromRouteMeters: snap.distanceMeters }
  }

  /**
   * Активирует one-shot-режим выбора позиции: следующий клик по карте
   * вернётся в `onPicked`. Возвращает функцию отмены.
   */
  beginPickPositionOnce(
    onPicked: (point: NavigatorPoint) => void
  ): () => void {
    if (this.cancelPick) this.cancelPick()

    const canvas = this.map.getCanvas()
    const prevCursor = canvas.style.cursor
    canvas.style.cursor = 'crosshair'
    this.hudEl.classList.add('maplite-nav-hud--pick')

    const onClick = (e: maplibregl.MapMouseEvent) => {
      cleanup()
      onPicked([e.lngLat.lng, e.lngLat.lat])
    }

    const cleanup = () => {
      this.map.off('click', onClick)
      canvas.style.cursor = prevCursor
      this.hudEl.classList.remove('maplite-nav-hud--pick')
      if (this.cancelPick === cleanup) this.cancelPick = null
    }

    this.map.once('click', onClick)
    this.cancelPick = cleanup
    return cleanup
  }

  /** Текущая точка маршрута (если задана). */
  getDestination(): NavigatorPoint | null {
    return this.destination ? ([...this.destination] as NavigatorPoint) : null
  }

  /** Очищает все добавленные на карту ресурсы. */
  destroy(): void {
    this.map.off('movestart', this.onNavigatorMapMoveStart)
    this.map.off('moveend', this.onNavigatorMapMoveEnd)
    this.clearIdleRecenterTimer()
    this.userAdjustedView = false
    this.mapGestureFromUser = false

    this.cancelPick?.()
    this.cancelPick = null
    this.routeAbort?.abort()
    this.routeAbort = null
    this.arrowMarker.remove()
    this.removeRouteLayers()
    this.hudEl.remove()
  }

  /**
   * Фиксирует состояние «прибыли»: маркер ставится в `point`, маршрут
   * стирается с карты, инструкции очищаются, HUD показывает «Вы приехали».
   * Дальнейшие `pickPosition` / обновление позиции из нативного клиента будут двигать только
   * маркер — пока не вызовут `setDestination` с новой целью.
   */
  private markArrived(point: NavigatorPoint): void {
    this.clearUserExplorationState()
    this.routeApiExtras = null
    this.routeProgressBaseline = null
    this.arrived = true
    this.currentPosition = point
    this.arrowMarker.setLngLat(point)

    if (this.routeAbort) {
      this.routeAbort.abort()
      this.routeAbort = null
    }

    this.routeCoords = [point]
    this.instructions = []
    this.segmentStartCoordIndices = []
    this.currentInstructionIndex = 0
    this.removeRouteLayers()

    this.applyCamera(point, this.heading, true)
    this.renderHud()
  }

  /**
   * Обрезает уже пройденный участок маршрута: вместо `routeCoords[0..k]`
   * подставляет `[snapPoint, coords[k+1], …]` и сдвигает индексы инструкций.
   * Сетевых запросов не делает.
   */
  private snapToRoute(snap: SnapResult): void {
    this.clearUserExplorationState()
    const k = snap.segmentIndex
    const snapPoint = snap.point

    /**
     * Спецслучай: snap пришёлся в самый конец последнего сегмента маршрута
     * (прибыли). Стираем линию, оставляем только маркер и финальный HUD.
     */
    const trimmed: NavigatorPoint[] = [snapPoint, ...this.routeCoords.slice(k + 1)]
    if (trimmed.length < 2) {
      this.routeCoords = [snapPoint]
      this.currentPosition = snapPoint
      this.arrowMarker.setLngLat(snapPoint)
      this.removeRouteLayers()
      this.currentInstructionIndex = Math.max(0, this.instructions.length - 1)
      this.segmentStartCoordIndices = this.instructions.map(() => 0)
      this.routeProgressBaseline = null
      this.applyCamera(snapPoint, this.heading, true)
      this.renderHud()
      return
    }

    /**
     * `findCurrentInstructionIdx` ищет m, для которого
     * `segmentStartCoordIndices[m] <= k < segmentStartCoordIndices[m+1]`,
     * — это и есть инструкция, по сегменту которой мы сейчас движемся.
     */
    const m = findCurrentInstructionIdx(this.segmentStartCoordIndices, k)

    /**
     * Сдвигаем индексы оставшихся инструкций на `k`. Первая инструкция
     * теперь начинается с самого `snapPoint` (индекс 0 в новом массиве).
     */
    const remainingInstructions = this.instructions.slice(m)
    const remainingStarts = this.segmentStartCoordIndices.slice(m).map((idx, i) => {
      if (i === 0) return 0
      return Math.max(0, idx - k)
    })
    if (this.routeApiExtras) {
      this.routeApiExtras = {
        ...this.routeApiExtras,
        maxSpeedKmh: numericDetailAtSegment(this.routeApiExtras.maxSpeedDetails, k),
        maxSpeedDetails: trimPathDetailRows(this.routeApiExtras.maxSpeedDetails, k),
      }
    }

    this.routeCoords = trimmed
    this.instructions = remainingInstructions
    this.segmentStartCoordIndices = remainingStarts
    this.currentInstructionIndex = 0
    this.currentPosition = snapPoint

    const next = trimmed[1]!
    const bearing = bearingBetween(snapPoint, next)
    this.heading = bearing
    this.arrowMarker.setLngLat(snapPoint)
    this.arrowMarker.setRotation(bearing)
    this.applyCamera(snapPoint, bearing, true)

    const source = this.map.getSource(NAV_ROUTE_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: trimmed },
      })
    } else {
      this.renderRoute(trimmed)
    }
    this.refreshRouteProgressBaseline()
    this.renderHud()
  }

  private refreshRouteProgressBaseline(): void {
    if (this.routeCoords.length < 2 || !this.instructions.length) {
      this.routeProgressBaseline = null
      return
    }
    let meters = 0
    for (let i = 0; i < this.routeCoords.length - 1; i++) {
      meters += metersBetween(this.routeCoords[i]!, this.routeCoords[i + 1]!)
    }
    let timeMs = 0
    for (const inst of this.instructions) {
      timeMs += inst.time ?? 0
    }
    this.routeProgressBaseline = { meters, timeMs }
  }

  /**
   * Реальный остаток до следующего манёвра: суммирует длины сегментов
   * `routeCoords` от начала текущей инструкции до начала следующей.
   * Если инструкций после неё нет (последняя «Прибытие») — возвращает 0.
   */
  private computeRemainingMetersForCurrent(): number {
    if (this.instructions.length === 0 || this.routeCoords.length < 2) return 0
    const startIdx = this.segmentStartCoordIndices[this.currentInstructionIndex] ?? 0
    const endIdx =
      this.segmentStartCoordIndices[this.currentInstructionIndex + 1] ??
      this.routeCoords.length - 1
    let total = 0
    for (let i = startIdx; i < endIdx; i++) {
      const a = this.routeCoords[i]
      const b = this.routeCoords[i + 1]
      if (!a || !b) break
      total += metersBetween(a, b)
    }
    return total
  }

  /**
   * Остаток пути по полилинии от проекции `currentPosition` на маршрут до конца (м).
   */
  private computeRemainingRouteMetersFromPosition(): number {
    if (this.routeCoords.length < 2) return 0
    const snap = closestPointOnRoute(this.currentPosition, this.routeCoords)
    const i0 = snap.segmentIndex
    let total =
      (1 - snap.t) * metersBetween(this.routeCoords[i0]!, this.routeCoords[i0 + 1]!)
    for (let i = i0 + 1; i < this.routeCoords.length - 1; i++) {
      total += metersBetween(this.routeCoords[i]!, this.routeCoords[i + 1]!)
    }
    return total
  }

  /**
   * Оценка оставшегося времени (мс): доля текущей инструкции по дистанции + сумма `time` следующих.
   */
  private computeRemainingTimeMsEstimate(): number {
    if (!this.instructions.length) return 0
    const idx = Math.min(this.currentInstructionIndex, this.instructions.length - 1)
    const cur = this.instructions[idx]
    if (!cur) return 0
    const remM = this.computeRemainingMetersForCurrent()
    const fullD = cur.distance > 0.5 ? cur.distance : remM
    const frac = fullD > 0.5 ? Math.min(1, remM / fullD) : 1
    let ms = (cur.time ?? 0) * frac
    for (let j = idx + 1; j < this.instructions.length; j++) {
      ms += this.instructions[j]!.time ?? 0
    }
    return Math.round(ms)
  }

  private buildHudRouteSummaryBlock(): string {
    if (this.routeCoords.length < 2 || !this.instructions.length) return ''
    const dist = this.computeRemainingRouteMetersFromPosition()
    const bl = this.routeProgressBaseline
    const ms =
      bl != null && bl.meters > 1
        ? Math.round(bl.timeMs * Math.min(1, Math.max(0, dist / bl.meters)))
        : this.computeRemainingTimeMsEstimate()
    const { hud, formatDistanceLabel, formatDurationShort, formatRouteApiExtrasLine } =
      this.navStrings
    const sep = hud.routeSummarySep
    const line1 = `${escapeHtml(hud.routeToEndLabel)}: ${escapeHtml(formatDistanceLabel(dist))}${escapeHtml(sep)}${escapeHtml(hud.timeApproxPrefix)}${escapeHtml(formatDurationShort(ms))}`
    const api = this.routeApiExtras
    const extrasText =
      api != null
        ? formatRouteApiExtrasLine({
            ascendMeters: api.ascendMeters,
            descendMeters: api.descendMeters,
          })
        : ''
    if (!extrasText) {
      return `<div class="maplite-nav-hud__summary">${line1}</div>`
    }
    return `<div class="maplite-nav-hud__summary">${line1}</div><div class="maplite-nav-hud__extras">${escapeHtml(extrasText)}</div>`
  }

  /** Круглый знак ограничения скорости справа от HUD (если API вернул max_speed). */
  private buildHudSpeedLimitBadge(): string {
    const v = this.currentMaxSpeedKmh()
    if (v == null || !Number.isFinite(v) || v <= 0) return ''
    const n = Math.round(v)
    const label = escapeHtml(this.navStrings.speedLimitAria(n))
    const num = escapeHtml(String(n))
    return `<div class="maplite-nav-hud__speedlimit" role="img" aria-label="${label}">${num}</div>`
  }

  private currentMaxSpeedKmh(): number | null {
    if (!this.routeApiExtras || this.routeCoords.length < 2) return null
    const rows = this.routeApiExtras.maxSpeedDetails
    if (!rows?.length) return this.routeApiExtras.maxSpeedKmh ?? null
    const snap = closestPointOnRoute(this.currentPosition, this.routeCoords)
    return numericDetailAtSegment(rows, snap.segmentIndex)
  }

  private clearIdleRecenterTimer(): void {
    if (this.idleRecenterTimer != null) {
      clearTimeout(this.idleRecenterTimer)
      this.idleRecenterTimer = null
    }
  }

  /** Сброс «режима обзора» перед программным движением камеры по логике маршрута. */
  private clearUserExplorationState(): void {
    this.clearIdleRecenterTimer()
    this.userAdjustedView = false
    this.mapGestureFromUser = false
  }

  private scheduleIdleRecenter(): void {
    this.clearIdleRecenterTimer()
    this.idleRecenterTimer = window.setTimeout(() => {
      this.idleRecenterTimer = null
      this.userAdjustedView = false
      this.applyCamera(this.currentPosition, this.heading, true)
    }, NAV_USER_IDLE_RECENTER_MS)
  }

  private applyCamera(
    center: NavigatorPoint,
    bearing: number,
    animate: boolean
  ): void {
    const cam = {
      center,
      zoom: NAV_ZOOM,
      pitch: NAV_PITCH,
      bearing,
    }
    if (animate) {
      this.map.easeTo({ ...cam, duration: 600 })
    } else {
      this.map.jumpTo(cam)
    }
  }

  private renderRoute(coords: NavigatorPoint[]): void {
    const data: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }

    const existing = this.map.getSource(NAV_ROUTE_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined

    if (existing) {
      existing.setData(data)
      return
    }

    this.map.addSource(NAV_ROUTE_SOURCE, { type: 'geojson', data })

    this.map.addLayer({
      id: NAV_ROUTE_LAYER_BG,
      type: 'line',
      source: NAV_ROUTE_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': this.chrome.routeOutline,
        'line-width': 10,
        'line-opacity': 0.55,
      },
    })

    this.map.addLayer({
      id: NAV_ROUTE_LAYER,
      type: 'line',
      source: NAV_ROUTE_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': this.chrome.routeLine,
        'line-width': 6,
      },
    })
  }

  private removeRouteLayers(): void {
    if (this.map.getLayer(NAV_ROUTE_LAYER)) this.map.removeLayer(NAV_ROUTE_LAYER)
    if (this.map.getLayer(NAV_ROUTE_LAYER_BG))
      this.map.removeLayer(NAV_ROUTE_LAYER_BG)
    if (this.map.getSource(NAV_ROUTE_SOURCE))
      this.map.removeSource(NAV_ROUTE_SOURCE)
  }

  /**
   * Отрисовывает HUD-плашку «следующее действие» на основе
   * `currentInstructionIndex`. Без активного маршрута — плашка скрыта,
   * в состоянии «прибыли» — показывает «Вы приехали».
   */
  private renderHud(): void {
    const hud = this.hudEl
    const { hud: hudStr, getSignLabel, formatDistanceWithViaPrefix, exitRampLabel } =
      this.navStrings

    if (this.arrived) {
      hud.innerHTML = `
        <div class="maplite-nav-hud__icon" aria-hidden="true">${getSignIcon(4)}</div>
        <div class="maplite-nav-hud__body">
          <div class="maplite-nav-hud__distance">${escapeHtml(hudStr.arrivedTitle)}</div>
          <div class="maplite-nav-hud__text">${escapeHtml(hudStr.arrivedSubtitle)}</div>
        </div>
      `
      hud.classList.add('maplite-nav-hud--visible')
      return
    }

    if (!this.instructions.length) {
      hud.classList.remove('maplite-nav-hud--visible')
      hud.innerHTML = ''
      return
    }

    const current = this.instructions[this.currentInstructionIndex]
    if (!current) {
      hud.classList.remove('maplite-nav-hud--visible')
      hud.innerHTML = ''
      return
    }

    /**
     * GraphHopper-конвенция: `instructions[i].text` описывает манёвр,
     * который произойдёт на КОНЦЕ её сегмента (`interval[1]`), а сам
     * сегмент — это то, что пользователь сейчас проезжает.
     *
     * Поэтому в HUD'е надо показывать «следующий блок» —
     * `instructions[currentIdx + 1]`. Дистанция при этом — остаток по
     * текущему сегменту до этого манёвра.
     */
    const upcoming =
      this.instructions[this.currentInstructionIndex + 1] ?? null
    const remainingMeters = this.computeRemainingMetersForCurrent()

    /**
     * Префикс «Через 300 м» используется во всех навигаторах перед
     * настоящим манёвром (поворот / круг / съезд / U-turn / финиш).
     * Для `sign 0` («Прямо») префикс не добавляем — это не манёвр, а
     * продолжение движения, и формулировка «Через 1.4 км прямо» звучит
     * избыточно. Если расстояние уже 0 — безусловное «Прибытие».
     */
    const buildDistanceLabel = (withPrefix: boolean): string => {
      if (remainingMeters <= 0) return hudStr.arrival
      return withPrefix
        ? formatDistanceWithViaPrefix(remainingMeters)
        : this.navStrings.formatDistanceLabel(remainingMeters)
    }

    if (!upcoming) {
      /**
       * Уже сидим на последней инструкции — обычно это «Прибытие»
       * (`sign 4`, `distance 0`). Показываем финальную плашку.
       */
      const summaryBlock = this.buildHudRouteSummaryBlock()
      const speedBadge = this.buildHudSpeedLimitBadge()
      hud.innerHTML = `
        <div class="maplite-nav-hud__icon" aria-hidden="true">${getSignIcon(4)}</div>
        <div class="maplite-nav-hud__body">
          <div class="maplite-nav-hud__distance">${buildDistanceLabel(true)}</div>
          <div class="maplite-nav-hud__text">${escapeHtml(
            remainingMeters > 0 ? hudStr.arrivalAtDestination : hudStr.routeEnding
          )}</div>
          ${summaryBlock}
        </div>
        ${speedBadge}
      `
      hud.classList.add('maplite-nav-hud--visible')
      return
    }

    /**
     * Текст манёвра берём строго из `sign` (лейблы в `local.ts`), а не из
     * `i.text` — так HUD не зависит от формулировок GraphHopper-локали и
     * остаётся коротким/единообразным.
     *
     * Для круговых развязок (`sign 6` — заезд, `-6` — выезд) GraphHopper
     * присылает `exit_number` — нужный по счёту съезд. Дописываем его в
     * текст манёвра, иначе пользователь не поймёт, на каком съезде уходить.
     */
    const baseText = getSignLabel(upcoming.sign)
    const text =
      upcoming.exit_number != null
        ? `${baseText}, ${exitRampLabel(upcoming.exit_number)}`
        : baseText
    /**
     * Имя улицы — той, на которой пользователь окажется ПОСЛЕ манёвра
     * (т.е. street_name следующей инструкции). Это удобнее, чем имя
     * текущей улицы: подсказывает, куда поворачиваешь.
     */
    const street = upcoming.street_name?.trim() ?? ''

    /** «Прямо» (sign 0) — не манёвр, без «Через». Все остальные — с префиксом. */
    const distanceLabel = buildDistanceLabel(upcoming.sign !== 0)
    const summaryBlock = this.buildHudRouteSummaryBlock()
    const speedBadge = this.buildHudSpeedLimitBadge()

    hud.innerHTML = `
      <div class="maplite-nav-hud__icon" aria-hidden="true">${getSignIcon(upcoming.sign)}</div>
      <div class="maplite-nav-hud__body">
        <div class="maplite-nav-hud__distance">${distanceLabel}</div>
        <div class="maplite-nav-hud__text">${escapeHtml(text)}</div>
        ${street ? `<div class="maplite-nav-hud__street">${escapeHtml(street)}</div>` : ''}
        ${summaryBlock}
      </div>
      ${speedBadge}
    `
    hud.classList.add('maplite-nav-hud--visible')
  }
}

function createHudElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'maplite-nav-hud'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  return el
}

/**
 * Бинарный поиск инструкции, чьему сегменту соответствует
 * coord-index `k` в массиве `routeCoords`:
 *   `starts[m] <= k < starts[m+1]`.
 * Если `starts` пустой/некорректный — возвращает 0.
 */
function findCurrentInstructionIdx(starts: number[], k: number): number {
  if (starts.length === 0) return 0
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid]! <= k) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Минимальный escape для пользовательских строк, попадающих в `innerHTML`. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
