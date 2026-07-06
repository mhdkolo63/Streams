import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Debounce a rapidly-changing value.
 * Returns the value after `delay` ms of no changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Debounce a callback. Useful for search input handlers.
 * Automatically cleans up the timer on unmount.
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (...args: any[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay]
  ) as T;
}

/**
 * Track network connectivity status.
 * Returns { isOnline, isOffline }.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return { isOnline, isOffline: !isOnline };
}

/**
 * Track whether a component is mounted to prevent state updates after unmount.
 */
export function useIsMounted() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  return useCallback(() => mountedRef.current, []);
}

/**
 * AbortController hook for cancelling in-flight requests on unmount.
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  const getController = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current;
  }, []);

  useEffect(() => {
    return () => { controllerRef.current?.abort(); };
  }, []);

  return getController;
}
