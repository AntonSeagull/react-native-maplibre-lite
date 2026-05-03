
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