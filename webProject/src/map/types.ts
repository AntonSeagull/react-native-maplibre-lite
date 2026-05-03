/** Mirrors `src/components/types.ts` in the RN package — keep in sync for WebView messages. */

export type EventParams = {
  center?: { lng: number; lat: number } | null
  zoom?: number | null
}

export type NativeToWebCommand = {
  function: string
  params?: Record<string, unknown>
}

export type WebToNativeMessage =
  | { type: 'scriptReady' }
  | { type: 'inited' }
  | { type: 'event'; event: string; params: unknown }
  | { type: 'markerClick'; uniqueId: string }
  | {
      type: 'error'
      data: { target: string; message: string }
    }
