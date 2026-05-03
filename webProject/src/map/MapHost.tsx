import { useCallback, useEffect, useRef } from 'react'

import { fetchDemoStyle } from './demoStyle'
import { MapLiteController } from './MapLiteController'
import { PluginEmulatorBar } from './PluginEmulatorBar'
import { postToNative, subscribeNativeInbound } from './nativeBridge'

import 'maplibre-gl/dist/maplibre-gl.css'
import './mapHost.css'

type MapHostProps = {
  /** When true, `alert()` on web handler errors (matches RN `debugMode`). */
  debugMode?: boolean
  /**
   * If there is no `window.ReactNativeWebView`, auto-load a demo map after `scriptReady`
   * so `npm run dev` works without the native shell.
   */
  devAutoInit?: boolean
  /** Панель кнопок: те же JSON-команды, что приходит из React Native через postMessage. */
  nativeMessageEmulator?: boolean
}

export function MapHost({
  debugMode = false,
  devAutoInit = true,
  nativeMessageEmulator = false,
}: MapHostProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<MapLiteController | null>(null)

  const sendCommand = useCallback((fn: string, params: Record<string, unknown>) => {
    controllerRef.current?.receive(JSON.stringify({ function: fn, params }))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const controller = new MapLiteController(el, { debugMode })
    controllerRef.current = controller

    const receive = (data: string) => controller.receive(data)
    window.__MAP_LITE_RECEIVE__ = receive

    const unsub = subscribeNativeInbound(receive)

    postToNative({ type: 'scriptReady' })

    let cancelled = false
    const runDevInit = async () => {
      if (window.ReactNativeWebView?.postMessage) return
      if (!devAutoInit) return
      try {
        const mapStyle = await fetchDemoStyle()
        if (cancelled) return
        receive(
          JSON.stringify({
            function: 'init',
            params: {
              mapStyle,
              zoomEnabled: true,
              scrollEnabled: true,
              center: [39.599229, 52.608820] as [number, number],
              zoom: 16,
              antialias: true,
              crossSourceCollisions: true,
              fadeDuration: 120,
              simplifyStyle: false,
              aggressiveSimplifyStyle: false,
              maxPitch: 60,
              renderWorldCopies: true,
              turboWhileMoving: false,
            },
          })
        )
      } catch {
        /* non-fatal in dev */
      }
    }
    void runDevInit()

    return () => {
      cancelled = true
      unsub()
      if (window.__MAP_LITE_RECEIVE__ === receive) {
        delete window.__MAP_LITE_RECEIVE__
      }
      controller.destroy()
      controllerRef.current = null
    }
  }, [debugMode, devAutoInit])

  return (
    <div className="maplite-host">
      {nativeMessageEmulator ? <PluginEmulatorBar send={sendCommand} /> : null}
      <div ref={containerRef} id="map" className="maplite-root" aria-label="Map" />
    </div>
  )
}
