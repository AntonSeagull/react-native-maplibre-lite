import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  type StyleProp,
  Platform,
  View,
  type ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { maplibreHtmlMap } from '../webContent';
import MapPlaceholder from './MapPlaceholder';
import MapSelectPoint, { type MapSelectPointType } from './MapSelectPoint';
import {
  type EventParams,
  type MarkerProps,
  type PolygonProps,
  type PolylineProps,
  type SourcesProps,
} from './types';
import addMarkerWeb from './webFunctions/addMarkerWeb';
import addPolygonWeb from './webFunctions/addPolygonWeb';
import addPolylineWeb from './webFunctions/addPolylineWeb';
import fitBoundsWeb from './webFunctions/fitBoundsWeb';
import initWeb from './webFunctions/initWeb';
import removeMarkerWeb from './webFunctions/removeMarkerWeb';
import removePolygonWeb from './webFunctions/removePolygonWeb';
import removePolylineWeb from './webFunctions/removePolylineWeb';

interface MapViewProps {
    children?: React.ReactNode;

    theme: 'light' | 'dark';
    center: [number, number];
    zoom: number;

    mapStyle: string;
    style: StyleProp<ViewStyle>;
    minZoom?: number;
    maxZoom?: number;
    zoomEnabled?: boolean;
    scrollEnabled?: boolean;
    onMoveStart?: (eventParams: EventParams) => void;
    onMoveEnd?: (eventParams: EventParams) => void;
    onZoomStart?: (eventParams: EventParams) => void;
    onZoomEnd?: (eventParams: EventParams) => void;
    onIdle?: (eventParams: EventParams) => void;
    showSelectPoint?: boolean;
    selectPointColor?: string;
    selectPointBackgroundColor?: string;
    performanceMode?: 'quality' | 'balanced' | 'performance';
    pixelRatio?: number;
    turboWhileMoving?: boolean;

    sources: SourcesProps;
}

export type MapViewRef = {
    fitBounds: () => void;
};

type MapViewRegistry = {
    addMarker: (propsMarker: MarkerProps) => void;
    removeMarker: (propsMarker: MarkerProps) => void;
    addPolyline: (propsPolyline: PolylineProps) => void;
    removePolyline: (propsPolyline: PolylineProps) => void;
    addPolygon: (propsPolygon: PolygonProps) => void;
    removePolygon: (propsPolygon: PolygonProps) => void;
};

const MapViewContext = createContext<MapViewRegistry | null>(null);

export const useMapViewContext = () => {
    const ctx = useContext(MapViewContext);
    if (!ctx) throw new Error('useMapViewContext must be used within <MapView>');
    return ctx;
};

const webFunctionsString = [
    initWeb,
    addMarkerWeb,
    removeMarkerWeb,
    addPolylineWeb,
    removePolylineWeb,
    addPolygonWeb,
    removePolygonWeb,
    fitBoundsWeb,
].join('\n');

const getBoundsFromCoords = (
    coords: [number, number][]
): [[number, number], [number, number]] => {
    if (!coords.length) {
        throw new Error('Empty coordinates array');
    }

    let minLng = coords[0]![0];
    let maxLng = coords[0]![0];
    let minLat = coords[0]![1];
    let maxLat = coords[0]![1];

    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }

    return [
        [minLng, minLat],
        [maxLng, maxLat],
    ];
};

