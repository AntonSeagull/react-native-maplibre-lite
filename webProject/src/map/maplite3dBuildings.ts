import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FillExtrusionLayerSpecification,
  Map,
  MapLibreEvent,
} from 'maplibre-gl';

export const MAPLITE_3D_BUILDINGS_LAYER_ID = 'maplite-3d-buildings'
const MAPLITE_3D_SHADOW_LAYER_ID = 'maplite-3d-buildings-shadow'
const MAPLITE_3D_OUTLINE_LAYER_ID = 'maplite-3d-buildings-outline'

const MAPLITE_LAYER_IDS = [
  MAPLITE_3D_SHADOW_LAYER_ID,
  MAPLITE_3D_BUILDINGS_LAYER_ID,
  MAPLITE_3D_OUTLINE_LAYER_ID,
]

/**
 * Фиксированный «lite» рендер 3D для слабых устройств (мало ядер/памяти,
 * мобильные WebView с софт-GPU):
 *  - более высокий zoom-порог 3D → в кадре меньше extrusion-полигонов;
 *  - низкий max-pitch → меньше overdraw и более коротких стен;
 *  - только fill-extrusion (без shadow/outline) → меньше draw pass'ов;
 *  - без vertical-gradient → проще fragment-шейдер;
 *  - opacity = 1 → лучше z-culling, меньше overdraw на pitch.
 */
/** Единые константы для высоты extrusion и авто-pitch — камера не наклоняется раньше появления зданий. */
const Z_FADE_IN = 15
const Z_FULL = 17
const PITCH_MAX = 3;

/** Средняя высота этажа жилого/офисного здания, м — для пересчёта `levels` → метры. */
const LEVEL_HEIGHT_M = 3.2
/** Нижний клэмп: даже если в тайлах нет данных — поднимаем хотя бы на это. */
const MIN_BUILDING_HEIGHT_M = 2
/** Верхний клэмп: защита от мусорных значений (километровые «небоскрёбы»). */
const MAX_BUILDING_HEIGHT_M = 240
/** Базовая высота, если в фиче нет ни height, ни levels (детерминированный fallback). */
const FALLBACK_BASE_HEIGHT_M = 2
/** Шаг fallback-«дрожания» — даёт визуальное разнообразие там, где данных нет. */
const FALLBACK_STEP_M = 1

/** Запасной цвет, если в стиле карты не нашлось building-слоя с заданным цветом. */
const FALLBACK_BUILDING_COLOR = '#f0e7d2'

type BuildingColor = DataDrivenPropertyValueSpecification<string>

/** Непрозрачные стены дают лучший z-culling и меньше overdraw на pitch. */
const BUILDING_FILL_OPACITY = 1

const PITCH_BIND_FLAG = '__mapliteCameraPitchFor3d'

type StyleLayer = {
  id: string
  type: string
  source?: string
  'source-layer'?: string
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
}

function getLayers(map: Map): StyleLayer[] {
  return (map.getStyle()?.layers ?? []) as StyleLayer[]
}

function findBuildingSource(map: Map): { source: string; sourceLayer: string } | null {
  for (const layer of getLayers(map)) {
    const src = layer.source
    const sl = layer['source-layer']
    if (src && sl && /^building/i.test(sl)) {
      return { source: src, sourceLayer: sl }
    }
  }
  return null
}

/**
 * Берёт цвет building-фичи прямо из стиля карты, чтобы 3D-стены совпадали
 * с цветом, заданным в стилях (как для плоских зданий).
 *
 * Приоритет: уже настроенный fill-extrusion-слой → обычный fill-слой.
 * Поддерживаются и константы, и data-driven выражения — `fill-extrusion-color`
 * принимает тот же набор значений, что и `fill-color`.
 */
function readBuildingColorFromStyle(
  map: Map,
  sourceLayer: string
): BuildingColor | null {
  let fillColor: BuildingColor | null = null

  for (const layer of getLayers(map)) {
    if (MAPLITE_LAYER_IDS.includes(layer.id)) continue
    if (layer['source-layer'] !== sourceLayer) continue

    if (layer.type === 'fill-extrusion') {
      try {
        const color = map.getPaintProperty(layer.id, 'fill-extrusion-color')
        if (color != null) return color as BuildingColor
      } catch {
        /* ignore */
      }
    } else if (layer.type === 'fill' && fillColor == null) {
      try {
        const color = map.getPaintProperty(layer.id, 'fill-color')
        if (color != null) fillColor = color as BuildingColor
      } catch {
        /* ignore */
      }
    }
  }

  return fillColor
}

/**
 * Скрывает все слои, которые рисуют те же building-фичи (плоские заливки,
 * обводки, дубль-3D из стиля), чтобы наш fill-extrusion не накладывался
 * сверху на 2D «крыши».
 */
function hideExisting2dBuildingLayers(map: Map, sourceLayer: string): void {
  for (const layer of getLayers(map)) {
    if (MAPLITE_LAYER_IDS.includes(layer.id)) continue
    if (layer['source-layer'] !== sourceLayer) continue
    try {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    } catch {
      /* ignore */
    }
  }
}

