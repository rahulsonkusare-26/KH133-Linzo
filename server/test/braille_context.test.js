/**
 * Samvaad AI Semantic Engine - BrailleCodec & SemanticContextTracker Unit Test
 */

import test from 'node:test';
import assert from 'node:assert';
import { BrailleCodec } from '../src/engine/BrailleCodec.js';
import { SemanticContextTracker } from '../src/engine/SemanticContextTracker.js';

test('BrailleCodec - Grade 1 ASCII Braille Encoding', () => {
  const encoded = BrailleCodec.encodeText('hello');
  assert.strictEqual(encoded, '⠓⠑⠇⠇⠕');

  const eventRes = BrailleCodec.encodeEvent({ intent: 'JOIN', payload: { phrase: 'hi' } });
  assert.strictEqual(eventRes.braille, '⠓⠊');
});

test('SemanticContextTracker - Turn Recording & Topic Inference', () => {
  const tracker = new SemanticContextTracker();
  tracker.recordTurn({ actor: 'user-1', intent: 'GREETING', payload: { phrase: 'hello' } });

  const summary = tracker.getContextSummary();
  assert.strictEqual(summary.lastSpeaker, 'user-1');
  assert.strictEqual(summary.activeTopic, 'WELCOME_GREETINGS');
  assert.strictEqual(summary.totalTurns, 1);
});