export const MapView = forwardRef<MapViewRef, MapViewProps>((props, ref) => {
    const webViewRef = useRef<any>(null);
    const [inited, setInited] = useState(false);
    const [html, setHtml] = useState('');

    const coordsInMapRef = useRef<Record<string, [number, number][]>>({});
    const markersClickHandlers = useRef<Record<string, () => void>>({});
    const mapSelectPointRef = useRef<MapSelectPointType | null>(null);
    const performanceMode = props.performanceMode ?? (Platform.OS === 'android' ? 'balanced' : 'quality');

    const fallbackPixelRatio = performanceMode === 'performance'
        ? 0.85
        : (performanceMode === 'balanced' && Platform.OS === 'android' ? 1 : undefined);

    const sendToWebView = useCallback((message: { function: string; params: any }) => {
        webViewRef.current?.postMessage(JSON.stringify(message));
    }, []);

    const initMap = useCallback(() => {
        sendToWebView({
            function: 'init',
            params: {
                style: props.mapStyle,
                zoomEnabled: props.zoomEnabled ?? false,
                scrollEnabled: props.scrollEnabled ?? false,
                theme: props.theme,
                center: props.center,
                zoom: props.zoom,
                minZoom: props.minZoom,
                maxZoom: props.maxZoom,
                antialias: false,
                crossSourceCollisions: performanceMode !== 'performance',
                fadeDuration: performanceMode === 'performance' ? 0 : 120,
                pixelRatio: props.pixelRatio ?? fallbackPixelRatio,
                simplifyStyle: performanceMode !== 'quality',
                aggressiveSimplifyStyle: performanceMode === 'performance',
                maxPitch: performanceMode === 'performance' ? 0 : 45,
                renderWorldCopies: performanceMode === 'quality',
                turboWhileMoving: props.turboWhileMoving ?? (performanceMode === 'performance'),
            },
        });
    }, [sendToWebView, props.zoomEnabled, props.scrollEnabled, props.theme, props.center, props.zoom, props.minZoom, props.maxZoom, props.mapStyle, performanceMode, props.pixelRatio, fallbackPixelRatio, props.turboWhileMoving]);

    const addMarker = useCallback((propsMarker: MarkerProps) => {
        if (propsMarker.latitude && propsMarker.longitude) {
            coordsInMapRef.current[propsMarker.uniqueId] = [[propsMarker.longitude, propsMarker.latitude]];
        }

        if (propsMarker.onPress) {
            markersClickHandlers.current[propsMarker.uniqueId] = propsMarker.onPress;
        } else {
            delete markersClickHandlers.current[propsMarker.uniqueId];
        }

        sendToWebView({ function: 'addMarker', params: propsMarker });
    }, [sendToWebView]);

    const removeMarker = useCallback((propsMarker: MarkerProps) => {
        delete coordsInMapRef.current[propsMarker.uniqueId];
        delete markersClickHandlers.current[propsMarker.uniqueId];
        sendToWebView({ function: 'removeMarker', params: propsMarker });
    }, [sendToWebView]);

    const addPolyline = useCallback((propsPolyline: PolylineProps) => {
        if (propsPolyline.coordinates) {
            coordsInMapRef.current[propsPolyline.uniqueId] = propsPolyline.coordinates;
        }
        sendToWebView({ function: 'addPolyline', params: propsPolyline });
    }, [sendToWebView]);

    const removePolyline = useCallback((propsPolyline: PolylineProps) => {
        delete coordsInMapRef.current[propsPolyline.uniqueId];
        sendToWebView({ function: 'removePolyline', params: propsPolyline });
    }, [sendToWebView]);

    const addPolygon = useCallback((propsPolygon: PolygonProps) => {
        if (propsPolygon.coordinates) {
            coordsInMapRef.current[propsPolygon.uniqueId] = propsPolygon.coordinates;
        }
        sendToWebView({ function: 'addPolygon', params: propsPolygon });
    }, [sendToWebView]);

    const removePolygon = useCallback((propsPolygon: PolygonProps) => {
        delete coordsInMapRef.current[propsPolygon.uniqueId];
        sendToWebView({ function: 'removePolygon', params: propsPolygon });
    }, [sendToWebView]);

    const fitBounds = useCallback(() => {
        const coords = Object.values(coordsInMapRef.current).flat();
        if (coords.length === 0) return;

        const bounds = getBoundsFromCoords(coords);
        sendToWebView({ function: 'fitBounds', params: { bounds } });
    }, [sendToWebView]);

    useImperativeHandle(ref, () => ({
        fitBounds,
    }), [fitBounds]);

    useEffect(() => {
        if (html) return;
        maplibreHtmlMap(webFunctionsString, props.sources).then(setHtml);
    }, [html, props.sources]);

    const onReceiveMessageFromWebView = useCallback((data: string) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'event') {
                switch (msg.event) {
                    case 'movestart':
                        mapSelectPointRef.current?.up();
                        props.onMoveStart?.(msg.params);
                        break;
                    case 'moveend':
                        props.onMoveEnd?.(msg.params);
                        mapSelectPointRef.current?.down();
                        break;
                    case 'zoomstart':
                        props.onZoomStart?.(msg.params);
                        break;
                    case 'zoomend':
                        props.onZoomEnd?.(msg.params);
                        break;
                    case 'idle':
                        props.onIdle?.(msg.params);
                        break;
                }
                return;
            }

            if (msg.type === 'inited') {
                setInited(true);
                return;
            }

            if (msg.type === 'scriptReady') {
                initMap();
                return;
            }

            if (msg.type === 'markerClick') {
                const handler = markersClickHandlers.current[msg.uniqueId];
                if (typeof handler === 'function') {
                    handler();
                }
                return;
            }
        } catch (e) {
            if (__DEV__) {
                console.warn('MapView: failed to parse WebView message', e);
            }
        }
    }, [props.onMoveStart, props.onMoveEnd, props.onZoomStart, props.onZoomEnd, props.onIdle, initMap]);

    return (
        <View style={props.style}>
            {!inited && (
                <MapPlaceholder theme={props.theme} />
            )}

            <MapViewContext.Provider
                value={{
                    addPolygon,
                    removePolygon,
                    addMarker,
                    removeMarker,
                    addPolyline,
                    removePolyline,
                }}
            >
                <WebView
                    ref={webViewRef}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    originWhitelist={['*']}
                    source={{ html }}
                    onMessage={event => {
                        onReceiveMessageFromWebView(event.nativeEvent.data);
                    }}
                    javaScriptEnabled
                    domStorageEnabled
                    scrollEnabled={false}
                />

                {inited && props.children}

                {inited && props.showSelectPoint && (
                    <View
                        pointerEvents="none"
                        style={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                        }}
                    >
                        <MapSelectPoint
                            ref={mapSelectPointRef}
                            color={props.selectPointColor ?? '#000'}
                            backgroundColor={props.selectPointBackgroundColor ?? '#fff'}
                        />
                    </View>
                )}
            </MapViewContext.Provider>
        </View>
    );
});