/** Первый «label»-слой — чтобы вставить extrusion ПОД подписи (улицы, POI). */
function findFirstSymbolLabelId(map: Map, excludeIds: string[]): string | undefined {
  for (const layer of getLayers(map)) {
    if (excludeIds.includes(layer.id)) continue
    if (layer.type !== 'symbol') continue
    const layout = layer.layout
    if (layout && 'text-field' in layout) return layer.id
  }
  return undefined
}

function safeRemoveLayer(map: Map, id: string): void {
  if (!map.getLayer(id)) return
  try {
    map.removeLayer(id)
  } catch {
    /* ignore */
  }
}

/**
 * Детерминированный fallback на случай, когда у фичи нет ни height, ни levels.
 * Используем `id` фичи, чтобы соседние здания получили разную высоту и не
 * смотрелись «ковром». Стрипы возможны, если id строго последовательные.
 */
const FALLBACK_HEIGHT_EXPR: ExpressionSpecification = [
  '+',
  FALLBACK_BASE_HEIGHT_M,
  ['*', FALLBACK_STEP_M, ['%', ['to-number', ['coalesce', ['id'], 0]], 5]],
]

/**
 * Сначала пробуем готовую высоту в метрах (render_height / height),
 * затем считаем из количества этажей × LEVEL_HEIGHT_M, и только если
 * совсем ничего нет — используем fallback с детерминированным джиттером.
 *
 * `to-number(value, 0)` нужен, чтобы строковые типа "12 m" не ломали
 * выражение: 0 «провалится» в следующий case-бранч (мы проверяем `> 0`).
 */
function buildHeightExpression(): ExpressionSpecification {
  const heightAttrs = ['render_height', 'height', 'building_height']
  const levelAttrs = [
    'render_levels',
    'levels',
    'building:levels',
    'building_levels',
    'num_levels',
  ]

  const hCandidate: ExpressionSpecification = [
    'case',
    ...heightAttrs.flatMap(
      (attr): [ExpressionSpecification, ExpressionSpecification] => [
        ['has', attr],
        ['to-number', ['get', attr], 0],
      ]
    ),
    0,
  ] as ExpressionSpecification

  const lCandidate: ExpressionSpecification = [
    'case',
    ...levelAttrs.flatMap(
      (attr): [ExpressionSpecification, ExpressionSpecification] => [
        ['has', attr],
        ['to-number', ['get', attr], 0],
      ]
    ),
    0,
  ] as ExpressionSpecification

  const picked: ExpressionSpecification = [
    'case',
    ['>', ['var', 'h'], 0], ['var', 'h'],
    ['>', ['var', 'l'], 0], ['*', LEVEL_HEIGHT_M, ['var', 'l']],
    FALLBACK_HEIGHT_EXPR,
  ]

  const clamped: ExpressionSpecification = [
    'max',
    MIN_BUILDING_HEIGHT_M,
    ['min', MAX_BUILDING_HEIGHT_M, picked],
  ]

  return [
    'let',
    'h',
    hCandidate,
    'l',
    lCandidate,
    clamped,
  ] as ExpressionSpecification
}

/** То же самое, но для нижнего среза (мосты, надстройки и т.п.). */
function buildBaseExpression(): ExpressionSpecification {
  const minHeightAttrs = ['render_min_height', 'min_height']
  const minLevelAttrs = [
    'render_min_levels',
    'min_levels',
    'building:min_level',
    'building_min_level',
  ]

  const mhCandidate: ExpressionSpecification = [
    'case',
    ...minHeightAttrs.flatMap(
      (attr): [ExpressionSpecification, ExpressionSpecification] => [
        ['has', attr],
        ['to-number', ['get', attr], 0],
      ]
    ),
    0,
  ] as ExpressionSpecification

  const mlCandidate: ExpressionSpecification = [
    'case',
    ...minLevelAttrs.flatMap(
      (attr): [ExpressionSpecification, ExpressionSpecification] => [
        ['has', attr],
        ['to-number', ['get', attr], 0],
      ]
    ),
    0,
  ] as ExpressionSpecification

  return [
    'let',
    'mh',
    mhCandidate,
    'ml',
    mlCandidate,
    [
      'case',
      ['>', ['var', 'mh'], 0], ['var', 'mh'],
      ['>', ['var', 'ml'], 0], ['*', LEVEL_HEIGHT_M, ['var', 'ml']],
      0,
    ],
  ]
}

/**
 * Один раз после загрузки тайлов печатает пример свойств первой найденной
 * building-фичи. Это упрощает диагностику: если ни один атрибут из
 * `buildHeightExpression` не подошёл, посмотрите в консоли, как реально
 * называется поле в текущих тайлах, и расширьте `heightAttrs`/`levelAttrs`.
 */
