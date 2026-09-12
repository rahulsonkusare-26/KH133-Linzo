/**
 * Samvaad AI Semantic Engine - Semantic Equivalence Stress & Benchmark Test
 * Verifies high-throughput meaning collapse execution performance.
 */

import test from 'node:test';
import assert from 'node:assert';
import { SemanticEquivalenceEngine } from '../src/engine/SemanticEquivalenceEngine.js';
import { CanonicalSemanticEvent } from '../src/engine/CanonicalSemanticEvent.js';

test('Semantic Equivalence Engine Benchmark - 10,000 Event Collapses', () => {
  const engine = new SemanticEquivalenceEngine(1500);
  const start = performance.now();

  const numEvents = 10000;
  let collapsedCount = 0;

  for (let i = 0; i < numEvents; i++) {
    const isOdd = i % 2 !== 0;
    const event = new CanonicalSemanticEvent({
      actor: 'user-1',
      intent: isOdd ? 'JOIN_SPEECH' : 'JOIN_SIGN',
      payload: { phrase: isOdd ? 'Hello' : 'Hi' },
      sourceModality: isOdd ? 'SPEECH' : 'SIGN_LANDMARKS',
      timestamp: 100000 + Math.floor(i / 2) * 5
    });

    const result = engine.evaluate(event);
    if (result.action === 'COLLAPSED') {
      collapsedCount++;
    }
  }

  const duration = performance.now() - start;
  console.log(`Processed ${numEvents} events in ${duration.toFixed(2)}ms (${collapsedCount} collapsed).`);

  assert.ok(duration < 500, `Performance target failed: execution took ${duration.toFixed(2)}ms (must be < 500ms)`);
  assert.ok(collapsedCount > 0, 'Equivalence collapsing failed to detect duplicate intent');
});
