import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Animated,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Pause, X, ChevronUp } from 'lucide-react-native';
import { useMiniPlayer } from '@/contexts/MiniPlayerContext';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MINI_WIDTH = 180;
const MINI_HEIGHT = 120;
const EDGE_MARGIN = 12;
const DEFAULT_X = SCREEN_WIDTH - MINI_WIDTH - EDGE_MARGIN;
const DEFAULT_Y = SCREEN_HEIGHT - MINI_HEIGHT - 80;

export function MiniPlayer() {
  const router = useRouter();
  const { active, state, hide, expand, updateState } = useMiniPlayer();
  const pan = useRef(new Animated.ValueXY({ x: DEFAULT_X, y: DEFAULT_Y })).current;
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gestureState);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        const finalX = Math.max(
          EDGE_MARGIN,
          Math.min(SCREEN_WIDTH - MINI_WIDTH - EDGE_MARGIN, (pan.x as any)._value)
        );
        const finalY = Math.max(
          60,
          Math.min(SCREEN_HEIGHT - MINI_HEIGHT - 80, (pan.y as any)._value)
        );
        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          tension: 80,
          friction: 10,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (active) {
      pan.setValue({ x: DEFAULT_X, y: DEFAULT_Y });
    }
  }, [active]);

  if (!active || !state) return null;

  const handleExpand = () => {
    if (isDragging.current) return;
    expand();
  };

  const togglePlayPause = () => {
    updateState({ isPlaying: !state.isPlaying });
  };

  const handleClose = () => {
    hide();
  };

  const progressPercent = state.duration > 0 ? (state.position / state.duration) * 100 : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity style={styles.inner} onPress={handleExpand} activeOpacity={0.9}>
        <View style={styles.thumbnailContainer}>
          {state.videoThumbnail ? (
            <Image source={{ uri: state.videoThumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder} />
          )}
          <View style={styles.playOverlay}>
            {state.isPlaying ? (
              <Pause size={20} color={Colors.text.primary} fill={Colors.text.primary} />
            ) : (
              <Play size={20} color={Colors.text.primary} fill={Colors.text.primary} />
            )}
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {state.videoTitle}
          </Text>
          {state.creatorName && (
            <Text style={styles.creator} numberOfLines={1}>
              {state.creatorName}
            </Text>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={togglePlayPause} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {state.isPlaying ? (
              <Pause size={18} color={Colors.text.primary} />
            ) : (
              <Play size={18} color={Colors.text.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    zIndex: 9999,
    elevation: 9999,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.6)' },
      default: { elevation: 8 },
    }),
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  thumbnailContainer: {
    width: 70,
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: Colors.tertiary,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  info: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    lineHeight: 14,
  },
  creator: {
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 2,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 2,
  },
  actionBtn: {
    padding: 6,
  },
});