function logBuildingPropsOnce(map: Map, source: string, sourceLayer: string): void {
  const flagged = map as unknown as Record<string, unknown>
  const flag = '__mapliteBuildingPropsLogged'
  if (flagged[flag]) return

  const tryLog = () => {
    const features = map.querySourceFeatures(source, { sourceLayer })
    if (!features.length) return false
    flagged[flag] = true
    const sample = features.slice(0, 3).map((f) => f.properties)
    console.info(
      `[maplite] 3dEffect: пример свойств building-фичи (source-layer="${sourceLayer}"):`,
      sample
    )
    return true
  }

  if (tryLog()) return
  const onIdle = () => {
    if (tryLog()) map.off('idle', onIdle)
  }
  map.on('idle', onIdle)
}

/**
 * Ищет vector source с `source-layer = building*` и добавляет fill-extrusion
 * зданий. Высота из тайла (`render_height`/`height` → метры, `levels` → метры
 * через × LEVEL_HEIGHT_M), иначе — детерминированный fallback по id фичи.
 */
export function applyMaplite3dBuildings(map: Map): boolean {
  for (const id of MAPLITE_LAYER_IDS) {
    safeRemoveLayer(map, id)
  }

  const found = findBuildingSource(map)
  if (!found) {
    console.warn(
      '[maplite] 3dEffect: vector-source с source-layer "building*" не найден — 3D зданий не будет'
    )
    return false
  }

  const buildingColor: BuildingColor =
    readBuildingColorFromStyle(map, found.sourceLayer) ?? FALLBACK_BUILDING_COLOR

  hideExisting2dBuildingLayers(map, found.sourceLayer)
  logBuildingPropsOnce(map, found.source, found.sourceLayer)

  const heightExpr = buildHeightExpression()
  const baseExpr = buildBaseExpression()

  /**
   * Высота поднимается от 0 на Z_FADE_IN до per-feature значения на Z_FULL.
   * `interpolate` поддерживает data-driven значения в outputs, поэтому
   * выражение из тайла подставляется прямо туда.
   */
  const fadedHeight: DataDrivenPropertyValueSpecification<number> = [
    'interpolate',
    ['linear'],
    ['zoom'],
    Z_FADE_IN,
    0,
    Z_FULL,
    heightExpr,
  ]

  const fadedBase: DataDrivenPropertyValueSpecification<number> = [
    'interpolate',
    ['linear'],
    ['zoom'],
    Z_FADE_IN,
    0,
    Z_FULL,
    baseExpr,
  ]

  const extrusionSpec: FillExtrusionLayerSpecification = {
    id: MAPLITE_3D_BUILDINGS_LAYER_ID,
    source: found.source,
    'source-layer': found.sourceLayer,
    type: 'fill-extrusion',
    minzoom: Z_FADE_IN,
    paint: {
      'fill-extrusion-color': buildingColor,
      'fill-extrusion-height': fadedHeight,
      'fill-extrusion-base': fadedBase,
      'fill-extrusion-opacity': BUILDING_FILL_OPACITY,
      'fill-extrusion-vertical-gradient': false,
    },
  }

  const beforeId = findFirstSymbolLabelId(map, MAPLITE_LAYER_IDS)

  try {
    if (beforeId) map.addLayer(extrusionSpec, beforeId)
    else map.addLayer(extrusionSpec)
  } catch (e) {
    console.warn('[maplite] 3dEffect: не удалось добавить слой', e)
    return false
  }

  return true
}

/**
 * Без pitch здания смотрятся «плоскими» — плавно увеличиваем pitch при zoom in.
 * Если пользователь сам наклонил карту — больше его pitch не трогаем.
 * Идемпотентно: повторный вызов на той же Map игнорируется.
 */
export function bindCameraPitchFor3dBuildings(map: Map): void {
  const flagged = map as unknown as Record<string, unknown>
  if (flagged[PITCH_BIND_FLAG]) return
  flagged[PITCH_BIND_FLAG] = true

  if (map.getMaxPitch() < PITCH_MAX) {
    map.setMaxPitch(PITCH_MAX)
  }

  const desiredPitch = (z: number): number => {
    if (z <= Z_FADE_IN) return 0
    if (z >= Z_FULL) return PITCH_MAX
    return ((z - Z_FADE_IN) / (Z_FULL - Z_FADE_IN)) * PITCH_MAX
  }

  let userTouchedPitch = false
  let programmaticPitch = false
  let raf: number | null = null

  const apply = () => {
    raf = null
    if (userTouchedPitch) return
    const next = desiredPitch(map.getZoom())
    if (Math.abs(map.getPitch() - next) > 0.25) {
      programmaticPitch = true
      try {
        map.setPitch(next)
      } finally {
        programmaticPitch = false
      }
    }
  }

  const schedule = () => {
    if (raf != null) return
    raf = requestAnimationFrame(apply)
  }

  map.on('pitchstart', (e: MapLibreEvent) => {
    if (programmaticPitch) return
    if ((e as { originalEvent?: unknown }).originalEvent != null) {
      userTouchedPitch = true
    }
  })

  map.on('zoom', schedule)
  map.on('zoomend', apply)

  apply()
}
