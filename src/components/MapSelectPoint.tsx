import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';

import {
  Animated,
  StyleSheet,
  View,
} from 'react-native';

export type MapSelectPointType = {
  up: () => void;
  down: () => void;
};

const BORDER_WIDTH_UP = 6;
const BORDER_WIDTH_DOWN = 3;
const UP_POSITION = 10;
const DURATION = 200;

type MapSelectPointProps = {
  color?: string;
  backgroundColor?: string;

}

export const MapSelectPoint = forwardRef<MapSelectPointType, MapSelectPointProps>(
  (_props, ref) => {
    const position = useRef<'up' | 'down'>('down');

    const borderWidth = useRef(new Animated.Value(BORDER_WIDTH_DOWN)).current;
    const shadowHeight = useRef(new Animated.Value(0)).current;
    const shadowMarginTop = useRef(new Animated.Value(0)).current;
    const handleMarginTop = useRef(new Animated.Value(0)).current;

    useImperativeHandle(ref, () => ({
      up: () => moveMarker('up'),
      down: () => moveMarker('down'),
    }));

    const animateTo = (
      animatedValue: Animated.Value,
      toValue: number
    ) => {
      return Animated.timing(animatedValue, {
        toValue,
        duration: DURATION,
        useNativeDriver: false,
      });
    };

    const moveMarker = (direction: 'up' | 'down') => {
      if (position.current === direction) return;
      position.current = direction;

      if (direction === 'up') {
        Animated.parallel([
          animateTo(borderWidth, BORDER_WIDTH_UP),
          animateTo(shadowHeight, 4),
          animateTo(shadowMarginTop, UP_POSITION),
          animateTo(handleMarginTop, -UP_POSITION),
        ]).start();
      } else {
        Animated.parallel([
          animateTo(borderWidth, BORDER_WIDTH_DOWN),
          animateTo(shadowHeight, 0),
          animateTo(shadowMarginTop, 0),
          animateTo(handleMarginTop, 0),
        ]).start();
      }
    };

    return (
      <View style={styles.container}>
        <Animated.View style={{ marginTop: handleMarginTop }}>
          <View style={styles.center}>
            <Animated.View
              style={[
                styles.circle,
                {
                  borderWidth: borderWidth,
                  borderColor: _props.color,
                  backgroundColor: _props.backgroundColor,
                },
              ]}
            />
            <View style={[styles.line, { backgroundColor: _props.color }]} />
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.shadow,
            {
              height: shadowHeight,
              marginTop: shadowMarginTop,
              backgroundColor: _props.color,
            },
          ]}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  circle: {
    borderRadius: 100,
    width: 28,
    height: 28,
  },
  line: {
    width: 2,
    height: 15,

  },
  shadow: {
    opacity: 0.6,
    width: 4,
    borderRadius: 100,
  },
});

export default MapSelectPoint;