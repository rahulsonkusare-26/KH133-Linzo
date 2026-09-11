/**
 * Samvaad AI Semantic Engine - Modality Stream Aggregator
 * Buffers incoming raw feature tokens from multiple participants across modalities (Speech, Landmark, Text, Spatial)
 * before feeding into Canonical Semantic Parsing.
 */

export class ModalityStreamAggregator {
  constructor(windowMs = 500) {
    this.windowMs = windowMs;
    this.buffers = new Map(); // participantId -> TokenArray
  }

  pushToken(participantId, token) {
    if (!this.buffers.has(participantId)) {
      this.buffers.set(participantId, []);
    }
    const buf = this.buffers.get(participantId);
    const stampedToken = {
      ...token,
      timestamp: token.timestamp || Date.now()
    };
    buf.push(stampedToken);
    this.pruneBuffer(participantId);
    return buf;
  }

  pruneBuffer(participantId) {
    const buf = this.buffers.get(participantId);
    if (!buf) return;
    const now = Date.now();
    const pruned = buf.filter(t => (now - t.timestamp) <= this.windowMs);
    this.buffers.set(participantId, pruned);
  }

  getBufferedTokens(participantId) {
    this.pruneBuffer(participantId);
    return this.buffers.get(participantId) || [];
  }

  clearBuffer(participantId) {
    this.buffers.delete(participantId);
  }
}
