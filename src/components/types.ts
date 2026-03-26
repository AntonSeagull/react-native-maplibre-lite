
export type MarkerProps = {
    uniqueId: string,
    onPress?: () => void,
    latitude: number,
    longitude: number,
    color?: string,

    iconUrl?: string,
    iconWidth?: number,
    iconHeight?: number,

}

export type SourcesProps = {
    maplibreJS: string;
    maplibreCSS: string;
    pmtilesJS: string;
}

export type PolygonProps = {
    uniqueId: string,
    coordinates: [number, number][],
    fillColor?: string,
    fillOpacity?: number,
    strokeColor?: string,
    strokeOpacity?: number,
    strokeWidth?: number,

}

export type PolylineProps = {
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