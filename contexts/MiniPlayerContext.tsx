import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';

export interface MiniPlayerState {
  videoId: string;
  videoTitle: string;
  videoThumbnail: string | null;
  videoUrl: string | null;
  position: number;
  duration: number;
  isPlaying: boolean;
  creatorName: string | null;
}

interface MiniPlayerContextType {
  active: boolean;
  state: MiniPlayerState | null;
  show: (state: MiniPlayerState) => void;
  hide: () => void;
  updateState: (partial: Partial<MiniPlayerState>) => void;
  expand: () => void;
  expandCallback: (() => void) | null;
  setExpandCallback: (cb: (() => void) | null) => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | undefined>(undefined);

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [state, setState] = useState<MiniPlayerState | null>(null);
  const [expandCallback, setExpandCallbackState] = useState<(() => void) | null>(null);
  const stateRef = useRef<MiniPlayerState | null>(null);

  const show = useCallback((newState: MiniPlayerState) => {
    stateRef.current = newState;
    setState(newState);
    setActive(true);
  }, []);

  const hide = useCallback(() => {
    stateRef.current = null;
    setState(null);
    setActive(false);
  }, []);

  const updateState = useCallback((partial: Partial<MiniPlayerState>) => {
    setState(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      stateRef.current = next;
      return next;
    });
  }, []);

  const setExpandCallback = useCallback((cb: (() => void) | null) => {
    setExpandCallbackState(cb);
  }, []);

  const expand = useCallback(() => {
    if (expandCallback) {
      expandCallback();
    }
  }, [expandCallback]);

  return (
    <MiniPlayerContext.Provider
      value={{ active, state, show, hide, updateState, expand, expandCallback, setExpandCallback }}
    >
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const ctx = useContext(MiniPlayerContext);
  if (!ctx) throw new Error('useMiniPlayer must be used within MiniPlayerProvider');
  return ctx;
}
