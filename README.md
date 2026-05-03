# react-native-maplibre-lite

Lightweight MapLibre for React Native powered by `WebView`.

`react-native-maplibre-lite` renders a bundled MapLibre GL JS runtime inside a React Native app and exposes a small React API:

- `MapView`
- `Marker`
- `Polyline`
- `Polygon`

It is designed for teams that want a practical MapLibre integration without native SDK setup complexity.

## Features

- MapLibre GL JS in a React Native component
- Declarative overlays: `Marker`, `Polyline`, `Polygon`
- Built-in PMTiles protocol support
- Built-in 3D building extrusion for compatible vector styles
- Imperative camera methods: `fitBounds()` and `flyTo()`
- Optional `autoFitBounds` for markers, polylines and polygons
- Custom marker icons or marker HTML
- Optional navigator mode with GraphHopper routes, HUD, route snapping and rerouting
- Map style caching through `AsyncStorage`
- Android performance controls: `performanceMode`, `turboWhileMoving`, `pixelRatio`

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
import { Button, View } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  Polygon,
  type MapViewRef,
} from 'react-native-maplibre-lite';

export function MapScreen() {
  const mapRef = useRef<MapViewRef>(null);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        placeholderTheme="light"
        center={[37.6173, 55.7558]}
        zoom={11}
        mapStyle="https://demotiles.maplibre.org/style.json"
        zoomEnabled
        scrollEnabled
        autoFitBounds
        fitBoundsPadding={48}
        onReady={() => console.log('map ready')}
      >
        <Marker
          uniqueId="m-1"
          latitude={55.7558}
          longitude={37.6173}
          color="#1D4ED8"
          onPress={() => console.log('marker pressed')}
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
            [37.6, 55.75],
            [37.62, 55.77],
            [37.66, 55.75],
            [37.6, 55.75],
          ]}
        />
      </MapView>

      <Button
        title="Fly to Moscow center"
        onPress={() => mapRef.current?.flyTo([37.6173, 55.7558], 14)}
      />
    </View>
  );
}
```

Coordinates use `[longitude, latitude]`, the same order as GeoJSON and GraphHopper. Marker props still accept `latitude` and `longitude` separately.

## Navigator Mode

Navigator mode adds a route line, a current-position arrow, a driving HUD and GraphHopper-based route recalculation.

```tsx
import React, { useRef } from 'react';
import { Button, View } from 'react-native';
import MapView, { type MapViewRef } from 'react-native-maplibre-lite';

