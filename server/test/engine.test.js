import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SamvaadSemanticEngine } from '../src/engine/SamvaadSemanticEngine.js';
import { AcousticEncoder, LandmarkEncoder, LanguageEncoder, SpatialEncoder, UnifiedFeatureStream } from '../src/engine/FeatureEncoders.js';
import { CanonicalSemanticEvent } from '../src/engine/CanonicalSemanticEvent.js';
import { SemanticEquivalenceEngine } from '../src/engine/SemanticEquivalenceEngine.js';
import { SharedSessionState } from '../src/engine/SharedSessionState.js';
import { ParticipantAdapters } from '../src/engine/ParticipantAdapters.js';
import { MasterTimelineSync } from '../src/engine/MasterTimelineSync.js';

describe('Samvaad AI Semantic Engine - 10/10 Test Suite', () => {

  test('Stage 1: Modality Feature Encoders', () => {
    const acoustic = AcousticEncoder.encode({ text: 'Hello meeting', energy: 0.9 });
    assert.equal(acoustic.modality, 'SPEECH');
    assert.equal(acoustic.embedding.length, 16);

    const landmark = LandmarkEncoder.encode({ gesture: 'WAVE_JOIN', handCount: 2 });
    assert.equal(landmark.modality, 'SIGN');

    const language = LanguageEncoder.encode({ text: 'Joining room' });
    assert.equal(language.modality, 'TEXT');

    const spatial = SpatialEncoder.encode({ target: 'JOIN_BUTTON', x: 0.5, y: 0.5 });
    assert.equal(spatial.modality, 'EYE_GAZE');
  });

  test('Stage 2: Canonical Semantic Event Parsing', () => {
    const stream = UnifiedFeatureStream.process({
      actor: 'USER_A',
      modality: 'SPEECH',
      payload: 'Hello I join the call'
    });

    const canonical = CanonicalSemanticEvent.parse(stream);
    assert.equal(canonical.actor, 'USER_A');
    assert.equal(canonical.intent, 'JOIN');
    assert.equal(canonical.sourceModality, 'SPEECH');
  });

  test('Stage 3: Semantic Equivalence Engine (Meaning Collapse)', () => {
    const eqEngine = new SemanticEquivalenceEngine(800);

    const eventSpeech = new CanonicalSemanticEvent({
      actor: 'USER_A',
      intent: 'JOIN',
      sourceModality: 'SPEECH',
      timestamp: Date.now()
    });

    const res1 = eqEngine.evaluate(eventSpeech);
    assert.equal(res1.action, 'COMMITTED');

    // Concurrent sign language gesture event from same user
    const eventSign = new CanonicalSemanticEvent({
      actor: 'USER_A',
      intent: 'JOIN',
      sourceModality: 'SIGN',
      timestamp: Date.now() + 50
    });

    const res2 = eqEngine.evaluate(eventSign);
    assert.equal(res2.action, 'COLLAPSED');
    assert.equal(res2.primaryEvent.collapseCount, 2);
    assert.deepEqual(res2.primaryEvent.collapsedModalities, ['SPEECH', 'SIGN']);
  });

  test('Stage 4: Shared Session State & Immutable Versioned History', () => {
    const session = new SharedSessionState('S999');
    assert.equal(session.version, 1);

    session.registerParticipant('USER_X', { name: 'Xavier', preferredModality: 'TEXT' });
    assert.equal(session.version, 2);

    const event = new CanonicalSemanticEvent({ actor: 'USER_X', intent: 'AFFIRM' });
    const snapshot = session.atomicCommit(event);

    assert.equal(session.version, 3);
    assert.equal(snapshot.version, 'v3');
    assert.equal(session.getHistory().length, 2);
  });

  test('Stage 5: Participant-Aware Rendering Adapters', () => {
    const event = new CanonicalSemanticEvent({
      actor: 'USER_A',
      intent: 'JOIN',
      payload: { rawContent: 'Hello team' }
    });

    const speechOutput = ParticipantAdapters.render(event, { preferredModality: 'SPEECH', language: 'en' });
    assert.equal(speechOutput.outputModality, 'SPEECH');

    const avatarOutput = ParticipantAdapters.render(event, { preferredModality: 'SIGN_AVATAR' });
    assert.equal(avatarOutput.outputModality, 'SIGN_AVATAR');
    assert.equal(avatarOutput.payload.avatarModel, 'SAMVAAD_3D_ISL_AVATAR_V2');

    const brailleOutput = ParticipantAdapters.render(event, { preferredModality: 'BRAILLE' });
    assert.equal(brailleOutput.outputModality, 'BRAILLE');
    assert.ok(brailleOutput.payload.brailleText);
  });

  test('Stage 6: Master Timeline (T_0) Synchronizer', () => {
    const sync = new MasterTimelineSync(150);
    const metrics = sync.getSyncMetrics();
    assert.equal(metrics.status, 'ALIGNED_AND_SYNCHRONIZED');
  });

  test('Full Samvaad AI Semantic Engine Integration Pipeline', () => {
    const engine = new SamvaadSemanticEngine('S203');

    const result = engine.processModalityInput({
      actor: 'USER_A',
      modality: 'SPEECH',
      payload: 'Hello I want to join'
    });

    assert.equal(result.success, true);
    assert.ok(result.stageResults.deliveryBundle);
    assert.equal(engine.getMetrics().totalInputsProcessed, 1);
  });
});
