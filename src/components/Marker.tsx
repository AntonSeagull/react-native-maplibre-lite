import {
  useEffect,
  useRef,
} from 'react';

import { useMapViewContext } from './MapView';
import type { MarkerProps } from './types';

export const Marker = (props: MarkerProps) => {
    const { addMarker, removeMarker } = useMapViewContext();

    const lastRenderProps = useRef<string>('');
    const propsRef = useRef(props);
    propsRef.current = props;

    useEffect(() => {
        const serialized = JSON.stringify(props);
        if (lastRenderProps.current !== serialized) {
            addMarker(props);
            lastRenderProps.current = serialized;
        }
    }, [props]);

    useEffect(() => {
        return () => {
            removeMarker(propsRef.current);
        };
    }, []);

    return null;
};
