import express from 'express';
import { SamvaadSemanticEngine } from '../engine/SamvaadSemanticEngine.js';

const router = express.Router();

// Singleton instance for demonstration & live session testing
const globalEngineInstance = new SamvaadSemanticEngine('S203');

/**
 * GET /api/engine/status
 * Returns real-time metrics, session version, and active pipeline status
 */
router.get('/status', (req, res) => {
  res.json({
    ok: true,
    engine: 'Samvaad AI Semantic Engine',
    version: '2.0.0',
    metrics: globalEngineInstance.getMetrics(),
    sessionSnapshot: globalEngineInstance.sessionState.getSnapshot()
  });
});

/**
 * GET /api/engine/architecture-overview
 * Exposes the technical architecture and orchestration pipeline documentation
 */
router.get('/architecture-overview', (req, res) => {
  res.json({
    ok: true,
    architectureDetails: globalEngineInstance.getArchitectureOverview()
  });
});

/**
 * GET /api/engine/timeline
 * Returns the immutable versioned timeline history (v1 -> v42)
 */
router.get('/timeline', (req, res) => {
  const limit = Number(req.query.limit || 20);
  res.json({
    ok: true,
    sessionId: globalEngineInstance.sessionId,
    currentVersion: `v${globalEngineInstance.sessionState.version}`,
    timeline: globalEngineInstance.sessionState.getHistory(limit)
  });
});

/**
 * POST /api/engine/simulate
 * Allows judges / UI to send multimodal input (Speech, Sign, Text, Eye Gaze)
 * and watch the 5-stage orchestration pipeline execute in real time.
 */
router.post('/simulate', (req, res) => {
  try {
    const { actor = 'USER_A', modality = 'SPEECH', payload = 'Hello, joining meeting' } = req.body;
    const result = globalEngineInstance.processModalityInput({ actor, modality, payload });

    // Emit live event via Socket.IO if attached to request
    if (req.io) {
      req.io.emit('semantic_engine_event', {
        type: 'STAGE_PROCESSED',
        result
      });
    }

    res.json({
      ok: true,
      result
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

export default router;
export { globalEngineInstance };
