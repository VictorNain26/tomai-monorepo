/**
 * Combined Navigation Enhancements Hook for Tom Educational Platform
 * Combines gesture navigation and performance optimization in a single hook
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { UIMode } from '@/utils/uiModeSystem';
import { getPerformanceConfig, getTouchGestureConfig } from '@/utils/navigationAdaptive';

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface GestureCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: (element: HTMLElement) => void;
  onDoubleTap?: (element: HTMLElement) => void;
}

interface PreloadedRoute {
  path: string;
  timestamp: number;
  component?: unknown;
}

interface NavigationMetrics {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  cacheHits: number;
  totalNavigations: number;
}

const PRELOAD_CACHE_KEY = 'tomia_preloaded_routes';
const METRICS_CACHE_KEY = 'tomia_navigation_metrics';

export const useNavigationEnhancements = (
  interfaceMode: UIMode,
  gestureCallbacks: GestureCallbacks = {},
  enabled: boolean = true
) => {
  const location = useLocation();
  const _navigate = useNavigate();
  const performanceConfig = getPerformanceConfig(interfaceMode);
  const gestureConfig = getTouchGestureConfig(interfaceMode);

  // Performance refs
  const preloadCacheRef = useRef<Map<string, PreloadedRoute>>(new Map());
  const metricsRef = useRef<NavigationMetrics>({
    loadTime: 0,
    renderTime: 0,
    interactionTime: 0,
    cacheHits: 0,
    totalNavigations: 0
  });
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const navigationStartTimeRef = useRef<number>(0);

  // Gesture refs
  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchEndRef = useRef<TouchPoint | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<TouchPoint | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  // Load cached performance data on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      const cachedRoutes = localStorage.getItem(PRELOAD_CACHE_KEY);
      if (cachedRoutes) {
        const parsed = JSON.parse(cachedRoutes) as PreloadedRoute[];
        parsed.forEach(route => {
          if (Date.now() - route.timestamp < performanceConfig.caching.ttl) {
            preloadCacheRef.current.set(route.path, route);
          }
        });
      }

      const cachedMetrics = localStorage.getItem(METRICS_CACHE_KEY);
      if (cachedMetrics) {
        metricsRef.current = { ...metricsRef.current, ...JSON.parse(cachedMetrics) };
      }
    } catch {
      // Failed to load navigation cache
    }
  }, [enabled, performanceConfig.caching.ttl]);

  // Clear gesture timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Gesture utility functions
  const getDistance = useCallback((start: TouchPoint, end: TouchPoint) => {
    return Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );
  }, []);

  const getSwipeDirection = useCallback((start: TouchPoint, end: TouchPoint) => {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const deltaTime = end.timestamp - start.timestamp;

    const distance = getDistance(start, end);

    if (distance < gestureConfig.swipeThreshold || deltaTime > gestureConfig.swipeTimeout) {
      return null;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }, [gestureConfig.swipeThreshold, gestureConfig.swipeTimeout, getDistance]);

  // Performance functions
  const saveCache = useCallback(() => {
    try {
      const routes = Array.from(preloadCacheRef.current.entries()).map(([_, data]) => ({
        ...data
      }));
      localStorage.setItem(PRELOAD_CACHE_KEY, JSON.stringify(routes));
      localStorage.setItem(METRICS_CACHE_KEY, JSON.stringify(metricsRef.current));
    } catch {
      // Failed to save navigation cache
    }
  }, []);

  const preloadRoute = useCallback(async (path: string) => {
    if (!enabled || preloadCacheRef.current.has(path)) return;

    try {
      const startTime = performance.now();
      const endTime = performance.now();
      const loadTime = endTime - startTime;

      preloadCacheRef.current.set(path, {
        path,
        timestamp: Date.now()
      });

      metricsRef.current.loadTime = (metricsRef.current.loadTime + loadTime) / 2;
      saveCache();

      // Preloaded route successfully
    } catch {
      // Failed to preload route
    }
  }, [enabled, saveCache]);

  // Gesture handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || !gestureConfig.gesturesEnabled) return;

    const touch = e.touches[0];
    if (!touch) return;

    const touchPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    touchStartRef.current = touchPoint;
    elementRef.current = e.target as HTMLElement;

    if (gestureConfig.gesturesEnabled.longPress && gestureCallbacks.onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        if (touchStartRef.current && elementRef.current) {
          gestureCallbacks.onLongPress?.(elementRef.current);
          touchStartRef.current = null;
        }
      }, gestureConfig.longPressDelay);
    }

    if (gestureConfig.gesturesEnabled.doubleTap && lastTapRef.current) {
      const timeDiff = touchPoint.timestamp - lastTapRef.current.timestamp;
      const distance = getDistance(touchPoint, lastTapRef.current);

      if (timeDiff < gestureConfig.tapDelay && distance < 30) {
        gestureCallbacks.onDoubleTap?.(elementRef.current);
        lastTapRef.current = null;

      }
    }
  }, [enabled, gestureConfig, gestureCallbacks, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const touch = e.touches[0];
    if (!touch) return;

    touchEndRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const touch = e.changedTouches[0];
    if (!touch) return;

    const touchEnd: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    const direction = getSwipeDirection(touchStartRef.current, touchEnd);

    if (direction && gestureConfig.gesturesEnabled[`swipe${direction.charAt(0).toUpperCase() + direction.slice(1)}` as keyof typeof gestureConfig.gesturesEnabled]) {
      switch (direction) {
        case 'left':
          gestureCallbacks.onSwipeLeft?.();
          break;
        case 'right':
          gestureCallbacks.onSwipeRight?.();
          break;
        case 'up':
          gestureCallbacks.onSwipeUp?.();
          break;
        case 'down':
          gestureCallbacks.onSwipeDown?.();
          break;
      }
    } else {
      if (gestureConfig.gesturesEnabled.doubleTap) {
        lastTapRef.current = touchEnd;
      }
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
    elementRef.current = null;
  }, [enabled, gestureConfig, gestureCallbacks, getSwipeDirection]);

  // Add gesture event listeners
  useEffect(() => {
    if (!enabled) return;

    const options = { passive: false };

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Performance tracking
  useEffect(() => {
    if (!enabled) return;

    navigationStartTimeRef.current = performance.now();
    metricsRef.current.totalNavigations += 1;

    const measureRenderTime = () => {
      const renderTime = performance.now() - navigationStartTimeRef.current;
      metricsRef.current.renderTime = (metricsRef.current.renderTime + renderTime) / 2;

      if (preloadCacheRef.current.has(location.pathname)) {
        metricsRef.current.cacheHits += 1;
      }

      saveCache();
    };

    requestAnimationFrame(measureRenderTime);
  }, [location.pathname, enabled, saveCache]);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!enabled || !performanceConfig.lazyLoading.enabled) return;

    intersectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const href = entry.target.getAttribute('href');
            if (href) {
              void preloadRoute(href);
            }
          }
        });
      },
      {
        rootMargin: performanceConfig.lazyLoading.rootMargin,
        threshold: 0.1
      }
    );

    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach(link => {
      intersectionObserverRef.current?.observe(link);
    });

    return () => {
      intersectionObserverRef.current?.disconnect();
    };
  }, [enabled, performanceConfig.lazyLoading, preloadRoute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      saveCache();
    };
  }, [saveCache]);

  // Public API
  const getMetrics = useCallback(() => {
    const cacheHitRate = metricsRef.current.totalNavigations > 0
      ? (metricsRef.current.cacheHits / metricsRef.current.totalNavigations) * 100
      : 0;

    return {
      ...metricsRef.current,
      cacheHitRate,
      cacheSize: preloadCacheRef.current.size
    };
  }, []);

  const clearCache = useCallback(() => {
    preloadCacheRef.current.clear();
    localStorage.removeItem(PRELOAD_CACHE_KEY);
    // Navigation cache cleared
  }, []);

  const isRouteCached = useCallback((path: string) => {
    return preloadCacheRef.current.has(path);
  }, []);

  const defaultGestures = useCallback(() => {
    return {
      onSwipeLeft: () => {
        window.history.forward();
      },
      onSwipeRight: () => {
        window.history.back();
      },
      onSwipeUp: () => {
        const closeButton = document.querySelector('[aria-label*="Fermer"]') as HTMLElement;
        closeButton?.click();
      },
      onLongPress: (element: HTMLElement) => {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          const tooltip = document.createElement('div');
          tooltip.textContent = ariaLabel;
          tooltip.className = 'fixed z-50 bg-black text-white px-2 py-1 rounded text-sm pointer-events-none';
          tooltip.style.left = '50%';
          tooltip.style.top = '50%';
          tooltip.style.transform = 'translate(-50%, -50%)';

          document.body.appendChild(tooltip);

          setTimeout(() => {
            document.body.removeChild(tooltip);
          }, 2000);
        }
      },
      onDoubleTap: (element: HTMLElement) => {
        const button = element.closest('button') as HTMLButtonElement;
        if (button && !button.disabled) {
          button.click();
        }
      }
    };
  }, []);

  return {
    // Performance API
    preloadRoute,
    isRouteCached,
    getMetrics,
    clearCache,
    cacheSize: preloadCacheRef.current.size,

    // Gesture API
    gestureConfig,
    defaultGestures: defaultGestures(),

    // Combined status
    isEnabled: enabled
  };
};

export default useNavigationEnhancements;
