import {
  useEffect,
  useRef,
} from 'react';

import { useMapViewContext } from './MapView';
import type { PolylineProps } from './types';

export const Polyline = (props: PolylineProps) => {
    const { addPolyline, removePolyline } = useMapViewContext();

    const lastRenderProps = useRef<string>('');
    const propsRef = useRef(props);
    propsRef.current = props;

    useEffect(() => {
        const serialized = JSON.stringify(props);
        if (lastRenderProps.current !== serialized) {
            addPolyline(props);
            lastRenderProps.current = serialized;
        }
    }, [props]);

    useEffect(() => {
        return () => {
            removePolyline(propsRef.current);
        };
    }, []);

    return null;
};
