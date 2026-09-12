/**
 * Samvaad AI Semantic Engine - Haptic Synthesizer & Stream Aggregator Unit Test
 */

import test from 'node:test';
import assert from 'node:assert';
import { ModalityStreamAggregator } from '../src/engine/ModalityStreamAggregator.js';
import { HapticFeedbackSynthesizer } from '../src/engine/HapticFeedbackSynthesizer.js';

test('ModalityStreamAggregator - Token Windowing & Buffering', () => {
  const aggregator = new ModalityStreamAggregator(300);
  const participantId = 'user-test-1';

  aggregator.pushToken(participantId, { modality: 'SPEECH', token: 'hello' });
  const tokens = aggregator.getBufferedTokens(participantId);

  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].token, 'hello');
});

test('HapticFeedbackSynthesizer - Tactile Pattern Generation', () => {
  const greetingPattern = HapticFeedbackSynthesizer.synthesize('GREETING');
  assert.deepStrictEqual(greetingPattern, [100, 50, 100]);

  const joinPattern = HapticFeedbackSynthesizer.synthesize('JOIN');
  assert.deepStrictEqual(joinPattern, [200, 100, 200, 100, 200]);

  const defaultPattern = HapticFeedbackSynthesizer.synthesize('UNKNOWN');
  assert.deepStrictEqual(defaultPattern, [100]);
});
