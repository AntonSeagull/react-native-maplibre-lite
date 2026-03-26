# react-native-maplibre-lite

Lightweight MapLibre for React Native powered by `WebView`.

`react-native-maplibre-lite` renders MapLibre GL JS inside a React Native app with a small, practical API:

- `MapView`
- `Marker`
- `Polyline`
- `Polygon`

It is designed for teams that want a simple MapLibre integration without native SDK setup complexity.

## Features

- MapLibre GL JS in a React Native component
- Declarative overlays (`Marker`, `Polyline`, `Polygon`)
- Imperative `fitBounds()` via ref
- Built-in JS/CSS asset caching using `AsyncStorage`
- Android performance controls (`performanceMode`, `turboWhileMoving`, `pixelRatio`)

## Installation

```bash
npm install react-native-maplibre-lite react-native-webview @react-native-async-storage/async-storage
```

or

```bash
yarn add react-native-maplibre-lite react-native-webview @react-native-async-storage/async-storage
```

## Quick Start

```tsx
import React, { useRef } from 'react';
import { View } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  Polygon,
  type MapViewRef,
} from 'react-native-maplibre-lite';

const SOURCES = {
  maplibreJS: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  maplibreCSS: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  pmtilesJS: 'https://unpkg.com/pmtiles@3.0.7/dist/pmtiles.js',
};

export function MapScreen() {
  const mapRef = useRef<MapViewRef>(null);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        theme="light"
        center={[37.6173, 55.7558]}
        zoom={11}
        mapStyle="https://demotiles.maplibre.org/style.json"
        zoomEnabled
        scrollEnabled
        sources={SOURCES}
      >
        <Marker
          uniqueId="m-1"
          latitude={55.7558}
          longitude={37.6173}
          color="#1D4ED8"
        />

        <Polyline
          uniqueId="line-1"
          color="#2563EB"
          width={4}
          coordinates={[
            [37.61, 55.75],
            [37.63, 55.76],
            [37.65, 55.74],
          ]}
        />

        <Polygon
          uniqueId="poly-1"
          fillColor="#2563EB"
          fillOpacity={0.15}
          strokeColor="#2563EB"
          strokeWidth={2}
          coordinates={[
            [37.60, 55.75],
            [37.62, 55.77],
            [37.66, 55.75],
            [37.60, 55.75],
          ]}
        />
      </MapView>
    </View>
  );
}
```

## API

### `MapView` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark'` | yes | Placeholder theme before map init |
| `center` | `[number, number]` | yes | Initial map center as `[lng, lat]` |
| `zoom` | `number` | yes | Initial zoom level |
| `mapStyle` | `string` | yes | MapLibre style URL |
| `style` | `StyleProp<ViewStyle>` | yes | Container style |
| `sources` | `{ maplibreJS; maplibreCSS; pmtilesJS }` | yes | URLs for MapLibre/PMTiles runtime assets |
| `minZoom` | `number` | no | Minimum zoom |
| `maxZoom` | `number` | no | Maximum zoom |
| `zoomEnabled` | `boolean` | no | Enable zoom gestures |
| `scrollEnabled` | `boolean` | no | Enable pan/scroll gestures |
| `showSelectPoint` | `boolean` | no | Show animated center pointer |
| `selectPointColor` | `string` | no | Center pointer color |
| `selectPointBackgroundColor` | `string` | no | Center pointer background |
| `onMoveStart` | `(params) => void` | no | `movestart` event |
| `onMoveEnd` | `(params) => void` | no | `moveend` event |
| `onZoomStart` | `(params) => void` | no | `zoomstart` event |
| `onZoomEnd` | `(params) => void` | no | `zoomend` event |
| `onIdle` | `(params) => void` | no | `idle` event |
| `performanceMode` | `'quality' \| 'balanced' \| 'performance'` | no | Rendering quality/performance profile |
| `pixelRatio` | `number` | no | Manual renderer pixel ratio override |
| `turboWhileMoving` | `boolean` | no | Hide polyline/polygon overlays while map moves |

### `MapView` ref

| Method | Description |
| --- | --- |
| `fitBounds()` | Fits camera to all current markers/polylines/polygons |

### `Marker` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `uniqueId` | `string` | yes | Unique overlay id |
| `latitude` | `number` | yes | Marker latitude |
| `longitude` | `number` | yes | Marker longitude |
| `onPress` | `() => void` | no | Press callback |
| `color` | `string` | no | Default marker color |
| `iconUrl` | `string` | no | Custom marker image URL |
| `iconWidth` | `number` | no | Custom icon width |
| `iconHeight` | `number` | no | Custom icon height |

### `Polyline` props

| Prop | Type | Required |
| --- | --- | --- |
| `uniqueId` | `string` | yes |
| `coordinates` | `[number, number][]` | yes |
| `color` | `string` | no |
| `width` | `number` | no |

### `Polygon` props

| Prop | Type | Required |
| --- | --- | --- |
| `uniqueId` | `string` | yes |
| `coordinates` | `[number, number][]` | yes |
| `fillColor` | `string` | no |
| `fillOpacity` | `number` | no |
| `strokeColor` | `string` | no |
| `strokeOpacity` | `number` | no |
| `strokeWidth` | `number` | no |

## Performance Tuning (Android)

Start with:

```tsx
<MapView
  // ...
  performanceMode="performance"
  turboWhileMoving
/>
```

Profiles:

- `quality`: best visual quality
- `balanced`: default on Android; better FPS with moderate quality reduction
- `performance`: aggressive optimizations (lower renderer resolution, simplified style, reduced map effects)

Tips:

- If you still see frame drops, pass a lower `pixelRatio` (example: `0.75`)
- Keep number of simultaneously visible overlays moderate
- Prefer simpler map styles (fewer labels/3D layers)

## Contributing

See the [contributing guide](CONTRIBUTING.md) for local setup and development workflow.

## License

MIT
