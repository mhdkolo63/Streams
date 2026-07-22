import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Heart, Bell, BellRing, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

interface LikeButtonProps {
  liked: boolean;
  likeCount: number;
  onToggle: () => void;
  size?: number;
}

export function LikeButton({ liked, likeCount, onToggle, size = 20 }: LikeButtonProps) {
  const [showBurst, setShowBurst] = useState(false);
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  const handlePress = () => {
    if (!liked) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 600);
    }
    RNAnimated.sequence([
      RNAnimated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      RNAnimated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <View style={styles.likeContainer}>
        <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Heart
            size={size}
            color={liked ? Colors.status.error : Colors.text.secondary}
            fill={liked ? Colors.status.error : 'none'}
          />
        </RNAnimated.View>
        <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
          {formatCount(likeCount)}
        </Text>
        {showBurst && (
          <Animated.View
            entering={FadeIn.springify().damping(15)}
            exiting={FadeOut.duration(200)}
            style={styles.burst}
          >
            <Text style={styles.burstText}>+1</Text>
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface SubscribeButtonProps {
  subscribed: boolean;
  subscriberCount: number;
  onToggle: () => void;
}

export function SubscribeButton({ subscribed, subscriberCount, onToggle }: SubscribeButtonProps) {
  const [showSubscribeAnim, setShowSubscribeAnim] = useState(false);
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  const handlePress = () => {
    if (!subscribed) {
      setShowSubscribeAnim(true);
      setTimeout(() => setShowSubscribeAnim(false), 1200);
    }
    RNAnimated.sequence([
      RNAnimated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      RNAnimated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} disabled={false}>
      <RNAnimated.View
        style={[
          styles.subscribeContainer,
          { transform: [{ scale: scaleAnim }] },
          subscribed && styles.subscribedContainer,
        ]}
      >
        {subscribed ? (
          <>
            <Bell size={16} color={Colors.text.muted} />
            <Text style={styles.subscribedText}>Subscribed</Text>
            <Text style={styles.subscriberCount}>{formatCount(subscriberCount)}</Text>
          </>
        ) : (
          <>
            <Bell size={16} color="#fff" />
            <Text style={styles.subscribeText}>Subscribe</Text>
          </>
        )}
      </RNAnimated.View>
      {showSubscribeAnim && (
        <Animated.View
          entering={SlideInUp.springify().damping(12)}
          exiting={FadeOut.duration(400)}
          style={styles.subscribeAnim}
        >
          <CheckCircle2 size={16} color={Colors.status.success} />
          <Text style={styles.subscribeAnimText}>Subscribed!</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    position: 'relative',
  },
  likeCount: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
  },
  likeCountActive: {
    color: Colors.status.error,
  },
  burst: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  burstText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.status.error,
  },
  subscribeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minWidth: 120,
    justifyContent: 'center',
  },
  subscribedContainer: {
    backgroundColor: Colors.tertiary,
  },
  subscribeText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: '#fff',
  },
  subscribedText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.text.secondary,
  },
  subscriberCount: {
    fontSize: FontSizes.xs,
    color: Colors.text.muted,
  },
  subscribeAnim: {
    position: 'absolute',
    top: -28,
    left: '50%',
    transform: [{ translateX: -50 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subscribeAnimText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.status.success,
  },
});
