import { useCallback, useState } from 'react'

import { resolveDevGraphhopperUrl, resolveDevMapStyle } from './devMapSettings'

import './pluginEmulator.css'

export type PluginCommandSend = (fn: string, params: Record<string, unknown>) => void

/** Липецк (Соборная площадь) — все dev-объекты вокруг этой точки. */
const DEMO_CENTER: [number, number] = [39.599229, 52.608820]
const MARKER_ID = 'dev-marker-1'
const LINE_ID = 'dev-line-1'
const POLY_ID = 'dev-poly-1'

/**
 * Случайная точка вокруг Соборной площади Липецка для теста маршрута:
 *  ±0.025° по lng (~1.7 км) и ±0.020° по lat (~2.2 км) — далеко не пешком,
 *  но в пределах города, чтобы /route стабильно возвращал результат.
 */
function randomLipetskPoint(): [number, number] {
  const dLng = (Math.random() - 0.5) * 0.05
  const dLat = (Math.random() - 0.5) * 0.04
  return [DEMO_CENTER[0] + dLng, DEMO_CENTER[1] + dLat]
}

/** Кольцо вокруг центра (lng, lat) */
function ringAround(center: [number, number], delta: number): [number, number][] {
  const [lng, lat] = center
  return [
    [lng - delta, lat - delta],
    [lng + delta, lat - delta],
    [lng + delta, lat + delta],
    [lng - delta, lat + delta],
    [lng - delta, lat - delta],
  ]
}

const lineCoords = (() => {
  const [lng, lat] = DEMO_CENTER
  const d = 0.04
  return [
    [lng - d, lat - d * 0.5],
    [lng, lat + d * 0.3],
    [lng + d, lat - d * 0.2],
  ] as [number, number][]
})()

const polygonRing = ringAround(DEMO_CENTER, 0.06)

type Props = {
  send: PluginCommandSend
}

export function PluginEmulatorBar({ send }: Props) {
  const [busy, setBusy] = useState(false)
  const [zoomEnabled, setZoomEnabled] = useState(true)
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastNavigatorPoint, setLastNavigatorPoint] = useState<[number, number] | null>(null)

  const wrap = useCallback(
    async (label: string, fn: () => void | Promise<void>) => {
      setLastError(null)
      setBusy(true)
      try {
        await fn()
      } catch (e) {
        setLastError(`${label}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setBusy(false)
      }
    },
    []
  )

  const btn = (label: string, onClick: () => void | Promise<void>) => (
    <button
      type="button"
      className="plugin-emulator__btn"
      disabled={busy}
      onClick={() => void wrap(label, onClick)}
    >
      {label}
    </button>
  )

  return (
    <div className="plugin-emulator" role="region" aria-label="Эмулятор команд React Native">
      <div className="plugin-emulator__title">RN → Web (как postMessage)</div>
      <div className="plugin-emulator__row">
        {btn('init', async () => {
          const mapStyle = await resolveDevMapStyle()
          send('init', {
            mapStyle,
            zoomEnabled: true,
            scrollEnabled: true,
            center: DEMO_CENTER,
            zoom: 10,
            antialias: false,
            crossSourceCollisions: true,
            fadeDuration: 120,
            simplifyStyle: false,
            aggressiveSimplifyStyle: false,
            maxPitch: 45,
            renderWorldCopies: true,
            turboWhileMoving: false,
          })
        })}
        {btn('update (toggle zoom)', () => {
          const next = !zoomEnabled
          setZoomEnabled(next)
          send('update', { zoomEnabled: next })
        })}
        {btn('update (toggle scroll)', () => {
          const next = !scrollEnabled
          setScrollEnabled(next)
          send('update', { scrollEnabled: next })
        })}
        {btn('flyTo', () =>
          send('flyTo', {
            center: [DEMO_CENTER[0] + 0.08, DEMO_CENTER[1] + 0.05],
            zoom: 11,
            duration: 800,
          })
        )}
        {btn('fitBounds', () =>
          send('fitBounds', {
            bounds: [
              [DEMO_CENTER[0] - 0.15, DEMO_CENTER[1] - 0.12],
              [DEMO_CENTER[0] + 0.15, DEMO_CENTER[1] + 0.12],
            ],
            padding: 48,
            duration: 700,
          })
        )}
      </div>
      <div className="plugin-emulator__row">
        {btn('addMarker', () =>
          send('addMarker', {
            uniqueId: MARKER_ID,
            latitude: DEMO_CENTER[1] + 0.02,
            longitude: DEMO_CENTER[0] - 0.02,
            color: '#e11d48',
          })
        )}
        {btn('removeMarker', () => send('removeMarker', { uniqueId: MARKER_ID }))}
        {btn('addPolyline', () =>
          send('addPolyline', {
            uniqueId: LINE_ID,
            coordinates: lineCoords,
            color: '#2563eb',
            width: 5,
          })
        )}
        {btn('removePolyline', () => send('removePolyline', { uniqueId: LINE_ID }))}
        {btn('addPolygon', () =>
          send('addPolygon', {
            uniqueId: POLY_ID,
            coordinates: polygonRing,
            fillColor: 'rgba(34, 197, 94, 0.35)',
            fillOpacity: 0.5,
            strokeColor: '#15803d',
            strokeOpacity: 1,
            strokeWidth: 2,
          })
        )}
        {btn('removePolygon', () => send('removePolygon', { uniqueId: POLY_ID }))}
      </div>
      <div className="plugin-emulator__row">
        {btn('init (как навигатор)', async () => {
          const mapStyle = await resolveDevMapStyle()
          const graphhopperUrl = resolveDevGraphhopperUrl()
          send('init', {
            mapStyle,
            zoomEnabled: true,
            scrollEnabled: true,
            center: DEMO_CENTER,
            zoom: 17,
            antialias: true,
            crossSourceCollisions: true,
            fadeDuration: 120,
            simplifyStyle: false,
            aggressiveSimplifyStyle: false,
            maxPitch: 75,
            renderWorldCopies: true,
            turboWhileMoving: false,
            navigator: true,
            ...(graphhopperUrl != null ? { graphhopperUrl } : {}),
          })
          setLastNavigatorPoint(null)
        })}
        {btn('setNavigatorPoint (рандом по Липецку)', () => {
          const dst = randomLipetskPoint()
          setLastNavigatorPoint(dst)
          send('setNavigatorPoint', {
            longitude: dst[0],
            latitude: dst[1],
          })
        })}
        {btn('next step ▶', () => send('advanceNavigatorInstruction', {}))}
        {btn('указать положение (клик по карте)', () =>
          send('pickNavigatorPosition', {})
        )}
        {lastNavigatorPoint ? (
          <span className="plugin-emulator__hint">
            → {lastNavigatorPoint[1].toFixed(5)}, {lastNavigatorPoint[0].toFixed(5)}
          </span>
        ) : null}
      </div>
      {lastError ? <div className="plugin-emulator__error">{lastError}</div> : null}
    </div>
  )
}
