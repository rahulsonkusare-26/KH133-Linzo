import { useCallback } from 'react';

/**
 * Custom React hook for triggering browser Navigator Vibration API haptic signals.
 */
export function useHapticFeedback() {
  const triggerHaptic = useCallback((pattern = [100]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        console.warn('Haptic vibration not supported or blocked:', err);
      }
    }
  }, []);

  return { triggerHaptic };
}
