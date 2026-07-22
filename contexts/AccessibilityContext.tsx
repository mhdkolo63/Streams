import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';

export type FontScale = 'small' | 'medium' | 'large' | 'xlarge';
export type ThemeMode = 'dark' | 'high-contrast';

interface AccessibilityContextType {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  fontScaleMultiplier: number;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (enabled: boolean) => void;
}

const fontScaleMap: Record<FontScale, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.15,
  xlarge: 1.3,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY = 'streamworld_a11y';

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>('medium');
  const [highContrast, setHighContrastState] = useState(false);
  const [reduceMotion, setReduceMotionState] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.fontScale) setFontScaleState(parsed.fontScale);
          if (parsed.highContrast) setHighContrastState(parsed.highContrast);
          if (parsed.reduceMotion) setReduceMotionState(parsed.reduceMotion);
        }
      } catch {}
    }
  }, []);

  const persist = useCallback(
    (key: string, value: any) => {
      if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[key] = value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
    },
    []
  );

  const setFontScale = useCallback(
    (scale: FontScale) => {
      setFontScaleState(scale);
      persist('fontScale', scale);
    },
    [persist]
  );

  const setHighContrast = useCallback(
    (enabled: boolean) => {
      setHighContrastState(enabled);
      persist('highContrast', enabled);
    },
    [persist]
  );

  const setReduceMotion = useCallback(
    (enabled: boolean) => {
      setReduceMotionState(enabled);
      persist('reduceMotion', enabled);
    },
    [persist]
  );

  return (
    <AccessibilityContext.Provider
      value={{
        fontScale,
        setFontScale,
        fontScaleMultiplier: fontScaleMap[fontScale],
        highContrast,
        setHighContrast,
        reduceMotion,
        setReduceMotion,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}

export function useScaledFont(baseSize: number): number {
  const { fontScaleMultiplier } = useAccessibility();
  return Math.round(baseSize * fontScaleMultiplier);
}
