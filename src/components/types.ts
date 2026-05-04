
export type MarkerProps = {
    ignoreFitBounds?: boolean,
    uniqueId: string,
    onPress?: () => void,
    latitude: number,
    longitude: number,
    color?: string,

    iconUrl?: string,
    iconWidth?: number,
    iconHeight?: number,
    html?: string,

}

export type PolygonProps = {
    ignoreFitBounds?: boolean,
    uniqueId: string,
    coordinates: [number, number][],
    fillColor?: string,
    fillOpacity?: number,
    strokeColor?: string,
    strokeOpacity?: number,
    strokeWidth?: number,

}

export type PolylineProps = {
    ignoreFitBounds?: boolean,
    uniqueId: string,
    color?: string,
    width?: number,
    coordinates: [number, number][],

}

export type EventParams = {
    center?: {
        lng: number,
        lat: number
    },
    zoom?: number
}

export type NavigatorLang = 'ru' | 'en'

/**
 * Navigator look-and-feel (route line, arrow accent, HUD). Passed to WebView `init` as `navigatorChrome`.
 * All fields are optional; defaults match the built-in blue theme.
 */
export type NavigatorChromeParams = {
    /** Accent in hex (`#rgb` / `#rrggbb`): map arrow gradient and maneuver icon tile in the HUD. */
    accent?: string,
    /** Main route line color (default was `#3b82f6`). */
    routeLine?: string,
    /** Wide route line underlay (default was `#1e3a8a`). */
    routeOutline?: string,
    /** HUD panel background: any valid CSS (`rgba(...)`, `linear-gradient(...)`, etc.). */
    hudBackground?: string,
    /** Primary text color on the HUD. */
    hudForeground?: string,
    /** Secondary text (street, summary, ETA); divider tone is derived from this when it is hex. */
    hudMuted?: string,
}

/** Значения `profile` для GraphHopper `POST …/route` (см. документацию GH). */
export const NAVIGATOR_PROFILE_IDS = [
    'car',
    'car_avoid_motorway',
    'car_avoid_ferry',
    'car_avoid_toll',
    'small_truck',
    'truck',
    'scooter',
    'foot',
    'hike',
    'bike',
    'mtb',
    'racingbike',
    'ecargobike',
] as const

export type NavigatorProfile = (typeof NAVIGATOR_PROFILE_IDS)[number]

/** [longitude, latitude] — как в GeoJSON / GraphHopper. */
export type NavigatorLngLat = {
    lng: number,
    lat: number,
}

export type NavigatorRouteSetParams = {
    destination: NavigatorLngLat,
    distanceMeters?: number,
    timeMs?: number,
    pointsCount: number,
    instructionsCount: number,
}

export type NavigatorInstructionParams = {
    text: string,
    streetName?: string,
    sign: number,
    distance: number,
    time: number,
}

export type NavigatorPositionMode = 'noRoute' | 'arrived' | 'snapped' | 'rerouted'

export type NavigatorPositionSetParams = {
    point: NavigatorLngLat,
    mode: NavigatorPositionMode,
    distanceFromRouteMeters: number,
}

export type MapLiteWebError = {
    target: string,
    message: string,
}