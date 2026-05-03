import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  Platform,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';

import MapPlaceholder from './MapPlaceholder';
import MapSelectPoint, { type MapSelectPointType } from './MapSelectPoint';
import {
  type EventParams,
  type MapLiteWebError,
  type MarkerProps,
  type NavigatorInstructionParams,
  type NavigatorLang,
  type NavigatorPositionSetParams,
  type NavigatorRouteSetParams,
  type PolygonProps,
  type PolylineProps,
} from './types';
import { loadResources } from './utils';
import { MAP_HTML } from './webMapBuild';

interface UpdateProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    zoomEnabled?: boolean;
    scrollEnabled?: boolean;
    mapStyle?: string;
}

interface MapViewProps {
    children?: React.ReactNode;


    placeholderTheme?: 'light' | 'dark';
    center: [number, number];
    zoom: number;

    debugMode?: boolean;
    autoFitBounds?: boolean;
    fitBoundsPadding?: number;
    fitBoundsDuration?: number;
    flyToDuration?: number;

    mapStyle: string;
    style: StyleProp<ViewStyle>;
    minZoom?: number;
    maxZoom?: number;
    zoomEnabled?: boolean;
    scrollEnabled?: boolean;
    onReady?: () => void;
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

    /**
     * Включает режим навигатора в WebView (стрелка, маршрут GraphHopper, HUD).
     * Должен совпадать с билдом `webMapBuild` / `MapLiteController`.
     */
    navigator?: boolean;
    /**
     * Базовый URL GraphHopper для маршрутов навигатора (без обязательного `/route`).
     * Нужен для `setNavigatorPoint` и пересчёта маршрута.
     */
    graphhopperUrl?: string;
    /** Язык HUD и инструкций навигатора. По умолчанию веб-часть использует `ru`. */
    navigatorLang?: NavigatorLang;
    onNavigatorRouteSet?: (params: NavigatorRouteSetParams) => void;
    onNavigatorInstruction?: (params: NavigatorInstructionParams) => void;
    onNavigatorPositionSet?: (params: NavigatorPositionSetParams) => void;
    /** Ошибки команд WebView (`type: 'error'` из карты). */
    onMapLiteError?: (err: MapLiteWebError) => void;


    developerLocalhostBundleUrl?: string;
}

