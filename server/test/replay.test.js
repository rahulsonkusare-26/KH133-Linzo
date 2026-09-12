/**
 * Samvaad AI Semantic Engine - SessionReplayEngine Integration Test
 * Verifies versioned timeline snapshot seeking and time-travel replay functionality.
 */

import test from 'node:test';
import assert from 'node:assert';
import { SharedSessionState } from '../src/engine/SharedSessionState.js';
import { SessionReplayEngine } from '../src/engine/SessionReplayEngine.js';
import { CanonicalSemanticEvent } from '../src/engine/CanonicalSemanticEvent.js';

test('SessionReplayEngine - Versioned Timeline Seeking & Replay', async () => {
  const session = new SharedSessionState('session-replay-101');
  const replayEngine = new SessionReplayEngine(session);

  // Commit 3 versioned events using atomicCommit
  const event1 = new CanonicalSemanticEvent({ actor: 'user-1', intent: 'GREETING', sourceModality: 'SPEECH' });
  const event2 = new CanonicalSemanticEvent({ actor: 'user-2', intent: 'AFFIRM', sourceModality: 'SIGN_LANDMARKS' });
  const event3 = new CanonicalSemanticEvent({ actor: 'user-1', intent: 'LEAVE', sourceModality: 'TEXT' });

  session.atomicCommit(event1);
  session.atomicCommit(event2);
  session.atomicCommit(event3);

  // Test seeking to version v3
  const snapshotV3 = replayEngine.seekToVersion('v3');
  assert.strictEqual(snapshotV3.version, 'v3');
  assert.strictEqual(snapshotV3.event.intent, 'AFFIRM');

  // Test full replay sequence
  const replayedVersions = [];
  const result = await replayEngine.playReplay((snap) => {
    replayedVersions.push(snap.version);
  }, 10);

  assert.strictEqual(result.status, 'REPLAY_COMPLETE');
  assert.deepStrictEqual(replayedVersions, ['v2', 'v3', 'v4']);
});
