import maplibregl, {
  type Map,
  type Marker,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';

import { normalizeGraphhopperBaseUrl } from './graphhopperUrl';
import { type NavigatorLang } from './local';
import {
  applyMaplite3dBuildings,
  bindCameraPitchFor3dBuildings,
} from './maplite3dBuildings';
import { postToNative } from './nativeBridge';
import {
  Navigator,
  NAVIGATOR_MIN_MAX_PITCH,
  type NavigatorChromeParams,
  type NavigatorPoint,
  type NavigatorProfile,
} from './navigator';
import type { EventParams } from './types';

let pmtilesProtocolInstalled = false

function ensurePmtilesProtocol(): void {
  if (pmtilesProtocolInstalled) return
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  pmtilesProtocolInstalled = true
}

/**
 * 3D extrusion зданий: включён всегда (нужен vector source с
 * source-layer `building`). Параметр не пробрасывается извне, чтобы
 * нативная сторона не могла случайно отключить «бумажный» 3D-рендер.
 */
const ENABLE_3D_EFFECT = true

export type InitParams = {
  mapStyle: maplibregl.StyleSpecification
  center: [number, number]
  zoom: number
  minZoom?: number
  maxZoom?: number
  zoomEnabled?: boolean
  scrollEnabled?: boolean
  antialias?: boolean
  crossSourceCollisions?: boolean
  fadeDuration?: number
  pixelRatio?: number
  simplifyStyle?: boolean
  aggressiveSimplifyStyle?: boolean
  maxPitch?: number
  renderWorldCopies?: boolean
  turboWhileMoving?: boolean
  debugMode?: boolean
  /**
   * Включить «навигаторный» режим: на карте появляется стрелка-маркер
   * текущего положения пользователя в `center`, камера ставится в
   * близкий зум с агрессивным наклоном. Маршрут добавляется отдельной
   * командой `setNavigatorPoint`.
   */
  navigator?: boolean
  /**
   * Базовый URL GraphHopper (тот же хост, что для `POST …/route`).
   * Без него построение и пересчёт маршрута не выполняются (ошибка при `setNavigatorPoint`).
   */
  graphhopperUrl?: string
  /**
   * Язык подписей навигатора (HUD, манёвры). `ru` или `en`; если не задан — `ru`.
   * Используется только при `navigator: true`.
   */
  navigatorLang?: NavigatorLang
  /**
   * Профиль GraphHopper для построения маршрута (`profile` в API).
   * Если не задан или неизвестная строка — `car`. Только при `navigator: true`.
   */
  navigatorProfile?: NavigatorProfile | string
  /**
   * Оформление навигатора: линия маршрута, стрелка, верхняя панель (все поля необязательны).
   * Знак скорости на панели не настраивается.
   */
  navigatorChrome?: NavigatorChromeParams
}

export type SetNavigatorPointParams = {
  /** Координаты конечной точки маршрута. */
  latitude: number
  longitude: number
}

export type SetNavigatorPositionParams = {
  /** Новое «текущее положение» пользователя. */
  latitude: number
  longitude: number
}

export type MarkerParams = {
  uniqueId: string
  latitude: number
  longitude: number
  color?: string
  iconUrl?: string
  iconWidth?: number
  iconHeight?: number
  html?: string
}

export type PolylineParams = {
  uniqueId: string
  coordinates: [number, number][]
  color?: string
  width?: number
}

export type PolygonParams = {
  uniqueId: string
  coordinates: [number, number][]
  fillColor?: string
  fillOpacity?: number
  strokeColor?: string
  strokeOpacity?: number
  strokeWidth?: number
}

export type FitBoundsParams = {
  bounds: [[number, number], [number, number]]
  padding?: number
  duration?: number
}

export type FlyToParams = {
  center: [number, number]
  zoom: number
  duration?: number
}

export type UpdateParams = {
  minZoom?: number
  maxZoom?: number
  zoomEnabled?: boolean
  scrollEnabled?: boolean
  mapStyle?: maplibregl.StyleSpecification
}

export class MapLiteController {
  private readonly container: HTMLElement
  private map: Map | null = null
  private readonly markers: Record<string, Marker> = {}
  private debugMode = false
  private navigator: Navigator | null = null

  constructor(container: HTMLElement, options?: { debugMode?: boolean }) {
    this.container = container
    this.debugMode = options?.debugMode ?? false
    ensurePmtilesProtocol()
  }

  setDebugMode(v: boolean): void {
    this.debugMode = v
  }

  receive(raw: string): void {
    let functionName: string
    let params: Record<string, unknown>
    try {
      const data = JSON.parse(raw) as { function?: string; params?: Record<string, unknown> }
      if (!data.function) return
      functionName = data.function
      params = data.params ?? {}
    } catch {
      return
    }

    try {
      switch (functionName) {
        case 'init':
          this.handleInit(params as unknown as InitParams)
          break
        case 'update':
          this.handleUpdate(params as unknown as UpdateParams)
          break
        case 'addMarker':
          this.handleAddMarker(params as unknown as MarkerParams)
          break
        case 'removeMarker':
          this.handleRemoveMarker(params as { uniqueId: string })
          break
        case 'addPolyline':
          this.handleAddPolyline(params as unknown as PolylineParams)
          break
        case 'removePolyline':
          this.handleRemovePolyline(params as { uniqueId: string })
          break
        case 'addPolygon':
          this.handleAddPolygon(params as unknown as PolygonParams)
          break
        case 'removePolygon':
          this.handleRemovePolygon(params as { uniqueId: string })
          break
        case 'fitBounds':
          this.handleFitBounds(params as unknown as FitBoundsParams)
          break
        case 'flyTo':
          this.handleFlyTo(params as unknown as FlyToParams)
          break
        case 'setNavigatorPoint':
          void this.handleSetNavigatorPoint(params as unknown as SetNavigatorPointParams)
          break
        case 'advanceNavigatorInstruction':
          this.handleAdvanceNavigatorInstruction()
          break
        case 'setNavigatorPosition':
          void this.handleSetNavigatorPosition(params as unknown as SetNavigatorPositionParams)
          break
        case 'pickNavigatorPosition':
          this.handlePickNavigatorPosition()
          break
        default:
          break
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (this.debugMode) {
        alert(`WebView function error: ${functionName} ${message}`)
      }
      console.error('WebView function error:', functionName, message)
      postToNative({
        type: 'error',
        data: { target: functionName, message },
      })
    }
  }

  destroy(): void {
    Object.values(this.markers).forEach((m) => m.remove())
    for (const k of Object.keys(this.markers)) delete this.markers[k]
    if (this.navigator) {
      this.navigator.destroy()
      this.navigator = null
    }
    this.map?.remove()
    this.map = null
  }

  private getEventParams(): EventParams {
    if (!this.map) return { center: null, zoom: null }
    const center = this.map.getCenter()
    const zoom = this.map.getZoom()
    return { center: { lng: center.lng, lat: center.lat }, zoom }
  }

  private simplifyStyle(mapInstance: Map, aggressive: boolean): void {
    const style = mapInstance.getStyle()
    const layers = style?.layers ?? []
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!
      const layerId = layer.id
      const layerType = layer.type
      let shouldHide = false

      if (layerType === 'fill-extrusion' || layerType === 'hillshade') {
        shouldHide = true
      }

      if (layerType === 'symbol' && aggressive) {
        const idLower = String(layerId || '').toLowerCase()
        const sourceLayerLower = String(
          (layer as { 'source-layer'?: string })['source-layer'] || ''
        ).toLowerCase()

        const keepLabel =
          idLower.includes('road') ||
          idLower.includes('street') ||
          idLower.includes('housenumber') ||
          idLower.includes('house_number') ||
          idLower.includes('house-number') ||
          idLower.includes('address') ||
          sourceLayerLower.includes('housenumber') ||
          sourceLayerLower.includes('house') ||
          sourceLayerLower.includes('address')

        const hideSymbol =
          idLower.includes('poi') ||
          idLower.includes('transit') ||
          idLower.includes('airport') ||
          idLower.includes('rail') ||
          idLower.includes('ferry')

        if (!keepLabel && hideSymbol) {
          shouldHide = true
        }
      }

      if (aggressive && (layerType === 'line' || layerType === 'circle')) {
        const layerIdLower = String(layerId || '').toLowerCase()
        if (
          layerIdLower.includes('road-label') ||
          layerIdLower.includes('poi') ||
          layerIdLower.includes('label') ||
          layerIdLower.includes('boundary') ||
          layerIdLower.includes('admin')
        ) {
          shouldHide = true
        }
      }

      if (shouldHide) {
        try {
          mapInstance.setLayoutProperty(layerId, 'visibility', 'none')
        } catch {
          /* ignore */
        }
      }
    }
  }

  private setOverlayLayersVisibility(visibility: 'visible' | 'none'): void {
    if (!this.map) return
    const style = this.map.getStyle()
    const layers = style?.layers ?? []
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!
      const layerId = String(layer.id || '')
      const isCustomOverlay =
        layerId.includes('-polylines-layout') ||
        layerId.includes('-polygons-fill') ||
        layerId.includes('-polygons-stroke')

      if (isCustomOverlay) {
        try {
          this.map.setLayoutProperty(layer.id, 'visibility', visibility)
        } catch {
          /* ignore */
        }
      }
    }
  }

  private handleInit(params: InitParams): void {
    if (params.debugMode != null) {
      this.debugMode = params.debugMode
    }
    if (this.navigator) {
      this.navigator.destroy()
      this.navigator = null
    }
    if (this.map) {
      this.map.remove()
      this.map = null
    }

    const navigatorEnabled = params.navigator === true

    /**
     * В режиме навигатора форсируем большой maxPitch, чтобы стандартный
     * камеральный pitch (~60°) умещался независимо от того, что прислал клиент.
     */
    const effectiveMaxPitch = navigatorEnabled
      ? Math.max(params.maxPitch ?? 0, NAVIGATOR_MIN_MAX_PITCH)
      : params.maxPitch

    this.map = new maplibregl.Map({
      container: this.container,
      style: params.mapStyle,
      center: params.center,
      zoom: params.zoom,
      scrollZoom: params.scrollEnabled ?? false,
      doubleClickZoom: params.zoomEnabled ?? false,
      touchZoomRotate: params.zoomEnabled ?? false,
      minZoom: params.minZoom,
      maxZoom: params.maxZoom,
      dragPan: params.scrollEnabled ?? false,
      dragRotate: params.zoomEnabled ?? false,
      crossSourceCollisions: params.crossSourceCollisions ?? true,
      fadeDuration: params.fadeDuration ?? 120,
      ...(params.pixelRatio != null ? { pixelRatio: params.pixelRatio } : {}),
      renderWorldCopies: params.renderWorldCopies ?? true,
      canvasContextAttributes: { antialias: params.antialias ?? false },
    })

    if (typeof effectiveMaxPitch === 'number') {
      this.map.setMaxPitch(effectiveMaxPitch)
    }

    if (effectiveMaxPitch === 0) {
      this.map.dragRotate.disable()
      this.map.touchZoomRotate.disableRotation()
    }

    if (ENABLE_3D_EFFECT && effectiveMaxPitch === 0) {
      console.warn(
        '[maplite] 3dEffect включён вместе с maxPitch=0 — наклон форсированно включён, чтобы здания смотрелись объёмными'
      )
      this.map.dragRotate.enable()
      this.map.touchZoomRotate.enable()
    }

    const map = this.map

    map.on('error', (event) => {
      postToNative({
        type: 'event',
        event: 'error',
        params: {
          message: event.error?.message ?? String(event.error ?? event),
        },
      })
    })

    map.on('movestart', () => {
      if (params.turboWhileMoving) {
        this.setOverlayLayersVisibility('none')
      }
      postToNative({ type: 'event', event: 'movestart', params: this.getEventParams() })
    })

    map.on('moveend', () => {
      if (params.turboWhileMoving) {
        this.setOverlayLayersVisibility('visible')
      }
      postToNative({ type: 'event', event: 'moveend', params: this.getEventParams() })
    })

    map.on('zoomstart', () => {
      postToNative({ type: 'event', event: 'zoomstart', params: this.getEventParams() })
    })

    map.on('zoomend', () => {
      postToNative({ type: 'event', event: 'zoomend', params: this.getEventParams() })
    })

    map.on('idle', () => {
      postToNative({ type: 'event', event: 'idle', params: this.getEventParams() })
    })

    map.once('load', () => {
      if (params.simplifyStyle) {
        this.simplifyStyle(map, Boolean(params.aggressiveSimplifyStyle))
      }
      if (ENABLE_3D_EFFECT) {
        applyMaplite3dBuildings(map)
        /**
         * В навигаторном режиме pitch держим высоким постоянно;
         * автоматическая привязка pitch-к-зуму из maplite3dBuildings
         * сбрасывает наклон до ~3° на zoom>=17 — это противоречит навигатору.
         */
        if (!navigatorEnabled) {
          bindCameraPitchFor3dBuildings(map)
        }
      }
      if (navigatorEnabled) {
        const center: NavigatorPoint = [params.center[0], params.center[1]]
        const graphhopperBaseUrl =
          typeof params.graphhopperUrl === 'string'
            ? normalizeGraphhopperBaseUrl(params.graphhopperUrl)
            : null
        this.navigator = new Navigator(map, {
          position: center,
          graphhopperBaseUrl,
          lang: params.navigatorLang,
          navigatorProfile: params.navigatorProfile,
          chrome: params.navigatorChrome,
        })
      }
      postToNative({ type: 'inited' })
    })
  }

  private handleUpdate(params: UpdateParams): void {
    if (!this.map) return

    if (params.minZoom != null && this.map.getMinZoom() !== params.minZoom) {
      this.map.setMinZoom(params.minZoom)
    }

    if (params.maxZoom != null && this.map.getMaxZoom() !== params.maxZoom) {
      this.map.setMaxZoom(params.maxZoom)
    }

    if (params.zoomEnabled != null) {
      if (params.zoomEnabled) {
        this.map.doubleClickZoom.enable()
        this.map.touchZoomRotate.enable()
        this.map.dragRotate.enable()
      } else {
        this.map.doubleClickZoom.disable()
        this.map.touchZoomRotate.disable()
        this.map.dragRotate.disable()
      }
    }

    if (params.scrollEnabled != null) {
      if (params.scrollEnabled) {
        this.map.scrollZoom.enable()
        this.map.dragPan.enable()
      } else {
        this.map.scrollZoom.disable()
        this.map.dragPan.disable()
      }
    }

    if (params.mapStyle) {
      this.map.setStyle(params.mapStyle)
    }
  }

  private handleAddMarker(params: MarkerParams): void {
    if (!this.map) return
    const existing = this.markers[params.uniqueId]
    if (existing) {
      existing.remove()
      delete this.markers[params.uniqueId]
    }

    const onMarkerClick = () => {
      postToNative({ type: 'markerClick', uniqueId: params.uniqueId })
    }

    if (params.html) {
      const el = document.createElement('div')
      el.className = 'marker'
      el.innerHTML = params.html
      el.addEventListener('click', onMarkerClick)
      this.markers[params.uniqueId] = new maplibregl.Marker({ element: el })
        .setLngLat([params.longitude, params.latitude])
        .addTo(this.map)
      return
    }

    if (!params.iconUrl) {
      const m = new maplibregl.Marker({
        color: params.color != null ? params.color : undefined,
      })
        .setLngLat([params.longitude, params.latitude])
        .addTo(this.map)
      m.getElement().addEventListener('click', onMarkerClick)
      this.markers[params.uniqueId] = m
      return
    }

    const el2 = document.createElement('div')
    el2.className = 'marker'
    el2.style.backgroundImage = `url(${params.iconUrl})`
    el2.style.backgroundSize = 'cover'
    el2.style.backgroundPosition = 'center'
    el2.style.backgroundRepeat = 'no-repeat'
    el2.style.width = `${params.iconWidth}px`
    el2.style.height = `${params.iconHeight}px`
    el2.addEventListener('click', onMarkerClick)
    this.markers[params.uniqueId] = new maplibregl.Marker({ element: el2 })
      .setLngLat([params.longitude, params.latitude])
      .addTo(this.map)
  }

  private handleRemoveMarker(params: { uniqueId: string }): void {
    const m = this.markers[params.uniqueId]
    if (m) {
      m.remove()
      delete this.markers[params.uniqueId]
    }
  }

  private handleAddPolyline(params: PolylineParams): void {
    if (!this.map) return
    const sourceId = `${params.uniqueId}-polylines-source`
    const layerId = `${params.uniqueId}-polylines-layout`

    if (this.map.getLayer(layerId)) this.map.removeLayer(layerId)
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId)

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: params.coordinates,
        },
      },
    })

    this.map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': params.color != null ? params.color : '#000000',
        'line-width': params.width != null ? params.width : 4,
      },
    })
  }

  private handleRemovePolyline(params: { uniqueId: string }): void {
    if (!this.map) return
    const sourceId = `${params.uniqueId}-polylines-source`
    const layerId = `${params.uniqueId}-polylines-layout`
    if (this.map.getLayer(layerId)) this.map.removeLayer(layerId)
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId)
  }

  private handleAddPolygon(params: PolygonParams): void {
    if (!this.map) return
    const sourceId = `${params.uniqueId}-polygons-source`
    const fillLayerId = `${params.uniqueId}-polygons-fill`
    const strokeLayerId = `${params.uniqueId}-polygons-stroke`

    if (this.map.getLayer(strokeLayerId)) this.map.removeLayer(strokeLayerId)
    if (this.map.getLayer(fillLayerId)) this.map.removeLayer(fillLayerId)
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId)

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [params.coordinates],
        },
      },
    })

    const fillPaint: Record<string, unknown> = {
      'fill-color': params.fillColor || 'rgba(0,0,0,0)',
    }
    if (params.fillOpacity != null) {
      fillPaint['fill-opacity'] = params.fillOpacity
    }
    if (params.strokeColor) {
      fillPaint['fill-outline-color'] = params.strokeColor
    }

    this.map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      layout: {},
      paint: fillPaint as maplibregl.FillLayerSpecification['paint'],
    })

    if (params.strokeColor || params.strokeWidth != null) {
      const linePaint: Record<string, unknown> = {}
      if (params.strokeColor) linePaint['line-color'] = params.strokeColor
      if (params.strokeOpacity != null) linePaint['line-opacity'] = params.strokeOpacity
      if (params.strokeWidth != null) linePaint['line-width'] = params.strokeWidth

      this.map.addLayer({
        id: strokeLayerId,
        type: 'line',
        source: sourceId,
        layout: {},
        paint: linePaint as maplibregl.LineLayerSpecification['paint'],
      })
    }
  }

  private handleRemovePolygon(params: { uniqueId: string }): void {
    if (!this.map) return
    const sourceId = `${params.uniqueId}-polygons-source`
    const fillLayerId = `${params.uniqueId}-polygons-fill`
    const strokeLayerId = `${params.uniqueId}-polygons-stroke`
    if (this.map.getLayer(strokeLayerId)) this.map.removeLayer(strokeLayerId)
    if (this.map.getLayer(fillLayerId)) this.map.removeLayer(fillLayerId)
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId)
  }

  private handleFitBounds(params: FitBoundsParams): void {
    if (!this.map) return




    const padding = params.padding ?? 40
    const duration = params.duration ?? 500
    this.map.fitBounds(params.bounds, { padding, duration })
  }

  private handleFlyTo(params: FlyToParams): void {
    if (!this.map) return
    const duration = params.duration ?? 500
    this.map.flyTo({
      center: params.center,
      zoom: params.zoom,
      duration,
    })
  }

  private async handleSetNavigatorPoint(params: SetNavigatorPointParams): Promise<void> {
    if (!this.navigator) {
      const message = 'setNavigatorPoint вызван без navigator:true в init()'
      console.warn(`[maplite] ${message}`)
      postToNative({
        type: 'error',
        data: { target: 'setNavigatorPoint', message },
      })
      return
    }

    try {
      const path = await this.navigator.setDestination([params.longitude, params.latitude])
      postToNative({
        type: 'event',
        event: 'navigatorRouteSet',
        params: {
          destination: { lng: params.longitude, lat: params.latitude },
          distanceMeters: path.distanceMeters,
          timeMs: path.timeMs,
          pointsCount: path.coordinates.length,
          instructionsCount: path.instructions.length,
        },
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (this.debugMode) {
        alert(`setNavigatorPoint failed: ${message}`)
      }
      console.error('[maplite] setNavigatorPoint failed:', message)
      postToNative({
        type: 'error',
        data: { target: 'setNavigatorPoint', message },
      })
    }
  }

  private handleAdvanceNavigatorInstruction(): void {
    if (!this.navigator) return
    const next = this.navigator.advanceInstruction()
    if (!next) return
    postToNative({
      type: 'event',
      event: 'navigatorInstruction',
      params: {
        text: next.text,
        streetName: next.street_name,
        sign: next.sign,
        distance: next.distance,
        time: next.time,
      },
    })
  }

  /**
   * Прямое обновление позиции (например, из реального GPS-фида с нативной
   * стороны). Под капотом — `Navigator.pickPosition`, который сам решает,
   * snap или reroute.
   */
  private async handleSetNavigatorPosition(
    params: SetNavigatorPositionParams
  ): Promise<void> {
    if (!this.navigator) {
      const message = 'setNavigatorPosition: navigator не инициализирован'
      postToNative({ type: 'error', data: { target: 'setNavigatorPosition', message } })
      return
    }
    try {
      const point: [number, number] = [params.longitude, params.latitude]
      const res = await this.navigator.pickPosition(point)
      postToNative({
        type: 'event',
        event: 'navigatorPositionSet',
        params: {
          point: { lng: point[0], lat: point[1] },
          mode: res.mode,
          distanceFromRouteMeters: res.distanceFromRouteMeters,
        },
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[maplite] setNavigatorPosition failed:', message)
      postToNative({ type: 'error', data: { target: 'setNavigatorPosition', message } })
    }
  }

  /**
   * Дев-команда: следующий клик по карте назначает «текущее положение».
   * Реальный продукт обычно использует `setNavigatorPosition` напрямую.
   */
  private handlePickNavigatorPosition(): void {
    if (!this.navigator) return
    const nav = this.navigator
    nav.beginPickPositionOnce((point) => {
      void (async () => {
        try {
          const res = await nav.pickPosition(point)
          postToNative({
            type: 'event',
            event: 'navigatorPositionSet',
            params: {
              point: { lng: point[0], lat: point[1] },
              mode: res.mode,
              distanceFromRouteMeters: res.distanceFromRouteMeters,
            },
          })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.error('[maplite] pickNavigatorPosition failed:', message)
          postToNative({
            type: 'error',
            data: { target: 'pickNavigatorPosition', message },
          })
        }
      })()
    })
  }
}
