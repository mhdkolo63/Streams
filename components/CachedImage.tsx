import React, { useState, useCallback, useEffect } from 'react';
import { Image, View, StyleSheet, ImageProps, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  uri: string;
  placeholderColor?: string;
  fallbackUri?: string;
  blurRadius?: number;
}

/**
 * Image component with:
 * - Fade-in animation on load
 * - Placeholder color while loading
 * - Fallback image if source fails
 * - Prevents layout shift by maintaining dimensions
 */
function CachedImageComponent({
  uri,
  placeholderColor = Colors.tertiary,
  fallbackUri,
  blurRadius = 0,
  style,
  ...props
}: CachedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const opacity = useSharedValue(0);

  const source = hasError && fallbackUri ? { uri: fallbackUri } : { uri };

  const handleLoad = useCallback(() => {
    opacity.value = withTiming(1, { duration: 300 }, () => {
      runOnJS(setIsLoaded)(true);
    });
  }, [opacity]);

  const handleError = useCallback(() => {
    if (!hasError && fallbackUri) {
      setHasError(true);
    } else {
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [hasError, fallbackUri, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.container, style]}>
      {!isLoaded && (
        <View style={[styles.placeholder, { backgroundColor: placeholderColor }]} />
      )}
      <Animated.Image
        source={source}
        onLoad={handleLoad}
        onError={handleError}
        style={[style, animatedStyle]}
        blurRadius={blurRadius}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
  },
});

export const CachedImage = React.memo(CachedImageComponent);