export function NavigatorScreen() {
  const mapRef = useRef<MapViewRef>(null);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        center={[37.6173, 55.7558]}
        zoom={17}
        mapStyle="https://example.com/style.json"
        navigator
        graphhopperUrl="https://graphhopper.example.com"
        navigatorLang="ru"
        zoomEnabled
        scrollEnabled
        onNavigatorRouteSet={(route) => console.log('route', route)}
        onNavigatorInstruction={(instruction) =>
          console.log('next instruction', instruction)
        }
        onNavigatorPositionSet={(position) => console.log('position', position)}
        onMapLiteError={(error) => console.warn(error)}
      />

      <Button
        title="Build route"
        onPress={() => mapRef.current?.setNavigatorPoint(55.76, 37.64)}
      />
    </View>
  );
}
```

`graphhopperUrl` is the base URL without the required `/route` suffix. The plugin sends `POST {graphhopperUrl}/route` with `points_encoded: false`, `instructions: true`, and `locale` from `navigatorLang`.

Use `setNavigatorPosition(latitude, longitude)` to feed real GPS updates. The WebView side snaps the position to the route, marks arrival, or reroutes when the point is too far from the current route. `pickNavigatorPosition()` is a development helper: the next tap on the map becomes the current navigator position.

## API

### `MapView` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `center` | `[number, number]` | yes | Initial map center as `[lng, lat]` |
| `zoom` | `number` | yes | Initial zoom level |
| `mapStyle` | `string` | yes | MapLibre style URL. The style JSON is fetched and cached with `AsyncStorage` |
| `style` | `StyleProp<ViewStyle>` | yes | Container style |
| `placeholderTheme` | `'light' \| 'dark'` | no | Placeholder theme before map init. Defaults to `light` |
| `minZoom` | `number` | no | Minimum zoom |
| `maxZoom` | `number` | no | Maximum zoom |
| `zoomEnabled` | `boolean` | no | Enable double-tap zoom, pinch zoom and rotation |
| `scrollEnabled` | `boolean` | no | Enable pan and scroll gestures |
| `showSelectPoint` | `boolean` | no | Show animated center pointer |
| `selectPointColor` | `string` | no | Center pointer color |
| `selectPointBackgroundColor` | `string` | no | Center pointer background |
| `autoFitBounds` | `boolean` | no | Automatically fit camera to visible overlays after overlay changes |
| `fitBoundsPadding` | `number` | no | Padding for `fitBounds()` and `autoFitBounds`. Defaults to `40` |
| `fitBoundsDuration` | `number` | no | Animation duration for `fitBounds()`. Defaults to `500` |
| `flyToDuration` | `number` | no | Animation duration for `flyTo()`. Defaults to `500` |
| `performanceMode` | `'quality' \| 'balanced' \| 'performance'` | no | Rendering quality/performance profile |
| `pixelRatio` | `number` | no | Manual renderer pixel ratio override |
| `turboWhileMoving` | `boolean` | no | Hide polyline/polygon overlays while map moves |
| `debugMode` | `boolean` | no | Enables extra WebView-side debug alerts/logging |
| `navigator` | `boolean` | no | Enable navigator mode |
| `graphhopperUrl` | `string` | no | Base GraphHopper URL for navigator routes |
| `navigatorLang` | `'ru' \| 'en'` | no | Navigator HUD and instruction language. Defaults to `ru` |
| `onReady` | `() => void` | no | Called after the WebView map is initialized |
| `onMoveStart` | `(params) => void` | no | `movestart` event |
| `onMoveEnd` | `(params) => void` | no | `moveend` event |
| `onZoomStart` | `(params) => void` | no | `zoomstart` event |
| `onZoomEnd` | `(params) => void` | no | `zoomend` event |
| `onIdle` | `(params) => void` | no | `idle` event |
| `onNavigatorRouteSet` | `(params) => void` | no | Called after navigator route creation |
| `onNavigatorInstruction` | `(params) => void` | no | Called when a navigator instruction is advanced |
| `onNavigatorPositionSet` | `(params) => void` | no | Called after navigator position update/snap/reroute |
| `onMapLiteError` | `(error) => void` | no | WebView command error callback |

### `MapView` ref

| Method | Description |
| --- | --- |
| `fitBounds()` | Fits camera to current markers, polylines and polygons |
| `flyTo(center, zoom)` | Animates camera to `[lng, lat]` and zoom |
| `setNavigatorPoint(latitude, longitude)` | Builds a navigator route to the destination. Requires `navigator` |
| `advanceNavigatorInstruction()` | Advances to the next navigator instruction |
| `setNavigatorPosition(latitude, longitude)` | Updates current navigator position from GPS or another source |
| `pickNavigatorPosition()` | Dev helper: next map tap sets current navigator position |

### `Marker` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `uniqueId` | `string` | yes | Unique overlay id |
| `latitude` | `number` | yes | Marker latitude |
| `longitude` | `number` | yes | Marker longitude |
| `onPress` | `() => void` | no | Press callback |
| `ignoreFitBounds` | `boolean` | no | Exclude marker from `fitBounds()` and `autoFitBounds` |
| `color` | `string` | no | Default MapLibre marker color |
| `iconUrl` | `string` | no | Custom marker image URL |
| `iconWidth` | `number` | no | Custom icon width |
| `iconHeight` | `number` | no | Custom icon height |
| `html` | `string` | no | Custom marker HTML. If provided, it takes priority over `iconUrl` and `color` |

### `Polyline` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `uniqueId` | `string` | yes | Unique overlay id |
| `coordinates` | `[number, number][]` | yes | Line coordinates as `[lng, lat]` |
| `ignoreFitBounds` | `boolean` | no | Exclude line from `fitBounds()` and `autoFitBounds` |
| `color` | `string` | no | Line color. Defaults to `#000000` |
| `width` | `number` | no | Line width. Defaults to `4` |

### `Polygon` props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `uniqueId` | `string` | yes | Unique overlay id |
| `coordinates` | `[number, number][]` | yes | Polygon ring coordinates as `[lng, lat]` |
| `ignoreFitBounds` | `boolean` | no | Exclude polygon from `fitBounds()` and `autoFitBounds` |
| `fillColor` | `string` | no | Fill color |
| `fillOpacity` | `number` | no | Fill opacity |
| `strokeColor` | `string` | no | Stroke color |
| `strokeOpacity` | `number` | no | Stroke opacity |
| `strokeWidth` | `number` | no | Stroke width |

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
- `performance`: aggressive optimizations, lower renderer resolution, simplified style and reduced map effects

Tips:

- If you still see frame drops, pass a lower `pixelRatio`, for example `0.75`
- Keep number of simultaneously visible overlays moderate
- Prefer simpler map styles with fewer labels and 3D layers

## Web Bundle Development

The WebView runtime is generated from `webProject` and committed as `src/components/webMapBuild.ts`.

```bash
cd webProject
npm install
npm run build
```

`npm run build` runs Vite and then `webProject/scripts/inlineHtml.mjs`, which writes the single-file HTML bundle back into `src/components/webMapBuild.ts`.

## Contributing

See the [contributing guide](CONTRIBUTING.md) for local setup and development workflow.

## License

MIT
