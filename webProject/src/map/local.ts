/**
 * Локализация навигатора (HUD, манёвры, дистанции). Другие модули карты
 * при необходимости расширяют `LOCAL` тем же ключом языка.
 */
export type NavigatorLang = 'ru' | 'en'

export type NavigatorHudStrings = {
  arrivedTitle: string
  arrivedSubtitle: string
  arrivalAtDestination: string
  routeEnding: string
  arrival: string
  defaultManeuver: string
  distanceViaPrefix: string
  /** «До конца: …» в строке остатка маршрута. */
  routeToEndLabel: string
  /** Префикс перед оставшимся временем (например «≈» / «~»). */
  timeApproxPrefix: string
  /** Разделитель между блоками в строке сводки (км · время · доп.). */
  routeSummarySep: string
  minuteSuffix: string
  hourSuffix: string
  ascendShort: string
  descendShort: string
  speedLimitAria: (kmh: number) => string
}

export type NavigatorStrings = {
  hud: NavigatorHudStrings
  signByCode: Record<number, string>
  distance: { invalid: string; metersSuffix: string; kilometersSuffix: string }
  exitRampLabel: (exitNumber: number) => string
  getSignLabel: (sign: number) => string
  formatMeters: (roundedMeters: number) => string
  formatKilometers: (kmFormatted: string) => string
  formatDistanceLabel: (meters: number) => string
  formatDistanceWithViaPrefix: (meters: number) => string
  formatDurationShort: (ms: number) => string
  /** Подъём / спуск с маршрута API — пустая строка, если нечего показать. */
  formatRouteApiExtrasLine: (opts: {
    ascendMeters?: number
    descendMeters?: number
  }) => string
  /** Текст для `aria-label` круглого знака ограничения скорости. */
  speedLimitAria: (kmh: number) => string
}

function createNavigatorStrings(
  hud: NavigatorHudStrings,
  signByCode: Record<number, string>,
  distance: { invalid: string; metersSuffix: string; kilometersSuffix: string },
  exitRampLabel: (exitNumber: number) => string
): NavigatorStrings {
  /** Замыкания вместо `this`, чтобы при деструктуризации из `navStrings` не терялся контекст. */
  const formatMeters = (roundedMeters: number) => `${roundedMeters}${distance.metersSuffix}`
  const formatKilometers = (kmFormatted: string) => `${kmFormatted}${distance.kilometersSuffix}`
  const formatDistanceLabel = (meters: number) => {
    if (!Number.isFinite(meters) || meters < 0) return distance.invalid
    if (meters < 1000) {
      const rounded = Math.round(meters / 10) * 10
      return formatMeters(rounded)
    }
    const km = meters / 1000
    const kmFormatted = km < 10 ? km.toFixed(1) : String(Math.round(km))
    return formatKilometers(kmFormatted)
  }
  const formatDistanceWithViaPrefix = (meters: number) =>
    `${hud.distanceViaPrefix}${formatDistanceLabel(meters)}`

  const formatDurationShort = (ms: number) => {
    if (!Number.isFinite(ms) || ms < 0) return distance.invalid
    const minutes = Math.max(0, Math.round(ms / 60_000))
    if (minutes < 60) return `${minutes}${hud.minuteSuffix}`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (m === 0) return `${h}${hud.hourSuffix}`.trim()
    return `${h}${hud.hourSuffix} ${m}${hud.minuteSuffix}`.trim()
  }

  const formatAscend = (m: number) =>
    `${hud.ascendShort}${formatMeters(Math.round(m / 10) * 10)}`
  const formatDescend = (m: number) =>
    `${hud.descendShort}${formatMeters(Math.round(m / 10) * 10)}`

  const formatRouteApiExtrasLine = (opts: {
    ascendMeters?: number
    descendMeters?: number
  }) => {
    const sep = hud.routeSummarySep
    const parts: string[] = []
    if (opts.ascendMeters != null && opts.ascendMeters > 1) parts.push(formatAscend(opts.ascendMeters))
    if (opts.descendMeters != null && opts.descendMeters > 1)
      parts.push(formatDescend(opts.descendMeters))
    return parts.join(sep)
  }

  return {
    hud,
    signByCode,
    distance,
    exitRampLabel,
    getSignLabel: (sign: number) => signByCode[sign] ?? hud.defaultManeuver,
    formatMeters,
    formatKilometers,
    formatDistanceLabel,
    formatDistanceWithViaPrefix,
    formatDurationShort,
    formatRouteApiExtrasLine,
    speedLimitAria: (kmh: number) => hud.speedLimitAria(kmh),
  }
}

