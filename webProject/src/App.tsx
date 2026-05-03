import { isDEV } from './devFlags'
import { MapHost } from './map/MapHost'

function App() {
  return (
    <MapHost
      nativeMessageEmulator={isDEV}
      devAutoInit={!isDEV}
    />
  )
}

export default App
