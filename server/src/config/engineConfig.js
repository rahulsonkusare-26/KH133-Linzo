/**
 * Samvaad AI Semantic Engine Configuration Defaults & Thresholds
 */

export const ENGINE_CONFIG = {
  EQUIVALENCE_WINDOW_MS: parseInt(process.env.EQUIVALENCE_WINDOW_MS || '800', 10),
  TIMELINE_MAX_HISTORY: parseInt(process.env.TIMELINE_MAX_HISTORY || '500', 10),
  MASTER_TIMELINE_TARGET_LATENCY_MS: parseInt(process.env.TARGET_LATENCY_MS || '50', 10),
  ENABLE_TIME_TRAVEL_REPLAY: process.env.ENABLE_TIME_TRAVEL_REPLAY !== 'false',
  DEFAULT_ACCESSIBILITY_PROFILE: process.env.DEFAULT_ACCESSIBILITY_PROFILE || 'STANDARD',
  ENABLE_METRICS_LOGGING: process.env.NODE_ENV !== 'production'
};
