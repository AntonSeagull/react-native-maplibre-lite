import {
  useEffect,
  useRef,
} from 'react';

import { useMapViewContext } from './MapView';
import type { PolygonProps } from './types';

export const Polygon = (props: PolygonProps) => {
    const { addPolygon, removePolygon } = useMapViewContext();

    const lastRenderProps = useRef<string>('');
    const propsRef = useRef(props);
    propsRef.current = props;

    useEffect(() => {
        const serialized = JSON.stringify(props);
        if (lastRenderProps.current !== serialized) {
            addPolygon(props);
            lastRenderProps.current = serialized;
        }
    }, [props]);

    useEffect(() => {
        return () => {
            removePolygon(propsRef.current);
        };
    }, []);

    return null;
};