export type MapViewRef = {
    fitBounds: () => void;
    flyTo: (center: [number, number], zoom: number) => void;
    /** Построить маршрут до точки (нужен `navigator: true` в MapView). */
    setNavigatorPoint: (latitude: number, longitude: number) => void;
    /** Следующая пошаговая инструкция (для отладки / ручного шага). */
    advanceNavigatorInstruction: () => void;
    /**
     * Обновить «текущую позицию» (GPS): snap / reroute / прибытие — на стороне WebView.
     */
    setNavigatorPosition: (latitude: number, longitude: number) => void;
    /** Режим «клик по карте = новая позиция» (удобно в dev). */
    pickNavigatorPosition: () => void;
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
    const webViewRef = useRef<WebView | null>(null);
    const [inited, setInited] = useState(false);

    const coordsInMapRef = useRef<Record<string, [number, number][]>>({});
    const markersClickHandlers = useRef<Record<string, () => void>>({});
    const mapSelectPointRef = useRef<MapSelectPointType | null>(null);
    const performanceMode = props.performanceMode ?? (Platform.OS === 'android' ? 'balanced' : 'quality');

    const fallbackPixelRatio = performanceMode === 'performance'
        ? 0.85
        : (performanceMode === 'balanced' && Platform.OS === 'android' ? 1 : undefined);

    const sendToWebView = (message: { function: string; params: any }) => {
        if (__DEV__) {
            console.log('MapView: sendToWebView', message);
        }
        webViewRef.current?.postMessage(JSON.stringify(message));
    };

    const initMap = async () => {
        if (__DEV__) {
            console.log('MapView: initMap');
            console.log('MapView: props.mapStyle', props.mapStyle);
        }

        const mapStyleText = await loadResources(props.mapStyle);
        const mapStyle = JSON.parse(mapStyleText);

        sendToWebView({
            function: 'init',
            params: {
                mapStyle: mapStyle,
                zoomEnabled: props.zoomEnabled ?? false,
                scrollEnabled: props.scrollEnabled ?? false,
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
                debugMode: props.debugMode ?? false,
                navigator: props.navigator === true,
                graphhopperUrl: props.graphhopperUrl,
                navigatorLang: props.navigatorLang,
            },
        });
    };

    const updateMarkerClickHandler = (propsMarker: MarkerProps) => {
        if (propsMarker.onPress) {
            markersClickHandlers.current[propsMarker.uniqueId] = propsMarker.onPress;
        } else {
            delete markersClickHandlers.current[propsMarker.uniqueId];
        }
    };

    const addMarker = (propsMarker: MarkerProps) => {
        if (propsMarker.latitude != null && propsMarker.longitude != null && !propsMarker.ignoreFitBounds) {
            coordsInMapRef.current[propsMarker.uniqueId] = [[propsMarker.longitude, propsMarker.latitude]];
        }

        updateMarkerClickHandler(propsMarker);

        sendToWebView({ function: 'addMarker', params: propsMarker });
        scheduleAutoFitBounds();
    };

    const removeMarker = (propsMarker: MarkerProps) => {
        delete coordsInMapRef.current[propsMarker.uniqueId];
        delete markersClickHandlers.current[propsMarker.uniqueId];
        sendToWebView({ function: 'removeMarker', params: propsMarker });
        scheduleAutoFitBounds();
    };

    const addPolyline = (propsPolyline: PolylineProps) => {
        if (propsPolyline.coordinates && !propsPolyline.ignoreFitBounds) {
            coordsInMapRef.current[propsPolyline.uniqueId] = propsPolyline.coordinates;
        }
        sendToWebView({ function: 'addPolyline', params: propsPolyline });
        scheduleAutoFitBounds();
    };

    const removePolyline = (propsPolyline: PolylineProps) => {
        delete coordsInMapRef.current[propsPolyline.uniqueId];
        sendToWebView({ function: 'removePolyline', params: propsPolyline });
        scheduleAutoFitBounds();
    };

    const addPolygon = (propsPolygon: PolygonProps) => {
        if (propsPolygon.coordinates && !propsPolygon.ignoreFitBounds) {
            coordsInMapRef.current[propsPolygon.uniqueId] = propsPolygon.coordinates;
        }
        sendToWebView({ function: 'addPolygon', params: propsPolygon });
        scheduleAutoFitBounds();
    };

    const removePolygon = (propsPolygon: PolygonProps) => {
        delete coordsInMapRef.current[propsPolygon.uniqueId];
        sendToWebView({ function: 'removePolygon', params: propsPolygon });
        scheduleAutoFitBounds();
    };

    const autoFitBoundsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scheduleAutoFitBounds = () => {
        if (!props.autoFitBounds) return;
        if (autoFitBoundsTimeoutRef.current) {
            clearTimeout(autoFitBoundsTimeoutRef.current);
        }
        autoFitBoundsTimeoutRef.current = setTimeout(() => {
            fitBounds();
        }, 1000);
    };

    useEffect(() => {
        scheduleAutoFitBounds();
    }, [props.autoFitBounds, props.fitBoundsPadding]);

    const fitBounds = () => {
        const coords = Object.values(coordsInMapRef.current).flat();
        if (coords.length <= 1) return;

        const bounds = getBoundsFromCoords(coords);
        sendToWebView({ function: 'fitBounds', params: { bounds, padding: props.fitBoundsPadding ?? 40, duration: props.fitBoundsDuration ?? 500 } });
    };

    const flyTo = (center: [number, number], zoom: number) => {
        sendToWebView({ function: 'flyTo', params: { center, zoom, duration: props.flyToDuration ?? 500 } });
    };

    const setNavigatorPoint = (latitude: number, longitude: number) => {
        sendToWebView({ function: 'setNavigatorPoint', params: { latitude, longitude } });
    };

    const advanceNavigatorInstruction = () => {
        sendToWebView({ function: 'advanceNavigatorInstruction', params: {} });
    };

    const setNavigatorPosition = (latitude: number, longitude: number) => {
        sendToWebView({ function: 'setNavigatorPosition', params: { latitude, longitude } });
    };

    const pickNavigatorPosition = () => {
        sendToWebView({ function: 'pickNavigatorPosition', params: {} });
    };

    useImperativeHandle(ref, () => ({
        fitBounds,
        flyTo,
        setNavigatorPoint,
        advanceNavigatorInstruction,
        setNavigatorPosition,
        pickNavigatorPosition,
    }), [fitBounds]);



    const lastPropsRef = useRef<MapViewProps>(props);

    useEffect(() => {
        const updateProps: UpdateProps = {};

        if (lastPropsRef.current.minZoom !== props.minZoom) {
            updateProps.minZoom = props.minZoom;
        }

        if (lastPropsRef.current.maxZoom !== props.maxZoom) {
            updateProps.maxZoom = props.maxZoom;
        }

        if (lastPropsRef.current.zoomEnabled !== props.zoomEnabled) {
            updateProps.zoomEnabled = props.zoomEnabled;
        }

        if (lastPropsRef.current.scrollEnabled !== props.scrollEnabled) {
            updateProps.scrollEnabled = props.scrollEnabled;
        }

        if (lastPropsRef.current.mapStyle !== props.mapStyle) {
            updateProps.mapStyle = props.mapStyle;
        }

        lastPropsRef.current = props;

        if (Object.keys(updateProps).length > 0) {
            sendToWebView({ function: 'update', params: updateProps });
        }
    }, [props.minZoom, props.maxZoom, props.zoomEnabled, props.scrollEnabled, props.mapStyle]);


    const onReceiveMessageFromWebView = (data: string) => {
        try {
            const msg = JSON.parse(data);

            if (__DEV__) {
                console.log('MapView: event', msg);
            }

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
                    case 'navigatorRouteSet':
                        props.onNavigatorRouteSet?.(msg.params as NavigatorRouteSetParams);
                        break;
                    case 'navigatorInstruction':
                        props.onNavigatorInstruction?.(msg.params as NavigatorInstructionParams);
                        break;
                    case 'navigatorPositionSet':
                        props.onNavigatorPositionSet?.(msg.params as NavigatorPositionSetParams);
                        break;
                }
                return;
            }

            if (msg.type === 'error' && msg.data) {
                props.onMapLiteError?.(msg.data as MapLiteWebError);
                return;
            }

            if (msg.type === 'inited') {
                props.onReady?.();
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
    };

    return (
        <View style={props.style}>

            <MapViewContext.Provider
                value={{
                    addMarker,
                    removeMarker,

                    addPolyline,
                    removePolyline,
                    addPolygon,
                    removePolygon,
                }}
            >
                <WebView
                    ref={webViewRef}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    originWhitelist={['*']}
                    source={!!props.developerLocalhostBundleUrl ? { uri: props.developerLocalhostBundleUrl } : { html: MAP_HTML }}
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
            {!inited && (
                <MapPlaceholder theme={props.placeholderTheme ?? 'light'} />
            )}

        </View>
    );
});
