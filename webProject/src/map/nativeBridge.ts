import type { WebToNativeMessage } from './types'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
    __MAP_LITE_RECEIVE__?: (data: string) => void
  }
}

export function postToNative(payload: WebToNativeMessage): void {
  const str = JSON.stringify(payload)
  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(str)
    return
  }
  window.dispatchEvent(new CustomEvent('maplite-to-native', { detail: str }))
  if (import.meta.env.DEV) {
    console.debug('[maplite web → native]', payload)
  }
}

function extractMessageData(event: Event): string | undefined {
  const d = (event as MessageEvent).data
  if (typeof d === 'string') return d
  if (d != null && typeof d === 'object') {
    try {
      return JSON.stringify(d)
    } catch {
      return undefined
    }
  }
  // React Native Android: CustomEvent-like with `data` on `event` in some builds
  const anyEv = event as unknown as { data?: string }
  if (typeof anyEv.data === 'string') return anyEv.data
  return undefined
}

/**
 * Same dual listeners as `webContent.ts` (Android `document`, iOS `window`).
 */
export function subscribeNativeInbound(handler: (data: string) => void): () => void {
  const onDoc = (event: Event) => {
    const raw = extractMessageData(event)
    if (raw != null) handler(raw)
  }
  const onWin = (event: MessageEvent) => {
    const raw = extractMessageData(event)
    if (raw != null) handler(raw)
  }
  document.addEventListener('message', onDoc as EventListener)
  window.addEventListener('message', onWin)
  return () => {
    document.removeEventListener('message', onDoc as EventListener)
    window.removeEventListener('message', onWin)
  }
}
