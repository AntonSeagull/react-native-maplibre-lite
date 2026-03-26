import {
  useEffect,
  useRef,
} from 'react';

import { Animated } from 'react-native';

import { MAP_ASSETS } from '../assets/MAP_ASSETS';

const MapPlaceholder = (props: { theme: 'dark' | 'light' }) => {
    const opacityAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const animate = () => {
            Animated.sequence([
                Animated.timing(opacityAnim, {
                    toValue: 0.6,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0.1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ]).start(() => animate());
        };

        animate();
    }, [opacityAnim]);

    return (
        <Animated.Image
            source={props.theme === 'dark' ? MAP_ASSETS.DARK_MAP_PLACEHOLDER : MAP_ASSETS.LIGHT_MAP_PLACEHOLDER}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',

                opacity: opacityAnim,
            }}
        />
    );
}

export default MapPlaceholder;