const ruHud: NavigatorHudStrings = {
  arrivedTitle: 'Вы приехали',
  arrivedSubtitle: 'Маршрут завершён',
  arrivalAtDestination: 'Прибытие в пункт назначения',
  routeEnding: 'Маршрут завершается',
  arrival: 'Прибытие',
  defaultManeuver: 'Продолжайте движение',
  distanceViaPrefix: 'через ',
  routeToEndLabel: 'До конца',
  timeApproxPrefix: '≈\u00a0',
  routeSummarySep: ' · ',
  minuteSuffix: ' мин',
  hourSuffix: ' ч',
  ascendShort: '↑\u00a0',
  descendShort: '↓\u00a0',
  speedLimitAria: (kmh: number) => `Ограничение скорости ${kmh} км/ч`,
}

const ruSign: Record<number, string> = {
  [-98]: 'Разворот',
  [-8]: 'Разворот налево',
  [-7]: 'Держитесь левее',
  [-6]: 'Выезд из круга',
  [-3]: 'Резко налево',
  [-2]: 'Поверните налево',
  [-1]: 'Плавно налево',
  0: 'Прямо',
  1: 'Плавно направо',
  2: 'Поверните направо',
  3: 'Резко направо',
  4: 'Прибытие',
  5: 'Промежуточная точка',
  6: 'Заезд на круг',
  7: 'Держитесь правее',
  8: 'Разворот направо',
}

const ruDistance = {
  invalid: '—',
  metersSuffix: ' м',
  kilometersSuffix: ' км',
}

const enHud: NavigatorHudStrings = {
  arrivedTitle: 'You have arrived',
  arrivedSubtitle: 'Route completed',
  arrivalAtDestination: 'Arriving at destination',
  routeEnding: 'Route is ending',
  arrival: 'Arrival',
  defaultManeuver: 'Continue',
  distanceViaPrefix: 'in ',
  routeToEndLabel: 'To go',
  timeApproxPrefix: '~\u00a0',
  routeSummarySep: ' · ',
  minuteSuffix: ' min',
  hourSuffix: ' h',
  ascendShort: '↑\u00a0',
  descendShort: '↓\u00a0',
  speedLimitAria: (kmh: number) => `Speed limit ${kmh} km/h`,
}

const enSign: Record<number, string> = {
  [-98]: 'U-turn',
  [-8]: 'U-turn left',
  [-7]: 'Keep left',
  [-6]: 'Leave roundabout',
  [-3]: 'Sharp left',
  [-2]: 'Turn left',
  [-1]: 'Slight left',
  0: 'Straight',
  1: 'Slight right',
  2: 'Turn right',
  3: 'Sharp right',
  4: 'Arrive',
  5: 'Waypoint',
  6: 'Enter roundabout',
  7: 'Keep right',
  8: 'U-turn right',
}

const enDistance = {
  invalid: '—',
  metersSuffix: ' m',
  kilometersSuffix: ' km',
}

const ruNavigator = createNavigatorStrings(ruHud, ruSign, ruDistance, (n) => `${n}-й съезд`)

const enNavigator = createNavigatorStrings(enHud, enSign, enDistance, (n) => `Exit ${n}`)

export const LOCAL: Record<NavigatorLang, { navigator: NavigatorStrings }> = {
  ru: { navigator: ruNavigator },
  en: { navigator: enNavigator },
}

/** Значение `init.navigatorLang` и опция `Navigator`: неизвестное → `ru`. */
export function normalizeNavigatorLang(value: unknown): NavigatorLang {
  if (value === 'en') return 'en'
  return 'ru'
}

export function navigatorStrings(lang: NavigatorLang): NavigatorStrings {
  return LOCAL[lang].navigator
}
