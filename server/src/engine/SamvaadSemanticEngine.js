/**
 * Samvaad AI Semantic Engine - Master Orchestration Engine
 *
 * Multiple communication modalities (Speech, Sign Language Pose/Hand Landmarks,
 * Text/AAC, Eye Gaze) are transformed into canonical semantic representations,
 * semantically merged and deduplicated within temporal sliding windows, atomically
 * committed into a shared session-scoped semantic state, and rendered into
 * participant-specific outputs without relay-based modality-to-modality translation.
 */

import { UnifiedFeatureStream } from './FeatureEncoders.js';
import { CanonicalSemanticEvent } from './CanonicalSemanticEvent.js';
import { SemanticEquivalenceEngine } from './SemanticEquivalenceEngine.js';
import { SharedSessionState } from './SharedSessionState.js';
import { ParticipantAdapters } from './ParticipantAdapters.js';
import { MasterTimelineSync } from './MasterTimelineSync.js';

export class SamvaadSemanticEngine {
  constructor(sessionId = 'S203') {
    this.sessionId = sessionId;
    this.equivalenceEngine = new SemanticEquivalenceEngine(800);
    this.sessionState = new SharedSessionState(sessionId);
    this.timelineSync = new MasterTimelineSync(150);

    // Metrics for judges / monitoring
    this.metrics = {
      totalInputsProcessed: 0,
      canonicalEventsGenerated: 0,
      duplicateMeaningsCollapsed: 0,
      atomicStateCommits: 0,
      participantOutputsRendered: 0,
      startedAt: Date.now()
    };

    // Pre-populate default synthetic participants for live demo if needed
    this.sessionState.registerParticipant('USER_A', {
      name: 'Alice (Speech User)',
      preferredModality: 'SPEECH',
      language: 'en'
    });

    this.sessionState.registerParticipant('USER_B', {
      name: 'Bob (Sign Language User)',
      preferredModality: 'SIGN_AVATAR',
      language: 'en'
    });

    this.sessionState.registerParticipant('USER_C', {
      name: 'Charlie (Braille / AAC User)',
      preferredModality: 'BRAILLE',
      language: 'en'
    });
  }

  /**
   * Main Pipeline Entry Point: Accepts raw modality input and runs full 5-stage pipeline
   */
  processModalityInput({ actor, modality, payload }) {
    this.metrics.totalInputsProcessed += 1;

    // Stage 1: Feature Encoding
    const featureStream = UnifiedFeatureStream.process({ actor, modality, payload });

    // Stage 2: Canonical Semantic Parsing
    const canonicalEvent = CanonicalSemanticEvent.parse(featureStream);
    this.metrics.canonicalEventsGenerated += 1;

    // Stage 3: Semantic Equivalence Deduplication
    const equivalenceResult = this.equivalenceEngine.evaluate(canonicalEvent);

    if (equivalenceResult.action === 'COLLAPSED') {
      this.metrics.duplicateMeaningsCollapsed += 1;
    }

    // Stage 4: Atomic Commit to Shared Session State
    const stateSnapshot = this.sessionState.atomicCommit(equivalenceResult.primaryEvent);
    this.metrics.atomicStateCommits += 1;

    // Stage 5: Participant-Aware Rendering Output Adaptation
    const renderedOutputs = {};
    const participants = Array.from(this.sessionState.participants.values());

    participants.forEach(p => {
      renderedOutputs[p.participantId] = ParticipantAdapters.render(equivalenceResult.primaryEvent, p);
      this.metrics.participantOutputsRendered += 1;
    });

    // Stage 6: Master Timeline (T_0) Synchronized Delivery
    const deliveryBundle = this.timelineSync.scheduleDelivery(renderedOutputs, participants);

    return {
      success: true,
      stageResults: {
        featureStream,
        canonicalEvent,
        equivalenceResult,
        stateSnapshot,
        renderedOutputs,
        deliveryBundle
      },
      metrics: this.getMetrics()
    };
  }

  getMetrics() {
    const uptimeSec = Math.floor((Date.now() - this.metrics.startedAt) / 1000);
    return {
      ...this.metrics,
      uptimeSec,
      sessionVersion: `v${this.sessionState.version}`,
      activeParticipants: this.sessionState.participants.size,
      syncStatus: this.timelineSync.getSyncMetrics().status
    };
  }

  getArchitectureOverview() {
    return {
      title: "Samvaad AI Semantic Engine: Shared Session-Scoped Multimodal Orchestration",
      technicalSummary: "Multiple communication modalities are transformed into canonical semantic, semantically merged, atomically committed into a shared session-scoped semantic state, and rendered into participant-specific outputs without relay-based modality-to-modality translation.",
      stages: [
        "1. Modality-Specific Feature Encoders (Acoustic, Landmark, Language, Spatial)",
        "2. Canonical Semantic Parsing (Intent, Entities, Time, Actor, Context, Emotion)",
        "3. Semantic Equivalence Deduplication (Duplicate Meaning Collapsed)",
        "4. Shared Session-Scoped Semantic State (Atomic Commit & Versioned History v1->v42)",
        "5. Participant-Aware Rendering Adapters (Speech, 3D Sign Avatar, Text, Braille, AAC, Haptic)",
        "6. Master Timeline Alignment (T_0 Synchronizer)"
      ]
    };
  }
}
