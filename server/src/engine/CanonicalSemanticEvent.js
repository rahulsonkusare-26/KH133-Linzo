/**
 * Samvaad AI Semantic Engine - Canonical Semantic Event (Stage 2)
 * Standardized, modality-agnostic event representation.
 * 
 * Schema:
 * {
 *   eventId: "E3912",
 *   actor: "USER_A",
 *   intent: "JOIN",
 *   target: "MEETING",
 *   payload: { rawText, confidence, parameters },
 *   context: "MEETING_ROOM_101",
 *   emotion: "NEUTRAL",
 *   time: "17:00:00",
 *   timestamp: 1720000000000,
 *   confidence: 0.98,
 *   sourceModality: "SPEECH"
 * }
 */

export class CanonicalSemanticEvent {
  constructor({
    eventId,
    actor,
    intent,
    target = 'SESSION',
    payload = {},
    context = 'GENERAL',
    emotion = 'NEUTRAL',
    confidence = 1.0,
    sourceModality = 'UNIFIED',
    timestamp = Date.now()
  }) {
    this.eventId = eventId || `E${Math.floor(1000 + Math.random() * 9000)}`;
    this.actor = actor || 'SYSTEM';
    this.intent = (intent || 'MESSAGE').toUpperCase();
    this.target = target;
    this.payload = payload;
    this.context = context;
    this.emotion = emotion;
    this.confidence = Number(confidence.toFixed(2));
    this.sourceModality = sourceModality;
    this.timestamp = timestamp;
    this.time = new Date(timestamp).toISOString().split('T')[1].split('.')[0];
  }

  /**
   * Parses raw feature streams into Canonical Semantic Events
   */
  static parse(unifiedFeatureStream) {
    const { actor, encoding, timestamp } = unifiedFeatureStream;
    const { modality, rawContent, confidence, features } = encoding;

    let intent = 'MESSAGE';
    let target = 'SESSION';
    let emotion = 'NEUTRAL';
    const contentStr = String(rawContent || '').toLowerCase().trim();

    // Intent Parsing Logic
    if (contentStr.includes('join') || contentStr.includes('hello') || contentStr.includes('wave') || contentStr.includes('enter')) {
      intent = 'JOIN';
    } else if (contentStr.includes('leave') || contentStr.includes('bye') || contentStr.includes('exit')) {
      intent = 'LEAVE';
    } else if (contentStr.includes('yes') || contentStr.includes('agree') || contentStr.includes('thumbs_up') || contentStr.includes('nod')) {
      intent = 'AFFIRM';
    } else if (contentStr.includes('no') || contentStr.includes('disagree') || contentStr.includes('thumbs_down') || contentStr.includes('shake_head')) {
      intent = 'NEGATE';
    } else if (contentStr.includes('raise_hand') || contentStr.includes('question') || contentStr.includes('doubt')) {
      intent = 'RAISE_HAND';
    } else if (contentStr.includes('clap') || contentStr.includes('applause')) {
      intent = 'APPLAUD';
    }

    // Emotion Detection Heuristics
    if (contentStr.includes('happy') || contentStr.includes('smile') || contentStr.includes('great')) {
      emotion = 'JOY';
    } else if (contentStr.includes('urgent') || contentStr.includes('help') || contentStr.includes('danger')) {
      emotion = 'URGENT';
    }

    return new CanonicalSemanticEvent({
      actor,
      intent,
      target,
      payload: {
        rawContent,
        features
      },
      confidence,
      sourceModality: modality,
      timestamp
    });
  }

  toJSON() {
    return {
      event_id: this.eventId,
      actor: this.actor,
      intent: this.intent,
      target: this.target,
      payload: this.payload,
      context: this.context,
      emotion: this.emotion,
      time: this.time,
      timestamp: this.timestamp,
      confidence: this.confidence,
      source_modality: this.sourceModality
    };
  }
}
